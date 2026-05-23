import type { PronunciationAudioQuality, PronunciationGuardrail } from "./types";

export interface PronunciationScoringPolicy {
  maxErrorRate: number;
  passingScore: number;
  minDurationMs: number;
  maxDurationMs: number;
  minRms: number;
  maxClippedRatio: number;
}

export interface PronunciationPolicyResult {
  passingScore: number;
  maxErrorRate: number;
  errorRate: number;
  retryRequired: boolean;
  passed: boolean;
  guardrails: PronunciationGuardrail[];
  audioQuality: PronunciationAudioQuality | null;
}

export const DEFAULT_PRONUNCIATION_POLICY: PronunciationScoringPolicy = {
  maxErrorRate: 0.3,
  passingScore: 70,
  minDurationMs: 600,
  maxDurationMs: 5_000,
  minRms: 0.012,
  maxClippedRatio: 0.025,
};

export function normalizePronunciationPolicy(
  input?: Partial<PronunciationScoringPolicy> | null,
): PronunciationScoringPolicy {
  const maxErrorRate = clampNumber(
    input?.maxErrorRate ?? DEFAULT_PRONUNCIATION_POLICY.maxErrorRate,
    0.05,
    0.8,
  );
  const passingScore = clampInt(
    input?.passingScore ?? Math.round((1 - maxErrorRate) * 100),
    20,
    95,
  );

  return {
    maxErrorRate,
    passingScore,
    minDurationMs: clampInt(
      input?.minDurationMs ?? DEFAULT_PRONUNCIATION_POLICY.minDurationMs,
      200,
      3_000,
    ),
    maxDurationMs: clampInt(
      input?.maxDurationMs ?? DEFAULT_PRONUNCIATION_POLICY.maxDurationMs,
      1_000,
      15_000,
    ),
    minRms: clampNumber(input?.minRms ?? DEFAULT_PRONUNCIATION_POLICY.minRms, 0.001, 0.08),
    maxClippedRatio: clampNumber(
      input?.maxClippedRatio ?? DEFAULT_PRONUNCIATION_POLICY.maxClippedRatio,
      0,
      0.2,
    ),
  };
}

export function evaluatePronunciationPolicy({
  overallScore,
  audioPcm,
  sampleRate,
  policy,
  enforceGuardrails = true,
}: {
  overallScore: number;
  audioPcm?: ArrayLike<number>;
  sampleRate?: number;
  policy?: Partial<PronunciationScoringPolicy> | null;
  enforceGuardrails?: boolean;
}): PronunciationPolicyResult {
  const normalizedPolicy = normalizePronunciationPolicy(policy);
  const audioQuality = audioQualityFromPcm(audioPcm, sampleRate);
  const errorRate = scoreToErrorRate(overallScore);
  const guardrails: PronunciationGuardrail[] = [];

  if (enforceGuardrails) {
    if (!audioQuality) {
      guardrails.push({
        code: "audio_missing",
        severity: "retry",
        message: "Record an attempt before checking pronunciation.",
      });
    } else {
      if (audioQuality.durationMs < normalizedPolicy.minDurationMs) {
        guardrails.push({
          code: "audio_too_short",
          severity: "retry",
          message: "The recording is too short. Try the word again and finish the whole sound.",
        });
      }
      if (audioQuality.rms < normalizedPolicy.minRms) {
        guardrails.push({
          code: "audio_too_quiet",
          severity: "retry",
          message: "The recording is too quiet. Move closer to the microphone and try again.",
        });
      }
      if (audioQuality.clippedRatio > normalizedPolicy.maxClippedRatio) {
        guardrails.push({
          code: "audio_clipped",
          severity: "retry",
          message: "The recording is distorted. Speak a little softer and try again.",
        });
      }
    }

    if (errorRate > normalizedPolicy.maxErrorRate || overallScore < normalizedPolicy.passingScore) {
      guardrails.push({
        code: "score_below_threshold",
        severity: "retry",
        message: `Score at least ${normalizedPolicy.passingScore} to pass this pronunciation target.`,
      });
    }
  }

  const retryRequired = guardrails.some((guardrail) => guardrail.severity === "retry");
  return {
    passingScore: normalizedPolicy.passingScore,
    maxErrorRate: normalizedPolicy.maxErrorRate,
    errorRate,
    retryRequired,
    passed: !retryRequired,
    guardrails,
    audioQuality,
  };
}

export function audioQualityFromPcm(
  audioPcm?: ArrayLike<number>,
  sampleRate?: number,
): PronunciationAudioQuality | null {
  if (!audioPcm || audioPcm.length === 0 || !sampleRate || sampleRate <= 0) return null;
  let sumSquares = 0;
  let peak = 0;
  let clipped = 0;
  let silent = 0;

  for (let i = 0; i < audioPcm.length; i += 1) {
    const sample = audioPcm[i] ?? 0;
    const value = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
    const abs = Math.abs(value);
    sumSquares += value * value;
    peak = Math.max(peak, abs);
    if (abs >= 0.985) clipped += 1;
    if (abs < 0.004) silent += 1;
  }

  return {
    durationMs: Math.round((audioPcm.length / sampleRate) * 1000),
    sampleRate,
    rms: round4(Math.sqrt(sumSquares / audioPcm.length)),
    peak: round4(peak),
    clippedRatio: round4(clipped / audioPcm.length),
    silentRatio: round4(silent / audioPcm.length),
  };
}

function scoreToErrorRate(score: number): number {
  return round4(clampNumber((100 - score) / 100, 0, 1));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
