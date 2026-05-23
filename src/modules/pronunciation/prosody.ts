import type { PronunciationStressScore } from "./types";

export function scoreStress({
  stressPattern,
  audioPcm,
  sampleRate,
}: {
  stressPattern: Array<0 | 1 | 2 | null>;
  audioPcm?: ArrayLike<number>;
  sampleRate?: number;
}): PronunciationStressScore {
  if (!audioPcm || audioPcm.length === 0 || !sampleRate || sampleRate <= 0) {
    return {
      expectedStress: stressPattern,
      observedStress: stressPattern.map(() => null),
      score: 0,
      issue: "unavailable",
    };
  }

  const syllableIndexes = stressPattern
    .map((stress, index) => ({ stress, index }))
    .filter((item) => item.stress !== null);
  if (syllableIndexes.length === 0) {
    return {
      expectedStress: stressPattern,
      observedStress: stressPattern.map(() => null),
      score: 0,
      issue: "unavailable",
    };
  }

  const energies = splitEnergy(audioPcm, syllableIndexes.length);
  const maxEnergy = Math.max(...energies);
  const observedPrimary = energies.indexOf(maxEnergy);
  const expectedPrimary = Math.max(
    0,
    syllableIndexes.findIndex((item) => item.stress === 1),
  );
  const ratio = maxEnergy / Math.max(0.0001, average(energies));
  const score =
    observedPrimary === expectedPrimary
      ? Math.min(100, Math.round(68 + ratio * 18))
      : Math.max(35, Math.round(70 - Math.abs(observedPrimary - expectedPrimary) * 18));

  return {
    expectedStress: stressPattern,
    observedStress: stressPattern.map((stress, index) => {
      const syllableIndex = syllableIndexes.findIndex((item) => item.index === index);
      if (stress === null || syllableIndex < 0) return null;
      return syllableIndex === observedPrimary ? 1 : 0;
    }),
    score,
    issue: ratio < 1.12 ? "flat" : observedPrimary === expectedPrimary ? "ok" : "shifted",
  };
}

function splitEnergy(audioPcm: ArrayLike<number>, buckets: number): number[] {
  const out: number[] = [];
  const bucketSize = Math.max(1, Math.floor(audioPcm.length / buckets));
  for (let i = 0; i < buckets; i += 1) {
    const start = i * bucketSize;
    const end = i === buckets - 1 ? audioPcm.length : Math.min(audioPcm.length, start + bucketSize);
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      const sample = audioPcm[j] ?? 0;
      sum += sample * sample;
    }
    out.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  return out;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
