import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import {
  type AcousticFrame,
  type PronunciationAnalyzeInput,
  type PronunciationAssessment,
  type PronunciationExecutionProvider,
  type PronunciationRuntimeStatus,
  assessPronunciationFromFrames,
  buildPronunciationTarget,
  ctcViterbiAlign,
  deterministicAcousticFrames,
  scoreStress,
} from "../../src/modules/pronunciation";

const require = createRequire(import.meta.url);
const ASSET_DIR = "capt-models";
const MANIFEST_FILE = "manifest.json";

interface PronunciationModelManifest {
  modelId: string;
  sampleRate?: number;
  frameMs?: number;
  labels?: Record<string, string>;
}

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

let cachedModel: {
  key: string;
  processor: unknown;
  model: unknown;
  manifest: PronunciationModelManifest;
  status: PronunciationRuntimeStatus;
} | null = null;

export async function pronunciationStatus(): Promise<PronunciationRuntimeStatus> {
  const status = baseRuntimeStatus();
  const manifest = readModelManifest(status.modelPath);
  const dependenciesReady = await hasTransformersRuntime(status.platform, status.arch);

  if (!status.modelPresent) {
    return {
      ...status,
      available: false,
      backend: "deterministic",
      reason: `No offline CAPT model bundle found. Install ${ASSET_DIR}/${MANIFEST_FILE} plus ONNX model files.`,
    };
  }

  if (!manifest?.labels || Object.keys(manifest.labels).length === 0) {
    return {
      ...status,
      available: false,
      backend: "deterministic",
      reason: "CAPT model manifest is missing a phoneme label map.",
    };
  }

  if (!dependenciesReady) {
    return {
      ...status,
      available: false,
      backend: "deterministic",
      reason: "CAPT runtime dependencies or native binaries are not installed for this platform.",
    };
  }

  return {
    ...status,
    available: true,
    backend: "transformers-js",
    reason: null,
  };
}

export function pronunciationTarget(input: { text: string; ipa?: string | null }) {
  return buildPronunciationTarget(input.text, input.ipa);
}

export async function assessPronunciation(
  input: PronunciationAnalyzeInput,
): Promise<
  | { ok: true; assessment: PronunciationAssessment; status: PronunciationRuntimeStatus }
  | { ok: false; status: PronunciationRuntimeStatus; reason: string }
