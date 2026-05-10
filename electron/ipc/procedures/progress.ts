import { z } from "zod";
import { practiceModes } from "../../../src/data/schema";
import { selfGrades } from "../../../src/modules/exercises";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { defineProcedure } from "../procedure";

const studentIdInput = z.object({ studentId: z.number().int().positive() });

const startSessionInput = z.object({
  studentId: z.number().int().positive(),
  mode: z.enum(practiceModes),
});

const endSessionInput = z.object({
  sessionId: z.number().int().positive(),
  summary: z.record(z.unknown()).nullable().optional(),
});

const outcomeSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
  selfGrade: z.enum(selfGrades).nullable(),
  selectedIndex: z.number().int().nullable(),
});

const recordAnswerInput = z.object({
  studentId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  entryId: z.number().int().positive(),
  outcome: outcomeSchema,
  /** ISO 8601 string. Optional — server clock if omitted. */
  occurredAtIso: z.string().datetime().optional(),
});

const dueByLessonInput = z.object({
  studentId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  /** ISO 8601 — defaults to server `now`. */
  nowIso: z.string().datetime().optional(),
});

const dueByStudentInput = z.object({
  studentId: z.number().int().positive(),
  nowIso: z.string().datetime().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const progressProcedures = [
  defineProcedure({
    name: "progress.startSession",
    input: startSessionInput,
    handler: ({ studentId, mode }, ctx) => ctx.repos.progress.startSession({ studentId, mode }),
  }),

  defineProcedure({
    name: "progress.endSession",
    input: endSessionInput,
    handler: ({ sessionId, summary }, ctx) => {
      ctx.repos.progress.endSession({ sessionId, summary: summary ?? null });
      return { ok: true } as const;
    },
  }),

  defineProcedure({
    name: "progress.recordAnswer",
    input: recordAnswerInput,
    handler: (input, ctx) => {
      const outcome: GradeOutcome = {
        correct: input.outcome.correct,
        feedback: input.outcome.feedback,
        selfGrade: input.outcome.selfGrade,
        selectedIndex: input.outcome.selectedIndex,
      };
      const now = input.occurredAtIso ? new Date(input.occurredAtIso) : new Date();
      const result = ctx.repos.progress.recordAnswer({
        studentId: input.studentId,
        sessionId: input.sessionId,
        entryId: input.entryId,
        outcome,
        now,
      });
      return result;
    },
  }),

  defineProcedure({
    name: "progress.dueByLesson",
    input: dueByLessonInput,
    handler: ({ studentId, lessonId, nowIso }, ctx) => {
      const now = nowIso ? new Date(nowIso) : new Date();
      return ctx.repos.progress.dueByLesson({ studentId, lessonId, now });
    },
  }),

  defineProcedure({
    name: "progress.dueByStudent",
    input: dueByStudentInput,
    handler: ({ studentId, nowIso, limit }, ctx) => {
      const now = nowIso ? new Date(nowIso) : new Date();
      return ctx.repos.progress.dueByStudent({ studentId, now, limit });
    },
  }),

  defineProcedure({
    name: "progress.studentSummary",
    input: studentIdInput,
    handler: ({ studentId }, ctx) =>
      ctx.repos.progress.studentSummary({ studentId, now: new Date() }),
  }),
];
