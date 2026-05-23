/**
 * CAPT inference utility process.
 *
 * Lives in its own Electron `utilityProcess` so the 360 MB HuBERT ONNX
 * session loads + runs off the main process. Owns the
 * @huggingface/transformers + onnxruntime-node modules and the per-
 * `{modelPath, modelId, provider}` session cache. Single-flight by
 * convention: the client (`inferenceClient.ts`) sends one request at
 * a time.
 *
 * Wire format mirrors the `InferenceRequest` / `InferenceResponse`
 * unions defined in `inferenceClient.ts`. No backwards-compat envelope —
 * the worker and the client ship together.
 */
import type {
  AcousticFrame,
  AcousticLabels,
  PronunciationExecutionProvider,
  PronunciationModelManifest,
} from "../../../src/modules/pronunciation";
import { preparePcmForModel } from "../pcm";

// Electron exposes `process.parentPort` to utility processes. The
// listener receives a MessageEvent-shaped `{ data, ports }` object (NOT
// the raw payload — that asymmetry vs. `UtilityProcess.on('message')`
// caused every field of `request` to come through as undefined before).
// See https://www.electronjs.org/docs/latest/api/parent-port.
interface MessageEventLike {
  data: unknown;
}
interface ParentPort {
  on(event: "message", listener: (event: MessageEventLike) => void): void;
  postMessage(message: unknown): void;
}
const port = (process as unknown as { parentPort?: ParentPort }).parentPort;
if (!port) {
  throw new Error(
    "[capt-worker] process.parentPort missing — entry must run as Electron utilityProcess",
  );
}

const activePort: ParentPort = port;

type WarmupRequest = {
  id: number;
  kind: "warmup";
  modelPath: string;
  manifest: PronunciationModelManifest;
  labels: Record<string, string>;
  provider: PronunciationExecutionProvider;
};

type InferRequest = {
  id: number;
  kind: "infer";
  modelPath: string;
  manifest: PronunciationModelManifest;
  labels: Record<string, string>;
  provider: PronunciationExecutionProvider;
  audioPcm: Float32Array;
  sampleRate: number;
};

type ShutdownRequest = { id: number; kind: "shutdown" };

type Request = WarmupRequest | InferRequest | ShutdownRequest;

type SuccessResponse = {
  id: number;
  ok: true;
  durationMs: number;
  provider: PronunciationExecutionProvider;
  frames?: AcousticFrame[];
  labels?: AcousticLabels;
};

type FailureResponse = {
  id: number;
  ok: false;
  reason: string;
  recoverable: boolean;
};

type Response = SuccessResponse | FailureResponse;

