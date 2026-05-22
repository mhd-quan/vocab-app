import { z } from "zod";
import {
  DEFAULT_PRONUNCIATION_POLICY,
  type PronunciationScoringPolicy,
} from "../../../src/modules/pronunciation";
import { SETTINGS_KEYS } from "../../../src/modules/settings/keys";
import {
  assessPronunciation,
  previewPronunciation,
  pronunciationStatus,
  pronunciationTarget,
} from "../../pronunciation/runtime";
import { defineProcedure } from "../procedure";

const targetInput = z.object({
  text: z.string().min(1).max(160),
  ipa: z.string().max(160).nullable().optional(),
});

const assessInput = z.object({
  studentId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  targetText: z.string().min(1).max(160),
  ipa: z.string().max(160).nullable().optional(),
  audioPcm: z.array(z.number()).max(320_000).optional(),
  sampleRate: z.number().int().positive().max(96_000).optional(),
});

export const pronunciationProcedures = [
  defineProcedure({
    name: "pronunciation.status",
    input: z.void(),
    handler: () => pronunciationStatus(),
  }),

  defineProcedure({
    name: "pronunciation.target",
    input: targetInput,
    handler: (input) => pronunciationTarget(input),
  }),

  defineProcedure({
    name: "pronunciation.preview",
    input: targetInput,
    handler: (input) => previewPronunciation({ targetText: input.text, ipa: input.ipa }),
  }),

  defineProcedure({
    name: "pronunciation.assess",
    input: assessInput,
    handler: async (input, ctx) => {
      const result = await assessPronunciation(input, pronunciationPolicyFromSettings(ctx));
      if (!result.ok) return result;
      ctx.repos.evidence.recordEvent({
        studentId: input.studentId,
        sessionId: input.sessionId,
        kind: "pronunciation_assessment",
        severity: result.assessment.retryRequired ? "attention" : "info",
        durationMs: result.assessment.durationMs,
        payload: {
          targetText: input.targetText,
          ipa: input.ipa ?? null,
          backend: result.assessment.backend,
          executionProvider: result.assessment.executionProvider,
          modelUsed: result.assessment.modelUsed,
          overallScore: result.assessment.overallScore,
          phonemeScore: result.assessment.phonemeScore,
          stressScore: result.assessment.stressScore,
          passingScore: result.assessment.passingScore,
          errorRate: result.assessment.errorRate,
          retryRequired: result.assessment.retryRequired,
          guardrails: result.assessment.guardrails,
          audioQuality: result.assessment.audioQuality,
          feedback: result.assessment.feedback,
          phonemes: result.assessment.phonemes,
          stress: result.assessment.stress,
        },
      });
      return result;
    },
  }),
];

function pronunciationPolicyFromSettings(ctx: {
  repos: { settings: { get: <T = unknown>(key: string) => T | undefined } };
}): Partial<PronunciationScoringPolicy> {
  const maxErrorRate = numberSetting(
    ctx,
    SETTINGS_KEYS.pronunciationMaxErrorRate,
    DEFAULT_PRONUNCIATION_POLICY.maxErrorRate,
  );
  return {
    maxErrorRate,
    passingScore: Math.round((1 - maxErrorRate) * 100),
    minDurationMs: numberSetting(
      ctx,
      SETTINGS_KEYS.pronunciationMinDurationMs,
      DEFAULT_PRONUNCIATION_POLICY.minDurationMs,
    ),
    minRms: numberSetting(
      ctx,
      SETTINGS_KEYS.pronunciationMinRms,
      DEFAULT_PRONUNCIATION_POLICY.minRms,
    ),
  };
}

function numberSetting(
  ctx: { repos: { settings: { get: <T = unknown>(key: string) => T | undefined } } },
  key: string,
  fallback: number,
): number {
  const value = ctx.repos.settings.get(key);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
