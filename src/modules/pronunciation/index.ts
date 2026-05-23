import { ctcViterbiAlign } from "./ctc";
import {
  type BuildPronunciationTargetOptions,
  buildPhrasePronunciationTarget,
  buildPronunciationTarget,
  stripStress,
} from "./g2p";
import { evaluatePronunciationPolicy } from "./policy";
import { scoreStress } from "./prosody";
import type {
  AcousticFrame,
  AcousticFrameSet,
  AcousticLabels,
  PronunciationAnalyzeInput,
  PronunciationAssessment,
  PronunciationBackend,
  PronunciationExecutionProvider,
  PronunciationRuntimeStatus,
} from "./types";

export type {
  AcousticFrame,
  AcousticFrameSet,
  AcousticLabels,
  PronunciationAnalyzeInput,
  PronunciationAssessment,
  PronunciationAudioQuality,
  PronunciationBackend,
  PronunciationExecutionProvider,
  PronunciationGuardrail,
  PronunciationGuardrailCode,
  PronunciationGuardrailSeverity,
  PronunciationPhonemeScore,
  PronunciationRuntimeStatus,
  PronunciationStressScore,
  PronunciationTarget,
} from "./types";

export { ctcViterbiAlign } from "./ctc";
export { buildPhrasePronunciationTarget, buildPronunciationTarget, stripStress } from "./g2p";
export type { BuildPronunciationTargetOptions } from "./g2p";
export { ARPABET_VOWELS, arpabetToIpa, isArpabetVowel, normalizeAcousticLabel } from "./labels";
export {
  PRONUNCIATION_MODEL_FAMILY,
  REQUIRED_PRONUNCIATION_LABELS,
  isPronunciationModelManifest,
  normalizeLabelMap,
  pronunciationLabelCoverage,
} from "./model";
export type {
  PronunciationLabelCoverage,
  PronunciationModelFamily,
  PronunciationModelManifest,
} from "./model";
export {
  DEFAULT_PRONUNCIATION_POLICY,
  audioQualityFromPcm,
  evaluatePronunciationPolicy,
  normalizePronunciationPolicy,
} from "./policy";
export type { PronunciationPolicyResult, PronunciationScoringPolicy } from "./policy";
export { scoreStress } from "./prosody";

export function assessPronunciationFromFrames({
  input,
  frames,
  labels,
  runtime,
  startedAt = Date.now(),
  enforcePolicy = true,
  policy,
  buildTargetOptions,
  align,
}: {
  input: PronunciationAnalyzeInput;
  frames: AcousticFrame[];
  labels: AcousticLabels;
  runtime: PronunciationRuntimeStatus;
  startedAt?: number;
  enforcePolicy?: boolean;
  policy?: Parameters<typeof evaluatePronunciationPolicy>[0]["policy"];
  buildTargetOptions?: BuildPronunciationTargetOptions;
  /**
   * Optional alignment override. When supplied (e.g. the Wasm Viterbi
   * loaded from `electron/pronunciation/wasm/loader.ts`), this replaces
   * the in-process JS Viterbi at `ctcViterbiAlign`. The contract is
   * identical — same inputs, same `AlignmentResult` shape.
   */
  align?: typeof ctcViterbiAlign;
}): PronunciationAssessment {
  const target = isMultiWord(input.targetText)
    ? buildPhrasePronunciationTarget(input.targetText, input.ipa, buildTargetOptions)
    : buildPronunciationTarget(input.targetText, input.ipa, buildTargetOptions);
  const alignFn = align ?? ctcViterbiAlign;
  const alignment = alignFn({ target: target.phonemes, frames, labels });
  const isPhraseTarget = (target.words?.length ?? 0) > 1;
  const stress = scoreStress({
    stressPattern: isPhraseTarget ? target.stressPattern.map(() => null) : target.stressPattern,
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
  const policyResult = evaluatePronunciationPolicy({
    overallScore,
    audioPcm: input.audioPcm,
    sampleRate: input.sampleRate,
    policy,
    enforceGuardrails: enforcePolicy,
  });

  return {
    target,
    backend: runtime.backend,
    executionProvider: runtime.executionProvider,
    modelUsed: runtime.modelPresent && runtime.backend !== "deterministic",
    durationMs: Math.max(0, Date.now() - startedAt),
    overallScore,
    phonemeScore,
    stressScore,
    passingScore: policyResult.passingScore,
    errorRate: policyResult.errorRate,
    retryRequired: policyResult.retryRequired,
    guardrails: policyResult.guardrails,
    audioQuality: policyResult.audioQuality,
    phonemes: alignment.phonemes,
    stress,
    feedback: buildFeedback(alignment.phonemes, stress.issue, policyResult.guardrails),
  };
}

/**
 * Produce synthetic frames + label table for the deterministic preview
 * path (no acoustic model). The label table mixes `<blank>` with every
 * unique target phoneme, indexed by integer — matching the shape real
 * acoustic frames take.
 */
export function deterministicAcousticFrames(target: string[], frameMs = 20): AcousticFrameSet {
  const stripped = target.map(stripStress);
  const uniquePhonemes = Array.from(new Set(stripped));
  const labels: AcousticLabels = {
    labels: ["<blank>", ...uniquePhonemes],
    blankIndex: 0,
  };
  const phonemeIndex = new Map<string, number>();
  for (let i = 0; i < labels.labels.length; i += 1) {
    const label = labels.labels[i];
    if (label) phonemeIndex.set(label, i);
  }
  const labelCount = labels.labels.length;

  const frames: AcousticFrame[] = [];
  for (const phoneme of stripped) {
    const idx = phonemeIndex.get(phoneme) ?? labels.blankIndex;
    for (let i = 0; i < 4; i += 1) {
      const buf = new Float32Array(labelCount);
      buf.fill(-9);
      buf[labels.blankIndex] = -5;
      buf[idx] = i === 0 || i === 3 ? -1.4 : -0.22;
      frames.push({ timeMs: frames.length * frameMs, logProbs: buf });
    }
    const trail = new Float32Array(labelCount);
    trail.fill(-9);
    trail[labels.blankIndex] = -0.12;
    trail[idx] = -2.5;
    frames.push({ timeMs: frames.length * frameMs, logProbs: trail });
  }
  return { frames, labels };
}

export function defaultRuntimeStatus(
  backend: PronunciationBackend = "deterministic",
  executionProvider: PronunciationExecutionProvider = "cpu",
): PronunciationRuntimeStatus {
  return {
    available: backend === "deterministic",
    backend,
    executionProvider,
    modelFamily: "hubert",
    modelId: null,
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
  guardrails: PronunciationAssessment["guardrails"] = [],
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
  for (const guardrail of guardrails) feedback.push(guardrail.message);
  if (feedback.length === 0) feedback.push("Pronunciation is clear for this target.");
  return feedback;
}

function isMultiWord(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length > 1;
}