type TransformersBundle = {
  env: {
    allowRemoteModels: boolean;
    localModelPath: string;
  };
  AutoProcessor: {
    from_pretrained: (modelId: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
  AutoModelForCTC: {
    from_pretrained: (modelId: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
};

const BLANK_LABEL = "<blank>";
const UNKNOWN_LABEL = "<unk>";

let cached: {
  key: string;
  processor: unknown;
  model: unknown;
  manifest: PronunciationModelManifest;
  provider: PronunciationExecutionProvider;
} | null = null;

activePort.on("message", (event) => {
  const payload = (event && typeof event === "object" && "data" in event ? event.data : event) as
    | Partial<Request>
    | null
    | undefined;
  const id =
    payload && typeof payload === "object" && typeof payload.id === "number" ? payload.id : -1;
  const validationError = validateRequest(payload);
  if (validationError) {
    send({ id, ok: false, reason: validationError, recoverable: false });
    return;
  }
  const request = payload as Request;
  handle(request).catch((error) => {
    const reason = error instanceof Error ? error.message : String(error);
    send({ id: request.id, ok: false, reason, recoverable: false });
  });
});

function validateRequest(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return "[capt-worker] message payload missing — expected MessageEvent.data with request body";
  }
  const candidate = payload as { id?: unknown; kind?: unknown };
  if (typeof candidate.id !== "number") {
    return "[capt-worker] request.id missing or not a number";
  }
  if (candidate.kind !== "warmup" && candidate.kind !== "infer" && candidate.kind !== "shutdown") {
    return `[capt-worker] request.kind invalid: ${String(candidate.kind)}`;
  }
  return null;
}

async function handle(request: Request): Promise<void> {
  if (request.kind === "shutdown") {
    cached = null;
    send({ id: request.id, ok: true, durationMs: 0, provider: "cpu" });
    setTimeout(() => process.exit(0), 25);
    return;
  }
  const startedAt = Date.now();
  try {
    if (request.kind === "warmup") {
      await ensureLoaded(request.modelPath, request.manifest, request.provider);
      send({
        id: request.id,
        ok: true,
        durationMs: Date.now() - startedAt,
        provider: request.provider,
      });
      return;
    }
    const { frames, labels } = await runInference(request);
    send({
      id: request.id,
      ok: true,
      durationMs: Date.now() - startedAt,
      provider: request.provider,
      frames,
      labels,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "CAPT worker inference failed.";
    send({ id: request.id, ok: false, reason, recoverable: true });
  }
}

function send(response: Response): void {
  activePort.postMessage(response);
}

async function ensureLoaded(
  modelPath: string,
  manifest: PronunciationModelManifest,
  provider: PronunciationExecutionProvider,
): Promise<void> {
  const cacheKey = `${modelPath}:${manifest.modelId}:${provider}`;
  if (cached?.key === cacheKey) return;

  const transformers = (await import("@huggingface/transformers")) as unknown as TransformersBundle;
  transformers.env.localModelPath = modelPath;
  transformers.env.allowRemoteModels = false;

  const options = {
    local_files_only: true,
    device: deviceForProvider(provider),
    dtype: manifest.dtype,
  };
  cached = {
    key: cacheKey,
    processor: await retryOnTransientAbort(
      () => transformers.AutoProcessor.from_pretrained(manifest.modelId, options),
      "AutoProcessor.from_pretrained",
    ),
    model: await retryOnTransientAbort(
      () => transformers.AutoModelForCTC.from_pretrained(manifest.modelId, options),
      "AutoModelForCTC.from_pretrained",
    ),
    manifest,
    provider,
  };
}

// transformers.js fetches model assets via node-fetch even when
// local_files_only is set; the initial probe races an AbortController
// and surfaces "The user aborted a request." sporadically on macOS.
// The same abort can fire deep inside processor() and model() on the
// first call after a cold worker spawn, so every transformers entry
// point gets the same silent single-retry treatment.
async function retryOnTransientAbort<T>(run: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 0 && isTransientAbort(message)) continue;
      throw error;
    }
  }
  throw new Error(`[capt-worker] ${label} retry exhausted`);
}

function isTransientAbort(message: string): boolean {
  return message.includes("The user aborted a request") || message.includes("AbortError");
}

async function runInference(request: InferRequest): Promise<{
  frames: AcousticFrame[];
  labels: AcousticLabels;
}> {
  await ensureLoaded(request.modelPath, request.manifest, request.provider);
  const loaded = cached;
  if (!loaded) throw new Error("CAPT worker model cache lost between load and inference.");

  const processor = loaded.processor as (
    audio: Float32Array,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  const model = loaded.model as (
    inputs: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;

  const modelSampleRate = request.manifest.sampleRate ?? 16_000;
  const prepared = preparePcmForModel(request.audioPcm, request.sampleRate, modelSampleRate);
  const processed = await retryOnTransientAbort(
    () => processor(prepared, { sampling_rate: modelSampleRate }),
    "processor",
  );
  const output = await retryOnTransientAbort(() => model(processed), "model");
  return logitsToFrames(output, request.manifest, request.labels);
}

function logitsToFrames(
  output: Record<string, unknown>,
  manifest: PronunciationModelManifest,
  bundleLabels: Record<string, string>,
): { frames: AcousticFrame[]; labels: AcousticLabels } {
  const dims = tensorDims(output.logits);
  const data = tensorData(output.logits);
  if (!data || dims.length < 3) {
    throw new Error("CAPT model did not return [batch, frames, labels] logits.");
  }
  const frameCount = dims[1] ?? 0;
  const labelCount = dims[2] ?? 0;
  if (frameCount <= 0 || labelCount <= 0) throw new Error("CAPT model returned empty logits.");

  const labels = buildAcousticLabels(bundleLabels, labelCount);
  const frames: AcousticFrame[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = frame * labelCount;
    const slice = data.subarray(offset, offset + labelCount);
    frames.push({
      timeMs: frame * (manifest.frameMs ?? 20),
      logProbs: logSoftmax(slice),
    });
  }
  return { frames, labels };
}

function buildAcousticLabels(
  bundleLabels: Record<string, string>,
  labelCount: number,
): AcousticLabels {
  const labels = new Array<string>(labelCount).fill(UNKNOWN_LABEL);
  let blankIndex = -1;
  for (const [key, label] of Object.entries(bundleLabels)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= labelCount) continue;
    labels[idx] = label;
    if (label === BLANK_LABEL && blankIndex === -1) blankIndex = idx;
  }
  if (blankIndex === -1) {
    blankIndex = 0;
    if (labels[0] === UNKNOWN_LABEL) labels[0] = BLANK_LABEL;
  }
  return { labels, blankIndex };
}

function deviceForProvider(provider: PronunciationExecutionProvider): string {
  if (provider === "directml") return "dml";
  return provider;
}

function tensorData(value: unknown): Float32Array | null {
  const data = isRecord(value) ? value.data : null;
  if (!data) return null;
  if (data instanceof Float32Array) return data;
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Float32Array(view.buffer, view.byteOffset, view.byteLength / 4);
  }
  if (Array.isArray(data)) {
    const out = new Float32Array(data.length);
    for (let i = 0; i < data.length; i += 1) out[i] = typeof data[i] === "number" ? data[i] : 0;
    return out;
  }
  return null;
}

function tensorDims(value: unknown): number[] {
  const dims = isRecord(value) ? value.dims : null;
  return Array.isArray(dims) ? dims.filter((item): item is number => typeof item === "number") : [];
}

function logSoftmax(values: Float32Array): Float32Array {
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i] ?? Number.NEGATIVE_INFINITY;
    if (v > max) max = v;
  }
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += Math.exp((values[i] ?? max) - max);
  const logSum = max + Math.log(sum);
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) out[i] = (values[i] ?? logSum) - logSum;
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
