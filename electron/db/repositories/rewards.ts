import { asc, desc, eq } from "drizzle-orm";
import { itemProgress, learningEvents, studentAchievements } from "../../../src/data/schema";
import type { StudentAchievement } from "../../../src/data/types";
import {
  type AchievementStats,
  computeStreak,
  evaluateAchievements,
} from "../../../src/modules/rewards";
import type { AppDatabase, AppTransaction } from "../client";

export interface BuildStatsInput {
  studentId: number;
  /** Current in-session correct run, supplied by the SessionPlayer. */
  currentSessionRun?: number;
  now: Date;
}

export interface EvaluateInput extends BuildStatsInput {
  now: Date;
}

/**
 * All read paths can take either the top-level db handle or an open
 * transaction so the progress repo can call us inside its `recordAnswer`
 * critical section without re-entering.
 */
type Reader = AppDatabase | AppTransaction;

function buildStats(reader: Reader, input: BuildStatsInput): AchievementStats {
  const progressRows = reader
    .select({
      totalCorrect: itemProgress.totalCorrect,
      totalWrong: itemProgress.totalWrong,
    })
    .from(itemProgress)
    .where(eq(itemProgress.studentId, input.studentId))
    .all();
  let totalCorrect = 0;
  let totalWrong = 0;
  let distinctCorrect = 0;
  for (const r of progressRows) {
    totalCorrect += r.totalCorrect;
    totalWrong += r.totalWrong;
    if (r.totalCorrect > 0) distinctCorrect += 1;
  }

  const eventRows = reader
    .select({
      sessionId: learningEvents.sessionId,
      kind: learningEvents.kind,
      occurredAt: learningEvents.occurredAt,
      eventId: learningEvents.id,
    })
    .from(learningEvents)
    .where(eq(learningEvents.studentId, input.studentId))
    .orderBy(asc(learningEvents.occurredAt), asc(learningEvents.id))
    .all();
  const streak = computeStreak({
    eventTimestamps: eventRows.map((r) => r.occurredAt),
    now: input.now,
  });

  return {
    totalCorrect,
    distinctCorrect,
    totalAttempts: totalCorrect + totalWrong,
    currentStreak: streak.currentStreak,
    bestSessionRun: Math.max(input.currentSessionRun ?? 0, bestSessionRun(eventRows)),
  };
}

function bestSessionRun(
  rows: Array<{ sessionId: number | null; kind: string; occurredAt: Date; eventId: number }>,
): number {
  let best = 0;
  let currentSession: number | null = null;
  let currentRun = 0;

  for (const row of rows) {
    if (row.sessionId === null) {
      currentSession = null;
      currentRun = 0;
      continue;
    }
    if (row.sessionId !== currentSession) {
      currentSession = row.sessionId;
      currentRun = 0;
    }
    if (row.kind !== "answered_correct" && row.kind !== "answered_wrong") continue;
    currentRun = row.kind === "answered_correct" ? currentRun + 1 : 0;
    if (currentRun > best) best = currentRun;
  }

  return best;
}

/**
 * Insert any newly-earned achievements for the student. Idempotent: re-runs
 * on the same stats are no-ops because of `ON CONFLICT DO NOTHING`. Returns
 * just the freshly-inserted rows so the UI can pop a toast.
 */
function persistNewlyEarned(
  reader: Reader,
  studentId: number,
  earnedIds: string[],
  now: Date,
): StudentAchievement[] {
  if (earnedIds.length === 0) return [];
  const existing = reader
    .select({ id: studentAchievements.achievementId })
    .from(studentAchievements)
    .where(eq(studentAchievements.studentId, studentId))
    .all();
  const existingSet = new Set(existing.map((r) => r.id));
  const fresh = earnedIds.filter((id) => !existingSet.has(id));
  if (fresh.length === 0) return [];

  const inserted = reader
    .insert(studentAchievements)
    .values(fresh.map((id) => ({ studentId, achievementId: id, unlockedAt: now })))
    .onConflictDoNothing()
    .returning()
    .all();
  return inserted;
}

export function createRewardsRepository(db: AppDatabase) {
  return {
    /**
     * Read-only stats snapshot. Used by tutor UI + tests; the in-line
     * version inside `progress.recordAnswer` re-implements this against
     * its open transaction.
     */
    stats(input: BuildStatsInput): AchievementStats {
      return buildStats(db, input);
    },

    /** All currently-unlocked achievements for a student, newest first. */
    listUnlocked(studentId: number): StudentAchievement[] {
      return db
        .select()
        .from(studentAchievements)
        .where(eq(studentAchievements.studentId, studentId))
        .orderBy(desc(studentAchievements.unlockedAt), desc(studentAchievements.achievementId))
        .all();
    },

    /**
     * Daily streak summary for a student. Pure derivation from the
     * `learning_events` log — no caching, since the number of events is
     * tiny and an index covers the lookup.
     */
    streak({ studentId, now }: { studentId: number; now: Date }) {
      const eventRows = db
        .select({ occurredAt: learningEvents.occurredAt })
        .from(learningEvents)
        .where(eq(learningEvents.studentId, studentId))
        .all();
      return computeStreak({
        eventTimestamps: eventRows.map((r) => r.occurredAt),
        now,
      });
    },

    /**
     * Standalone evaluation entry-point. The progress repo uses the
     * inline helpers below (sharing its transaction); this is for
     * tutor-side recompute or tests.
     */
    evaluate(input: EvaluateInput): StudentAchievement[] {
      const stats = buildStats(db, input);
      const earned = evaluateAchievements(stats);
      return persistNewlyEarned(db, input.studentId, earned, input.now);
    },
  };
}

export type RewardsRepository = ReturnType<typeof createRewardsRepository>;

/**
 * Internal helpers exported for use inside `progress.recordAnswer` so
 * achievement evaluation runs inside the same transaction that wrote
 * the event + progress row.
 */
export const _internal = { buildStats, persistNewlyEarned };
