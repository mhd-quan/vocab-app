import { stripStress } from "./g2p";
import type { AcousticFrame, AcousticLabels, PronunciationPhonemeScore } from "./types";

const BLANK_LABEL = "<blank>";
const IMPOSSIBLE = Number.NEGATIVE_INFINITY;
const LOG_PROB_FALLBACK = -14;
const BLANK_PENALTY = 6;

export interface AlignmentResult {
  phonemes: PronunciationPhonemeScore[];
  averageLogProb: number;
}

/**
 * CTC Viterbi alignment over a per-frame log-probability matrix.
 *
 * The DP table is flat (`Float32Array(rows * cols)`) and backtracking
 * indices live in an `Int32Array` — no nested-array allocs, no string
 * lookups in the inner loop. Both target phonemes and frame log-probs
 * are indexed by integers into `labels.labels`, which is the same ABI
 * the WASM port (Phase G) uses.
 */
export function ctcViterbiAlign({
  target,
  frames,
  labels,
}: {
  target: string[];
  frames: AcousticFrame[];
  labels: AcousticLabels;
}): AlignmentResult {
  if (target.length === 0 || frames.length === 0) {
    return { phonemes: [], averageLogProb: IMPOSSIBLE };
  }

  const phonemeIndex = buildPhonemeIndex(labels);
  const targetIndices = target.map((phoneme) => phonemeIndex.get(stripStress(phoneme)) ?? -1);
  const labelIndices = buildCtcLabelIndices(targetIndices, labels.blankIndex);
  const cols = labelIndices.length;
  const rows = frames.length;
  const firstFrame = frames[0];
  if (!firstFrame) return { phonemes: [], averageLogProb: IMPOSSIBLE };

  const dp = new Float32Array(rows * cols);
  const back = new Int32Array(rows * cols);
  dp.fill(IMPOSSIBLE);

  dp[0] = readLogProb(firstFrame, labelIndices[0] ?? labels.blankIndex, labels.blankIndex);
  if (cols > 1) {
    dp[1] = readLogProb(firstFrame, labelIndices[1] ?? labels.blankIndex, labels.blankIndex);
  }

  for (let t = 1; t < rows; t += 1) {
    const frame = frames[t] ?? firstFrame;
    const rowOffset = t * cols;
    const prevOffset = (t - 1) * cols;
    for (let s = 0; s < cols; s += 1) {
      let bestPrev = s;
      let bestScore = dp[prevOffset + s] ?? IMPOSSIBLE;
      const prev1 = s > 0 ? (dp[prevOffset + s - 1] ?? IMPOSSIBLE) : IMPOSSIBLE;
      if (prev1 > bestScore) {
        bestScore = prev1;
        bestPrev = s - 1;
      }
      const skipAllowed =
        s > 1 && labelIndices[s] !== labels.blankIndex && labelIndices[s] !== labelIndices[s - 2];
      const prev2 = skipAllowed ? (dp[prevOffset + s - 2] ?? IMPOSSIBLE) : IMPOSSIBLE;
      if (prev2 > bestScore) {
        bestScore = prev2;
        bestPrev = s - 2;
      }
      const labelIdx = labelIndices[s] ?? labels.blankIndex;
      dp[rowOffset + s] = bestScore + readLogProb(frame, labelIdx, labels.blankIndex);
      back[rowOffset + s] = bestPrev;
    }
  }

  let finalState = cols - 1;
  const finalAlt = cols - 2;
  if (
    finalAlt >= 0 &&
    (dp[(rows - 1) * cols + finalAlt] ?? IMPOSSIBLE) >
      (dp[(rows - 1) * cols + finalState] ?? IMPOSSIBLE)
  ) {
    finalState = finalAlt;
  }

  const statePath = new Int32Array(rows);
  let state = finalState;
  for (let t = rows - 1; t >= 0; t -= 1) {
    statePath[t] = state;
    state = back[t * cols + state] ?? state;
  }

  const phonemes = targetIndices.map((labelIdx, index) => {
    const ctcStateIdx = index * 2 + 1;
    let first = -1;
    let last = -1;
    for (let t = 0; t < rows; t += 1) {
      if (statePath[t] === ctcStateIdx) {
        if (first === -1) first = t;
        last = t;
      }
    }
    if (first === -1) {
      const fallback = Math.min(rows - 1, Math.round((index / target.length) * rows));
      first = fallback;
      last = fallback;
    }

    let sum = 0;
    for (let t = first; t <= last; t += 1) {
      const frame = frames[t];
      if (!frame) continue;
      sum += readLogProb(frame, labelIdx, labels.blankIndex);
    }
    const span = Math.max(1, last - first + 1);
    const avg = sum / span;
    const phoneme = stripStress(target[index] ?? "");
    const detected = mostLikelyLabel(frames, first, last, labels);
    const score = logProbToScore(avg);
    return {
      phoneme,
      expectedIndex: index,
      startMs: frames[first]?.timeMs ?? 0,
      endMs: (frames[last]?.timeMs ?? frames[first]?.timeMs ?? 0) + 20,
      score,
      detectedPhoneme: detected === BLANK_LABEL ? null : detected,
      issue: score >= 76 ? "ok" : detected && detected !== phoneme ? "substitution" : "weak",
    } satisfies PronunciationPhonemeScore;
  });

  const lastRow = (rows - 1) * cols;
  const best = Math.max(
    dp[lastRow + cols - 1] ?? IMPOSSIBLE,
    cols >= 2 ? (dp[lastRow + cols - 2] ?? IMPOSSIBLE) : IMPOSSIBLE,
  );
  return { phonemes, averageLogProb: best / rows };
}

