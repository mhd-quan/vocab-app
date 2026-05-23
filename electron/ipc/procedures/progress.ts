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
  /** Caller-tracked: count of consecutive correct answers ending at this answer. */
  currentSessionRun: z.number().int().nonnegative().optional(),
  responseMs: z.number().int().nonnegative().optional(),
  /** ISO 8601 string. Optional — server clock if omitted. */
  occurredAtIso: z.string().datetime().optional(),
});

const recordContentAnswerInput = z.object({
  studentId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  contentItemId: z.number().int().positive(),
  outcome: outcomeSchema,
  currentSessionRun: z.number().int().nonnegative().optional(),
  responseMs: z.number().int().nonnegative().optional(),
  occurredAtIso: z.string().datetime().optional(),
});

const dueByLessonInput = z.object({
  studentId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  /** ISO 8601 — defaults to server `now`. */
  nowIso: z.string().datetime().optional(),
});

const seenEntryIdsByLessonInput = z.object({
  studentId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
});

const dueByStudentInput = z.object({
  studentId: z.number().int().positive(),
  nowIso: z.string().datetime().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

const weakItemsInput = z.object({
  studentId: z.number().int().positive(),
  minAttempts: z.number().int().nonnegative().max(1000).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const dailyActivityInput = z.object({
  studentId: z.number().int().positive(),
  sinceIso: z.string().datetime(),
  untilIso: z.string().datetime(),
});

const recentSessionsInput = z.object({
  studentId: z.number().int().positive(),
  limit: z.number().int().positive().max(100).optional(),
});

const sessionReportInput = z.object({
  sessionId: z.number().int().positive(),
});

const unitSessionsInput = z.object({
  studentId: z.number().int().positive(),
  unitId: z.number().int().positive(),
  limit: z.number().int().positive().max(100).optional(),
});

const tutorOverviewInput = z.object({
  nowIso: z.string().datetime().optional(),
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
        currentSessionRun: input.currentSessionRun,
        responseMs: input.responseMs,
        now,
      });
      return result;
    },
  }),

  defineProcedure({
    name: "progress.recordContentAnswer",
    input: recordContentAnswerInput,
    handler: (input, ctx) => {
      const outcome: GradeOutcome = {
        correct: input.outcome.correct,
        feedback: input.outcome.feedback,
        selfGrade: input.outcome.selfGrade,
        selectedIndex: input.outcome.selectedIndex,
      };
      const now = input.occurredAtIso ? new Date(input.occurredAtIso) : new Date();
      return ctx.repos.progress.recordContentAnswer({
        studentId: input.studentId,
        sessionId: input.sessionId,
        contentItemId: input.contentItemId,
        outcome,
        currentSessionRun: input.currentSessionRun,
        responseMs: input.responseMs,
        now,
      });
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
    name: "progress.seenEntryIdsByLesson",
    input: seenEntryIdsByLessonInput,
    handler: ({ studentId, lessonId }, ctx) =>
      ctx.repos.progress.seenEntryIdsByLesson({ studentId, lessonId }),
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

  defineProcedure({
    name: "progress.weakItems",
    input: weakItemsInput,
    handler: ({ studentId, minAttempts, limit }, ctx) =>
      ctx.repos.progress.weakItems({ studentId, minAttempts, limit }),
  }),

  defineProcedure({
    name: "progress.dailyActivity",
    input: dailyActivityInput,
    handler: ({ studentId, sinceIso, untilIso }, ctx) =>
      ctx.repos.progress.dailyActivity({
        studentId,
        since: new Date(sinceIso),
        until: new Date(untilIso),
      }),
  }),

  defineProcedure({
    name: "progress.recentSessions",
    input: recentSessionsInput,
    handler: ({ studentId, limit }, ctx) => ctx.repos.progress.recentSessions({ studentId, limit }),
  }),

  defineProcedure({
    name: "progress.unitReport",
    input: studentIdInput,
    handler: ({ studentId }, ctx) => ctx.repos.progress.unitReport({ studentId }),
  }),

  defineProcedure({
    name: "progress.unitSessions",
    input: unitSessionsInput,
    handler: ({ studentId, unitId, limit }, ctx) =>
      ctx.repos.progress.unitSessions({ studentId, unitId, limit }),
  }),

  defineProcedure({
    name: "progress.sessionReport",
    input: sessionReportInput,
    handler: ({ sessionId }, ctx) => ctx.repos.progress.sessionReport({ sessionId }),
  }),

  defineProcedure({
    name: "progress.tutorOverview",
    input: tutorOverviewInput,
    handler: ({ nowIso }, ctx) =>
      ctx.repos.progress.tutorOverview({ now: nowIso ? new Date(nowIso) : new Date() }),
  }),

  defineProcedure({
    name: "progress.fleetSnapshot",
    input: tutorOverviewInput,
    handler: ({ nowIso }, ctx) =>
      ctx.repos.progress.fleetSnapshot({ now: nowIso ? new Date(nowIso) : new Date() }),
  }),
];
