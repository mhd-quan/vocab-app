import { z } from "zod";
import { defineProcedure } from "../procedure";

const studentIdInput = z.object({ studentId: z.number().int().positive() });

const streakInput = z.object({
  studentId: z.number().int().positive(),
  /** ISO 8601 — defaults to server `now`. */
  nowIso: z.string().datetime().optional(),
});

export const rewardsProcedures = [
  defineProcedure({
    name: "rewards.listUnlocked",
    input: studentIdInput,
    handler: ({ studentId }, ctx) => ctx.repos.rewards.listUnlocked(studentId),
  }),

  defineProcedure({
    name: "rewards.streak",
    input: streakInput,
    handler: ({ studentId, nowIso }, ctx) => {
      const now = nowIso ? new Date(nowIso) : new Date();
      return ctx.repos.rewards.streak({ studentId, now });
    },
  }),
];
