import path from "node:path";
import { type UtilityProcess, utilityProcess } from "electron";
import type {
  AcousticFrame,
  AcousticLabels,
  PronunciationExecutionProvider,
  PronunciationModelManifest,
} from "../../src/modules/pronunciation";
import type { AcousticBundle } from "./bundle";

/**
 * Client to the CAPT inference utility process. Lazy-spawns the worker
 * on first call, queues requests single-flight, and recovers from
 * unexpected worker exits by transparently respawning on the next call.
 *
 * IPC envelope is keyed by an auto-incrementing `id` so we can correlate
 * responses with their requesters even though we serialize the queue —
 * survives a worker crash mid-request without rejecting unrelated work.
 */

type Request =
  | {
      id: number;
      kind: "warmup";
      modelPath: string;
      manifest: PronunciationModelManifest;
      labels: Record<string, string>;
      provider: PronunciationExecutionProvider;
    }
  | {
      id: number;
      kind: "infer";
      modelPath: string;
      manifest: PronunciationModelManifest;
      labels: Record<string, string>;
      provider: PronunciationExecutionProvider;
      audioPcm: Float32Array;
      sampleRate: number;
    }
  | { id: number; kind: "shutdown" };

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

interface Pending {
  request: Request;
  resolve: (value: SuccessResponse) => void;
  reject: (reason: Error & { recoverable?: boolean }) => void;
}

let child: UtilityProcess | null = null;
let nextId = 1;
let inFlight: Pending | null = null;
const queue: Pending[] = [];

function workerPath(): string {
  // Vite emits the worker bundle next to main.js (configured in
  // vite.main.config.ts + forge.config.ts). `__dirname` here is
  // `.vite/build/` inside the packaged or running app.
  return path.join(__dirname, "pronunciation-worker.js");
}

function spawnWorker(): UtilityProcess {
  const proc = utilityProcess.fork(workerPath(), [], {
    stdio: "pipe",
    serviceName: "capt-worker",
  });

  proc.stdout?.on("data", (chunk) => {
    process.stdout.write(`[capt-worker] ${chunk.toString()}`);
  });
  proc.stderr?.on("data", (chunk) => {
    process.stderr.write(`[capt-worker] ${chunk.toString()}`);
  });

  proc.on("message", (raw) => handleResponse(raw as Response));

  proc.on("exit", (code) => {
    const wasUnexpected = inFlight !== null || queue.length > 0;
    const exited = child === proc;
    if (exited) child = null;
    if (!wasUnexpected) return;
    const reason = `CAPT worker exited unexpectedly (code ${code ?? "unknown"})`;
    const pendingError = makeError(reason, true);
    const pending = inFlight;
    inFlight = null;
    pending?.reject(pendingError);
    // Queued callers can be retried — surface the error so React Query
    // can decide. We do not auto-retry to avoid cascading reloads.
    const queued = queue.splice(0, queue.length);
    for (const item of queued) item.reject(pendingError);
  });

  return proc;
}

function ensureWorker(): UtilityProcess {
  if (child) return child;
  child = spawnWorker();
  return child;
}

function handleResponse(response: Response): void {
  const pending = inFlight;
  if (!pending || pending.request.id !== response.id) {
    console.warn(`[capt] dropping orphaned worker response id=${response.id}`);
    return;
  }
  inFlight = null;
  if (response.ok) {
    pending.resolve(response);
  } else {
    pending.reject(makeError(response.reason, response.recoverable));
  }
  pump();
}

function pump(): void {
  if (inFlight) return;
  const next = queue.shift();
  if (!next) return;
  inFlight = next;
  ensureWorker().postMessage(next.request);
}

function enqueue<T extends SuccessResponse>(request: Request): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      request,
      resolve: resolve as (value: SuccessResponse) => void,
      reject,
    });
    pump();
  });
}

function makeError(message: string, recoverable: boolean): Error & { recoverable: boolean } {
  const error = new Error(message) as Error & { recoverable: boolean };
  error.recoverable = recoverable;
  return error;
}

function providerFallbacks(
  preferred: PronunciationExecutionProvider,
): PronunciationExecutionProvider[] {
  return preferred === "cpu" ? ["cpu"] : [preferred, "cpu"];
}

export interface InferenceResult {
  frames: AcousticFrame[];
  labels: AcousticLabels;
  provider: PronunciationExecutionProvider;
  durationMs: number;
}

/** Preload the ONNX session in the worker without running inference. */
export async function warmupInference(
  bundle: AcousticBundle,
  preferred: PronunciationExecutionProvider,
): Promise<void> {
  for (const provider of providerFallbacks(preferred)) {
    try {
      await enqueue<SuccessResponse>({
        id: nextId++,
        kind: "warmup",
        modelPath: bundle.modelPath,
        manifest: bundle.manifest,
        labels: bundle.labels,
        provider,
      });
      return;
    } catch (error) {
      const err = error as Error & { recoverable?: boolean };
      if (!err.recoverable) throw err;
    }
  }
}

/** Run a single inference attempt. Provider fallback to CPU on failure. */
export async function infer(
  bundle: AcousticBundle,
  preferred: PronunciationExecutionProvider,
  audioPcm: Float32Array,
  sampleRate: number,
): Promise<InferenceResult> {
  let lastError: Error | null = null;
  for (const provider of providerFallbacks(preferred)) {
    try {
      const response = await enqueue<SuccessResponse>({
        id: nextId++,
        kind: "infer",
        modelPath: bundle.modelPath,
        manifest: bundle.manifest,
        labels: bundle.labels,
        provider,
        audioPcm,
        sampleRate,
      });
      if (!response.frames || !response.labels) {
        throw new Error("CAPT worker returned response without frames or labels.");
      }
      return {
        frames: response.frames,
        labels: response.labels,
        provider: response.provider,
        durationMs: response.durationMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const recoverable = (error as Error & { recoverable?: boolean }).recoverable === true;
      if (!recoverable) break;
    }
  }
  throw lastError ?? new Error("CAPT worker inference failed for all providers.");
}

/** Cancel any pending queued requests. The in-flight request can't be
 * preempted (transformers.js does not expose a cancellation hook). */
export function cancelPending(): number {
  const cancelled = queue.length;
  for (const item of queue) {
    item.reject(makeError("Cancelled by user.", true));
  }
  queue.length = 0;
  return cancelled;
}

/** Tear down the worker. Idempotent. Safe to call on `app.before-quit`. */
export async function disposeInferenceClient(): Promise<void> {
  const proc = child;
  if (!proc) return;
  try {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // already dead
        }
        resolve();
      }, 500);
      proc.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      try {
        proc.postMessage({ id: nextId++, kind: "shutdown" });
      } catch {
        clearTimeout(timeout);
        resolve();
      }
    });
  } finally {
    child = null;
    inFlight = null;
    queue.length = 0;
  }
}

export const _internal = {
  getQueueLength: () => queue.length,
  hasInFlight: () => inFlight !== null,
  hasWorker: () => child !== null,
};
