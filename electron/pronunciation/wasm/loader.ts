import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type {
  AcousticFrame,
  AcousticLabels,
  PronunciationPhonemeScore,
} from "../../../src/modules/pronunciation";
import { stripStress } from "../../../src/modules/pronunciation";
import type { AlignmentResult } from "../../../src/modules/pronunciation/ctc";

interface WasmExports {
  memory: WebAssembly.Memory;
  alloc: (size: number) => number;
  dealloc: (ptr: number, size: number) => void;
  ctc_align: (
    targetPtr: number,
    targetLen: number,
    blankIndex: number,
    framesPtr: number,
    frameCount: number,
    labelCount: number,
    outPtr: number,
  ) => number;
}

const BLANK_LABEL = "<blank>";
const ARTIFACT_DIRNAME = "pronunciation";
const ARTIFACT_FILENAME = "viterbi.wasm";

let cachedInstance: { exports: WasmExports } | null = null;
let loadAttempted = false;
let loadFailureReason: string | null = null;

/**
 * Attempt to load the precompiled WASM Viterbi. Returns `null` when the
 * artifact is missing or fails to instantiate — callers should fall back
 * to the pure-JS implementation (`src/modules/pronunciation/ctc.ts`).
 *
 * Idempotent: only the first invocation reads the file and instantiates.
 */
export function tryLoadWasmAligner(): { ctcAlignWasm: typeof ctcAlignWasm } | null {
  if (cachedInstance) return { ctcAlignWasm };
  if (loadAttempted) return null;
  loadAttempted = true;

  const wasmPath = locateWasmArtifact();
  if (!wasmPath) {
    loadFailureReason = "WASM viterbi artifact not found.";
    return null;
  }
  try {
    const bytes = fs.readFileSync(wasmPath);
    const module = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(module, {});
    cachedInstance = { exports: instance.exports as unknown as WasmExports };
    return { ctcAlignWasm };
  } catch (error) {
    cachedInstance = null;
    loadFailureReason =
      error instanceof Error ? error.message : "Failed to instantiate WASM viterbi.";
    return null;
  }
}

export function wasmLoadFailureReason(): string | null {
  return loadFailureReason;
}

export function ctcAlignWasm({
  target,
  frames,
  labels,
}: {
  target: string[];
  frames: AcousticFrame[];
  labels: AcousticLabels;
}): AlignmentResult {
  if (!cachedInstance) {
    throw new Error("WASM viterbi not loaded. Call tryLoadWasmAligner first.");
  }
  if (target.length === 0 || frames.length === 0) {
    return { phonemes: [], averageLogProb: Number.NEGATIVE_INFINITY };
  }

  const { exports } = cachedInstance;
  const labelCount = labels.labels.length;
  const phonemeIndex = buildPhonemeIndex(labels);
  const targetIndices = new Int32Array(target.length);
  for (let i = 0; i < target.length; i += 1) {
    const stripped = stripStress(target[i] ?? "");
    targetIndices[i] = phonemeIndex.get(stripped) ?? -1;
  }

  const frameLogProbs = new Float32Array(frames.length * labelCount);
  for (let t = 0; t < frames.length; t += 1) {
    const frame = frames[t];
    if (!frame) continue;
    const offset = t * labelCount;
    const src = frame.logProbs;
    for (let i = 0; i < labelCount; i += 1) {
      frameLogProbs[offset + i] = src[i] ?? Number.NEGATIVE_INFINITY;
    }
  }

  const targetBytes = targetIndices.byteLength;
  const framesBytes = frameLogProbs.byteLength;
  const outFloats = target.length * 4;
  const outBytes = outFloats * 4;

  const targetPtr = exports.alloc(targetBytes);
  const framesPtr = exports.alloc(framesBytes);
  const outPtr = exports.alloc(outBytes);

  try {
    new Int32Array(exports.memory.buffer, targetPtr, targetIndices.length).set(targetIndices);
    new Float32Array(exports.memory.buffer, framesPtr, frameLogProbs.length).set(frameLogProbs);
    new Float32Array(exports.memory.buffer, outPtr, outFloats).fill(0);

    const status = exports.ctc_align(
      targetPtr,
      target.length,
      labels.blankIndex,
      framesPtr,
      frames.length,
      labelCount,
      outPtr,
    );

    if (status !== 0) {
      return { phonemes: [], averageLogProb: Number.NEGATIVE_INFINITY };
    }

    const outView = new Float32Array(exports.memory.buffer, outPtr, outFloats);
    const phonemes: PronunciationPhonemeScore[] = [];
    let logProbSum = 0;
    for (let i = 0; i < target.length; i += 1) {
      const first = Math.max(0, Math.round(outView[i * 4] ?? 0));
      const last = Math.max(first, Math.round(outView[i * 4 + 1] ?? 0));
      const avg = outView[i * 4 + 2] ?? Number.NEGATIVE_INFINITY;
      const detectedIdx = Math.round(outView[i * 4 + 3] ?? -1);
      logProbSum += avg;
      const phoneme = stripStress(target[i] ?? "");
      const detected =
        detectedIdx >= 0 && detectedIdx < labelCount ? (labels.labels[detectedIdx] ?? null) : null;
      const score = logProbToScore(avg);
      phonemes.push({
        phoneme,
        expectedIndex: i,
        startMs: frames[first]?.timeMs ?? 0,
        endMs: (frames[last]?.timeMs ?? frames[first]?.timeMs ?? 0) + 20,
        score,
        detectedPhoneme: detected === BLANK_LABEL ? null : detected,
        issue: score >= 76 ? "ok" : detected && detected !== phoneme ? "substitution" : "weak",
      });
    }
    return {
      phonemes,
      averageLogProb: target.length > 0 ? logProbSum / target.length : Number.NEGATIVE_INFINITY,
    };
  } finally {
    exports.dealloc(targetPtr, targetBytes);
    exports.dealloc(framesPtr, framesBytes);
    exports.dealloc(outPtr, outBytes);
  }
}

function locateWasmArtifact(): string | null {
  for (const candidate of artifactSearchPaths()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function artifactSearchPaths(): string[] {
  const roots: Array<string | null> = [
    process.resourcesPath
      ? path.join(process.resourcesPath, "assets", ARTIFACT_DIRNAME, ARTIFACT_FILENAME)
      : null,
    process.resourcesPath
      ? path.join(process.resourcesPath, ARTIFACT_DIRNAME, ARTIFACT_FILENAME)
      : null,
    safeUserDataArtifact(),
    path.join(process.cwd(), "assets", ARTIFACT_DIRNAME, ARTIFACT_FILENAME),
  ];
  return roots.filter((p): p is string => Boolean(p));
}

function safeUserDataArtifact(): string | null {
  try {
    return path.join(app.getPath("userData"), ARTIFACT_DIRNAME, ARTIFACT_FILENAME);
  } catch {
    return null;
  }
}

function buildPhonemeIndex(labels: AcousticLabels): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < labels.labels.length; i += 1) {
    const label = labels.labels[i];
    if (label) out.set(label, i);
  }
  return out;
}

function logProbToScore(logProb: number): number {
  if (!Number.isFinite(logProb)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 + logProb * 18)));
}

export const _internal = {
  reset(): void {
    cachedInstance = null;
    loadAttempted = false;
    loadFailureReason = null;
  },
  locateWasmArtifact,
};
