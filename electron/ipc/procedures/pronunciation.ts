import { z } from "zod";
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
      const result = await assessPronunciation(input);
      if (!result.ok) return result;
      ctx.repos.evidence.recordEvent({
        studentId: input.studentId,
        sessionId: input.sessionId,
        kind: "pronunciation_assessment",
        severity: result.assessment.overallScore < 65 ? "attention" : "info",
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
          feedback: result.assessment.feedback,
          phonemes: result.assessment.phonemes,
          stress: result.assessment.stress,
        },
      });
      return result;
    },
  }),
];
