import { ctcViterbiAlign } from "./ctc";
import { buildPronunciationTarget } from "./g2p";
import { scoreStress } from "./prosody";
import type {
  AcousticFrame,
  PronunciationAnalyzeInput,
  PronunciationAssessment,
  PronunciationBackend,
  PronunciationExecutionProvider,
  PronunciationRuntimeStatus,
} from "./types";

export type {
  AcousticFrame,
  PronunciationAnalyzeInput,
  PronunciationAssessment,
  PronunciationBackend,
  PronunciationExecutionProvider,
  PronunciationPhonemeScore,
  PronunciationRuntimeStatus,
  PronunciationStressScore,
  PronunciationTarget,
} from "./types";

export { ctcViterbiAlign } from "./ctc";
export { buildPronunciationTarget, stripStress } from "./g2p";
export { scoreStress } from "./prosody";

export function assessPronunciationFromFrames({
  input,
  frames,
  runtime,
  startedAt = Date.now(),
}: {
  input: PronunciationAnalyzeInput;
  frames: AcousticFrame[];
  runtime: PronunciationRuntimeStatus;
  startedAt?: number;
}): PronunciationAssessment {
  const target = buildPronunciationTarget(input.targetText, input.ipa);
  const alignment = ctcViterbiAlign({ target: target.phonemes, frames });
  const stress = scoreStress({
    stressPattern: target.stressPattern,
    audioPcm: input.audioPcm,
    sampleRate: input.sampleRate,
  });
  const phonemeScore =
    alignment.phonemes.length === 0
      ? 0
      : Math.round(
          alignment.phonemes.reduce((sum, phoneme) => sum + phoneme.score, 0) /
            alignment.phonemes.length,
        );
  const stressScore = stress.issue === "unavailable" ? null : stress.score;
  const overallScore = Math.round(phonemeScore * 0.78 + (stressScore ?? phonemeScore) * 0.22);

  return {
    target,
    backend: runtime.backend,
    executionProvider: runtime.executionProvider,
    modelUsed: runtime.modelPresent && runtime.backend !== "deterministic",
    durationMs: Math.max(0, Date.now() - startedAt),
    overallScore,
    phonemeScore,
    stressScore,
    phonemes: alignment.phonemes,
    stress,
    feedback: buildFeedback(alignment.phonemes, stress.issue),
  };
}

export function deterministicAcousticFrames(target: string[], frameMs = 20): AcousticFrame[] {
  const frames: AcousticFrame[] = [];
  for (const phoneme of target) {
    for (let i = 0; i < 4; i += 1) {
      const logProbs: Record<string, number> = { "<blank>": -5 };
      logProbs[phoneme] = i === 0 || i === 3 ? -1.4 : -0.22;
      frames.push({ timeMs: frames.length * frameMs, logProbs });
    }
    frames.push({
      timeMs: frames.length * frameMs,
      logProbs: { "<blank>": -0.12, [phoneme]: -2.5 },
    });
  }
  return frames;
}

export function defaultRuntimeStatus(
  backend: PronunciationBackend = "deterministic",
  executionProvider: PronunciationExecutionProvider = "cpu",
): PronunciationRuntimeStatus {
  return {
    available: backend === "deterministic",
    backend,
    executionProvider,
    platform: "test",
    arch: "test",
    modelPath: null,
    modelPresent: false,
    localOnly: true,
    reason: "No offline acoustic model is configured.",
  };
}

function buildFeedback(
  phonemes: PronunciationAssessment["phonemes"],
  stressIssue: PronunciationAssessment["stress"]["issue"],
): string[] {
  const feedback: string[] = [];
  const firstIssue = phonemes.find((phoneme) => phoneme.issue !== "ok");
  if (firstIssue) {
    feedback.push(
      firstIssue.detectedPhoneme && firstIssue.detectedPhoneme !== firstIssue.phoneme
        ? `Check /${firstIssue.phoneme}/: it sounded closer to /${firstIssue.detectedPhoneme}/.`
        : `Strengthen /${firstIssue.phoneme}/ and hold it a little more clearly.`,
    );
  }
  if (stressIssue === "flat") feedback.push("Add more energy to the stressed syllable.");
  if (stressIssue === "shifted") feedback.push("Move the strongest beat onto the marked syllable.");
  if (feedback.length === 0) feedback.push("Pronunciation is clear for this target.");
  return feedback;
}
