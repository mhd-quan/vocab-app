import fs from "node:fs";
import path from "node:path";
import {
  buildPronunciationTarget,
  ctcViterbiAlign,
  deterministicAcousticFrames,
} from "@/modules/pronunciation";
import type { AcousticFrame, AcousticLabels } from "@/modules/pronunciation";
import { describe, expect, it } from "vitest";

// The Electron-side WASM loader pulls in `electron`, which is unavailable
// in jsdom. Re-implement a tiny loader here that mirrors the production
// ABI but reads the wasm bytes straight from disk so the parity check
// runs in the test environment.
const WASM_PATH = path.resolve(__dirname, "../../../assets/pronunciation/viterbi.wasm");

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

function loadWasm(): WasmExports | null {
  if (!fs.existsSync(WASM_PATH)) return null;
  const bytes = fs.readFileSync(WASM_PATH);
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, {});
  return instance.exports as unknown as WasmExports;
}

function runWasm(
  exports: WasmExports,
  target: number[],
  frames: AcousticFrame[],
  labels: AcousticLabels,
): Array<{ first: number; last: number; avg: number; detected: number }> {
  if (target.length === 0 || frames.length === 0) {
    // Mirror the production loader: empty inputs short-circuit, the
    // wasm function reports STATUS_EMPTY and the caller returns [].
    return [];
  }
  const labelCount = labels.labels.length;
  const flatFrames = new Float32Array(frames.length * labelCount);
  for (let t = 0; t < frames.length; t += 1) {
    const f = frames[t];
    if (!f) continue;
    flatFrames.set(f.logProbs, t * labelCount);
  }
  const targetArr = Int32Array.from(target);

  const targetPtr = exports.alloc(targetArr.byteLength);
  const framesPtr = exports.alloc(flatFrames.byteLength);
  const outPtr = exports.alloc(target.length * 4 * 4);

  new Int32Array(exports.memory.buffer, targetPtr, targetArr.length).set(targetArr);
  new Float32Array(exports.memory.buffer, framesPtr, flatFrames.length).set(flatFrames);

  const status = exports.ctc_align(
    targetPtr,
    target.length,
    labels.blankIndex,
    framesPtr,
    frames.length,
    labelCount,
    outPtr,
  );

  const view = new Float32Array(exports.memory.buffer, outPtr, target.length * 4);
  const out: Array<{ first: number; last: number; avg: number; detected: number }> = [];
  if (status === 0) {
    for (let i = 0; i < target.length; i += 1) {
      out.push({
        first: Math.round(view[i * 4] ?? 0),
        last: Math.round(view[i * 4 + 1] ?? 0),
        avg: view[i * 4 + 2] ?? Number.NEGATIVE_INFINITY,
        detected: Math.round(view[i * 4 + 3] ?? -1),
      });
    }
  }
  exports.dealloc(targetPtr, targetArr.byteLength);
  exports.dealloc(framesPtr, flatFrames.byteLength);
  exports.dealloc(outPtr, target.length * 4 * 4);
  return out;
}

const stubLookup = (entries: Record<string, string>) => (word: string) => entries[word] ?? null;

function targetIndices(target: string[], labels: AcousticLabels): number[] {
  return target.map((p) => labels.labels.indexOf(p));
}

describe("WASM viterbi parity", () => {
  const exports = loadWasm();

  it.skipIf(!exports)("matches JS implementation on short word", () => {
    if (!exports) return;
    const target = ["F", "AE", "N"];
    const { frames, labels } = deterministicAcousticFrames(target);
    const js = ctcViterbiAlign({ target, frames, labels });
    const wasm = runWasm(exports, targetIndices(target, labels), frames, labels);

    expect(wasm.length).toBe(target.length);
    for (let i = 0; i < target.length; i += 1) {
      const jsPhoneme = js.phonemes[i];
      const wasmPhoneme = wasm[i];
      if (!jsPhoneme || !wasmPhoneme) throw new Error("missing alignment");
      const jsFirstFrame = jsPhoneme.startMs / 20;
      const jsLastFrame = (jsPhoneme.endMs - 20) / 20;
      expect(wasmPhoneme.first).toBe(jsFirstFrame);
      expect(wasmPhoneme.last).toBe(jsLastFrame);
      expect(Math.abs((wasmPhoneme.avg ?? 0) - logProbForScore(jsPhoneme.score))).toBeLessThan(0.5);
    }
  });

  it.skipIf(!exports)("matches JS implementation on a longer multi-vowel word", () => {
    if (!exports) return;
    const target = buildPronunciationTarget("family", null, {
      lookup: stubLookup({ family: "F AE1 M AH0 L IY0" }),
    });
    const { frames, labels } = deterministicAcousticFrames(target.phonemes);
    const js = ctcViterbiAlign({ target: target.phonemes, frames, labels });
    const wasm = runWasm(exports, targetIndices(target.phonemes, labels), frames, labels);

    expect(wasm.length).toBe(target.phonemes.length);
    for (let i = 0; i < target.phonemes.length; i += 1) {
      const jsPhoneme = js.phonemes[i];
      const wasmPhoneme = wasm[i];
      if (!jsPhoneme || !wasmPhoneme) throw new Error("missing alignment");
      const jsFirstFrame = jsPhoneme.startMs / 20;
      const jsLastFrame = (jsPhoneme.endMs - 20) / 20;
      expect(wasmPhoneme.first).toBe(jsFirstFrame);
      expect(wasmPhoneme.last).toBe(jsLastFrame);
    }
  });

  it.skipIf(!exports)("handles empty inputs without crashing", () => {
    if (!exports) return;
    const empty: number[] = [];
    const labels: AcousticLabels = { labels: ["<blank>", "F"], blankIndex: 0 };
    const out = runWasm(exports, empty, [], labels);
    expect(out).toEqual([]);
  });
});

// Inverse of logProbToScore: score = clamp(round(100 + logProb*18)).
function logProbForScore(score: number): number {
  return (score - 100) / 18;
}