function buildPhonemeIndex(labels: AcousticLabels): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < labels.labels.length; i += 1) {
    const label = labels.labels[i];
    if (label) out.set(label, i);
  }
  return out;
}

function buildCtcLabelIndices(targetIndices: number[], blankIndex: number): Int32Array {
  const out = new Int32Array(targetIndices.length * 2 + 1);
  out[0] = blankIndex;
  for (let i = 0; i < targetIndices.length; i += 1) {
    const target = targetIndices[i] ?? blankIndex;
    out[i * 2 + 1] = target >= 0 ? target : blankIndex;
    out[i * 2 + 2] = blankIndex;
  }
  return out;
}

function readLogProb(frame: AcousticFrame, labelIdx: number, blankIndex: number): number {
  if (labelIdx < 0 || labelIdx >= frame.logProbs.length) {
    const blank = frame.logProbs[blankIndex];
    return typeof blank === "number" ? blank - BLANK_PENALTY : LOG_PROB_FALLBACK;
  }
  const direct = frame.logProbs[labelIdx];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const blank = frame.logProbs[blankIndex];
  return typeof blank === "number" ? blank - BLANK_PENALTY : LOG_PROB_FALLBACK;
}

function mostLikelyLabel(
  frames: AcousticFrame[],
  first: number,
  last: number,
  labels: AcousticLabels,
): string | null {
  const labelCount = labels.labels.length;
  if (labelCount === 0) return null;
  const totals = new Float64Array(labelCount);
  for (let t = first; t <= last; t += 1) {
    const frame = frames[t];
    if (!frame) continue;
    for (let i = 0; i < labelCount; i += 1) {
      const value = frame.logProbs[i] ?? 0;
      totals[i] = (totals[i] ?? 0) + value;
    }
  }
  let bestIdx = -1;
  let bestScore = IMPOSSIBLE;
  for (let i = 0; i < labelCount; i += 1) {
    if ((totals[i] ?? IMPOSSIBLE) > bestScore) {
      bestIdx = i;
      bestScore = totals[i] ?? IMPOSSIBLE;
    }
  }
  return bestIdx >= 0 ? (labels.labels[bestIdx] ?? null) : null;
}

function logProbToScore(logProb: number): number {
  if (!Number.isFinite(logProb)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 + logProb * 18)));
}
