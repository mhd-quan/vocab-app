import { stripStress } from "./g2p";
import type { AcousticFrame, PronunciationPhonemeScore } from "./types";

const BLANK = "<blank>";
const IMPOSSIBLE = Number.NEGATIVE_INFINITY;

export interface AlignmentResult {
  phonemes: PronunciationPhonemeScore[];
  averageLogProb: number;
}

export function ctcViterbiAlign({
  target,
  frames,
}: {
  target: string[];
  frames: AcousticFrame[];
}): AlignmentResult {
  if (target.length === 0 || frames.length === 0) {
    return { phonemes: [], averageLogProb: IMPOSSIBLE };
  }

  const labels = buildCtcLabels(target.map(stripStress));
  const cols = labels.length;
  const rows = frames.length;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(IMPOSSIBLE));
  const back = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  const firstFrame = frames[0];
  if (!firstFrame) return { phonemes: [], averageLogProb: IMPOSSIBLE };

  const firstDp = dp[0];
  if (!firstDp) return { phonemes: [], averageLogProb: IMPOSSIBLE };
  firstDp[0] = logProb(firstFrame, labels[0] ?? BLANK);
  if (cols > 1) firstDp[1] = logProb(firstFrame, labels[1] ?? BLANK);

  for (let t = 1; t < rows; t += 1) {
    for (let s = 0; s < cols; s += 1) {
      let bestPrev = s;
      let bestScore = dp[t - 1]?.[s] ?? IMPOSSIBLE;
      const prev1 = s > 0 ? (dp[t - 1]?.[s - 1] ?? IMPOSSIBLE) : IMPOSSIBLE;
      if (prev1 > bestScore) {
        bestScore = prev1;
        bestPrev = s - 1;
      }
      const skipAllowed =
        s > 1 && labels[s] !== BLANK && labels[s] !== labels[s - 2] && labels[s - 2] !== undefined;
      const prev2 = skipAllowed ? (dp[t - 1]?.[s - 2] ?? IMPOSSIBLE) : IMPOSSIBLE;
      if (prev2 > bestScore) {
        bestScore = prev2;
        bestPrev = s - 2;
      }
      const row = dp[t];
      const backRow = back[t];
      if (!row || !backRow) continue;
      row[s] = bestScore + logProb(frames[t] ?? firstFrame, labels[s] ?? BLANK);
      backRow[s] = bestPrev;
    }
  }

  let state = cols - 1;
  const finalAlt = cols - 2;
  if ((dp[rows - 1]?.[finalAlt] ?? IMPOSSIBLE) > (dp[rows - 1]?.[state] ?? IMPOSSIBLE)) {
    state = finalAlt;
  }

  const statePath: number[] = Array(rows).fill(0);
  for (let t = rows - 1; t >= 0; t -= 1) {
    statePath[t] = state;
    state = back[t]?.[state] ?? state;
  }

  const spans = target.map((phoneme, index) => {
    const labelIndex = index * 2 + 1;
    const frameIndexes = statePath
      .map((candidate, frameIndex) => (candidate === labelIndex ? frameIndex : -1))
      .filter((frameIndex) => frameIndex >= 0);
    const fallbackIndex = Math.min(
      frames.length - 1,
      Math.round((index / target.length) * frames.length),
    );
    const first = frameIndexes[0] ?? fallbackIndex;
    const last = frameIndexes.at(-1) ?? first;
    const frameSlice = frames.slice(first, last + 1);
    const avg =
      frameSlice.reduce((sum, frame) => sum + logProb(frame, stripStress(phoneme)), 0) /
      Math.max(1, frameSlice.length);
    const detected = mostLikely(frameSlice);
    const score = logProbToScore(avg);
    return {
      phoneme: stripStress(phoneme),
      expectedIndex: index,
      startMs: frames[first]?.timeMs ?? 0,
      endMs: (frames[last]?.timeMs ?? frames[first]?.timeMs ?? 0) + 20,
      score,
      detectedPhoneme: detected === BLANK ? null : detected,
      issue:
        score >= 76
          ? "ok"
          : detected && detected !== stripStress(phoneme)
            ? "substitution"
            : "weak",
    } satisfies PronunciationPhonemeScore;
  });

  const best = Math.max(
    dp[rows - 1]?.[cols - 1] ?? IMPOSSIBLE,
    dp[rows - 1]?.[cols - 2] ?? IMPOSSIBLE,
  );
  return { phonemes: spans, averageLogProb: best / rows };
}

function buildCtcLabels(target: string[]): string[] {
  const labels = [BLANK];
  for (const phoneme of target) labels.push(phoneme, BLANK);
  return labels;
}

function logProb(frame: AcousticFrame, phoneme: string): number {
  const exact = frame.logProbs[phoneme];
  if (typeof exact === "number") return exact;
  const blank = frame.logProbs[BLANK];
  return typeof blank === "number" ? blank - 6 : -14;
}

function mostLikely(frames: AcousticFrame[]): string | null {
  const totals = new Map<string, number>();
  for (const frame of frames) {
    for (const [label, value] of Object.entries(frame.logProbs)) {
      totals.set(label, (totals.get(label) ?? 0) + value);
    }
  }
  let best: string | null = null;
  let bestScore = IMPOSSIBLE;
  for (const [label, value] of totals) {
    if (value > bestScore) {
      best = label;
      bestScore = value;
    }
  }
  return best;
}

function logProbToScore(logProb: number): number {
  if (!Number.isFinite(logProb)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 + logProb * 18)));
}