> {
  const startedAt = Date.now();
  const status = await pronunciationStatus();
  if (!status.available) {
    return { ok: false, status, reason: status.reason ?? "Pronunciation model is unavailable." };
  }

  try {
    const { frames, status: runtime, manifest } = await acousticFramesWithFallback(input, status);
    const assessment = assessPronunciationFromFrames({
      input,
      frames,
      runtime,
      startedAt,
    });
    return {
      ok: true,
      status: runtime,
      assessment: {
        ...assessment,
        target: buildPronunciationTarget(input.targetText, input.ipa),
        durationMs: Math.max(0, Date.now() - startedAt),
        modelUsed: true,
        feedback: [
          ...assessment.feedback,
          `Model: ${manifest.modelId} · ${runtime.executionProvider.toUpperCase()}`,
        ],
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "CAPT model inference failed.";
    return {
      ok: false,
      status: { ...status, available: false, reason },
      reason,
    };
  }
}

export function previewPronunciation(input: PronunciationAnalyzeInput): PronunciationAssessment {
  const target = buildPronunciationTarget(input.targetText, input.ipa);
  const runtime: PronunciationRuntimeStatus = {
    available: true,
    backend: "deterministic",
    executionProvider: "cpu",
    platform: process.platform,
    arch: process.arch,
    modelPath: null,
    modelPresent: false,
    localOnly: true,
    reason: "Deterministic alignment preview; no acoustic model was used.",
  };
  return assessPronunciationFromFrames({
    input,
    frames: deterministicAcousticFrames(target.phonemes),
    runtime,
  });
}

async function acousticFramesFromTransformers(
  input: PronunciationAnalyzeInput,
  status: PronunciationRuntimeStatus,
): Promise<{
  frames: AcousticFrame[];
  status: PronunciationRuntimeStatus;
  manifest: PronunciationModelManifest;
}> {
  if (!input.audioPcm || input.audioPcm.length === 0) {
    throw new Error("No PCM audio was supplied for pronunciation analysis.");
  }
  const manifest = readModelManifest(status.modelPath);
  if (!manifest?.labels) throw new Error("CAPT model manifest is missing labels.");
  const bundle = (await import("@huggingface/transformers")) as unknown as TransformersBundle;
  if (!status.modelPath) throw new Error("CAPT model path is unavailable.");

  bundle.env.localModelPath = status.modelPath;
  bundle.env.allowRemoteModels = false;

  const cacheKey = `${status.modelPath}:${manifest.modelId}:${status.executionProvider}`;
  if (!cachedModel || cachedModel.key !== cacheKey) {
    const options = {
      local_files_only: true,
      device: deviceForProvider(status.executionProvider),
    };
    cachedModel = {
      key: cacheKey,
      processor: await bundle.AutoProcessor.from_pretrained(manifest.modelId, options),
      model: await bundle.AutoModelForCTC.from_pretrained(manifest.modelId, options),
      manifest,
      status,
    };
  }

  const processor = cachedModel.processor as (
    audio: Float32Array,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  const model = cachedModel.model as (
    inputs: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  const modelSampleRate = manifest.sampleRate ?? 16_000;
  const audioPcm = normalizePcm(
    input.sampleRate && input.sampleRate !== modelSampleRate
      ? resampleLinear(input.audioPcm, input.sampleRate, modelSampleRate)
      : input.audioPcm,
  );
  const processed = await processor(Float32Array.from(audioPcm), {
    sampling_rate: modelSampleRate,
  });
  const output = await model(processed);
  return {
    frames: logitsToFrames(output, manifest),
    manifest,
    status,
  };
}

async function acousticFramesWithFallback(
  input: PronunciationAnalyzeInput,
  status: PronunciationRuntimeStatus,
): Promise<{
  frames: AcousticFrame[];
  status: PronunciationRuntimeStatus;
  manifest: PronunciationModelManifest;
}> {
  const providers = providerFallbacks(status.executionProvider);
  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      return await acousticFramesFromTransformers(input, {
        ...status,
        executionProvider: provider,
      });
    } catch (error) {
      lastError = error;
      if (cachedModel?.status.executionProvider === provider) cachedModel = null;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("CAPT model inference failed.");
}

function providerFallbacks(
  preferred: PronunciationExecutionProvider,
): PronunciationExecutionProvider[] {
  return preferred === "cpu" ? ["cpu"] : [preferred, "cpu"];
}

function logitsToFrames(
  output: Record<string, unknown>,
  manifest: PronunciationModelManifest,
): AcousticFrame[] {
  const logits = tensorData(output.logits);
  const dims = tensorDims(output.logits);
  if (!logits || dims.length < 3) {
    throw new Error("CAPT model did not return [batch, frames, labels] logits.");
  }
  const frameCount = dims[1] ?? 0;
  const labelCount = dims[2] ?? 0;
  if (frameCount <= 0 || labelCount <= 0) throw new Error("CAPT model returned empty logits.");

  const labels = manifest.labels ?? {};
  const frames: AcousticFrame[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = frame * labelCount;
    const slice = logits.slice(offset, offset + labelCount);
    const logSoftmax = toLogSoftmax(slice);
    const logProbs: Record<string, number> = {};
    for (let i = 0; i < labelCount; i += 1) {
      const label = labels[String(i)] ?? (i === 0 ? "<blank>" : null);
      if (label) logProbs[label] = logSoftmax[i] ?? -14;
    }
    frames.push({ timeMs: frame * (manifest.frameMs ?? 20), logProbs });
  }
  return frames;
}

function baseRuntimeStatus(): PronunciationRuntimeStatus {
  const modelPath = findModelPath();
  const executionProvider = defaultProvider();
  return {
    available: false,
    backend: "deterministic",
    executionProvider,
    platform: process.platform,
    arch: process.arch,
    modelPath,
    modelPresent: modelPath !== null && fs.existsSync(path.join(modelPath, MANIFEST_FILE)),
    localOnly: true,
    reason: null,
  };
}

function defaultProvider(): PronunciationExecutionProvider {
  if (process.platform === "darwin") return "coreml";
  if (process.platform === "win32") return "directml";
  return "cpu";
}

function deviceForProvider(provider: PronunciationExecutionProvider): string {
  if (provider === "directml") return "dml";
  return provider;
}

function findModelPath(): string | null {
  for (const candidate of modelSearchPaths()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return modelSearchPaths()[0] ?? null;
}

function modelSearchPaths(): string[] {
  const roots = [
    process.resourcesPath ? path.join(process.resourcesPath, ASSET_DIR) : null,
    safeUserDataPath(),
    path.join(process.cwd(), "assets", ASSET_DIR),
  ];
  return roots.filter((item): item is string => Boolean(item));
}

function safeUserDataPath(): string | null {
  try {
    return path.join(app.getPath("userData"), ASSET_DIR);
  } catch {
    return path.join(os.tmpdir(), "vocab-app", ASSET_DIR);
  }
}

function readModelManifest(modelPath: string | null): PronunciationModelManifest | null {
  if (!modelPath) return null;
  const file = path.join(modelPath, MANIFEST_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PronunciationModelManifest;
  } catch {
    return null;
  }
}

async function hasTransformersRuntime(
  platform: NodeJS.Platform | "test",
  arch: string,
): Promise<boolean> {
  if (!hasRuntimeDependency("@huggingface/transformers")) return false;
  if (!hasRuntimeDependency("onnxruntime-node")) return false;
  if (!hasRuntimeBinary("onnxruntime-node", platform, arch)) return false;
  try {
    await import("@huggingface/transformers");
    return true;
  } catch {
    return false;
  }
}

function hasRuntimeDependency(name: string): boolean {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

function hasRuntimeBinary(name: string, platform: NodeJS.Platform | "test", arch: string): boolean {
  if (platform === "test") return true;
  try {
    const packageRoot = path.dirname(require.resolve(path.join(name, "package.json")));
    const bindingPath = path.join(
      packageRoot,
      "bin",
      "napi-v6",
      platform,
      arch,
      "onnxruntime_binding.node",
    );
    return fs.existsSync(bindingPath);
  } catch {
    return false;
  }
}

function tensorData(value: unknown): number[] | null {
  const data = isRecord(value) ? value.data : null;
  if (!data) return null;
  if (Array.isArray(data)) return data.filter((item): item is number => typeof item === "number");
  if (ArrayBuffer.isView(data)) return Array.from(data as unknown as ArrayLike<number>);
  return null;
}

function tensorDims(value: unknown): number[] {
  const dims = isRecord(value) ? value.dims : null;
  return Array.isArray(dims) ? dims.filter((item): item is number => typeof item === "number") : [];
}

function toLogSoftmax(values: number[]): number[] {
  const max = Math.max(...values);
  const sum = values.reduce((acc, value) => acc + Math.exp(value - max), 0);
  const logSum = max + Math.log(sum);
  return values.map((value) => value - logSum);
}

function normalizePcm(values: number[]): number[] {
  return values.map((value) => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(-1, Math.min(1, value));
  });
}

function resampleLinear(values: number[], fromRate: number, toRate: number): number[] {
  if (values.length === 0 || fromRate <= 0 || toRate <= 0 || fromRate === toRate) return values;
  const outLength = Math.max(1, Math.round((values.length * toRate) / fromRate));
  const ratio = fromRate / toRate;
  const out = Array<number>(outLength);

  for (let i = 0; i < outLength; i += 1) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(values.length - 1, left + 1);
    const t = sourceIndex - left;
    out[i] = (values[left] ?? 0) * (1 - t) + (values[right] ?? 0) * t;
  }

  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const _internal = {
  ctcViterbiAlign,
  scoreStress,
  buildPronunciationTarget,
};
