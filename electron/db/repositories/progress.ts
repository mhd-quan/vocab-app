import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import {
  type LearningEventKind,
  type PracticeMode,
  appSettings,
  contentItems,
  itemProgress,
  learningEvents,
  lessons,
  practiceSessions,
  students,
  units,
  vocabEntries,
} from "../../../src/data/schema";
import type {
  ItemProgress,
  LearningEvent,
  PracticeSession,
  Student,
  StudentAchievement,
} from "../../../src/data/types";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { evaluateAchievements } from "../../../src/modules/rewards";
import { fsrs } from "../../../src/modules/srs";
import type { AppDatabase, AppTransaction } from "../client";
import { _internal as rewardsInternal } from "./rewards";

const FSRS_SHORT_TERM_KEY = "fsrs_short_term_days";
const FSRS_LONG_TERM_KEY = "fsrs_long_term_days";

/**
 * Read tutor-tunable FSRS thresholds out of `app_settings`. Returns the
 * library defaults if either value is missing or malformed — we never
 * fail a review write just because settings haven't been seeded.
 */
function loadFsrsThresholds(tx: AppTransaction): fsrs.FsrsThresholds {
  const rows = tx
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [FSRS_SHORT_TERM_KEY, FSRS_LONG_TERM_KEY]))
    .all();
  const lookup = new Map(rows.map((row) => [row.key, row.value]));
  const shortTerm = numericSetting(lookup.get(FSRS_SHORT_TERM_KEY));
  const longTerm = numericSetting(lookup.get(FSRS_LONG_TERM_KEY));
  return {
    shortTermDays: shortTerm ?? fsrs.DEFAULT_THRESHOLDS.shortTermDays,
    longTermDays: longTerm ?? fsrs.DEFAULT_THRESHOLDS.longTermDays,
  };
}

function numericSetting(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export interface StartSessionInput {
  studentId: number;
  mode: PracticeMode;
}

export interface EndSessionInput {
  sessionId: number;
  summary?: Record<string, unknown> | null;
}

export interface RecordAnswerInput {
  studentId: number;
  sessionId: number;
  /** vocab_entries.id — we resolve it to a content_items row internally. */
  entryId: number;
  outcome: GradeOutcome;
  /**
   * In-session correct streak ending at this answer (0 if this answer was
   * wrong). The SessionPlayer tracks it client-side; we use it to
   * evaluate "N in a row" achievements without re-walking the event log.
   */
  currentSessionRun?: number;
  /** Caller-controlled clock (defaults to `new Date()`). Tests inject a fixed Date. */
  now?: Date;
}

export interface RecordContentAnswerInput {
  studentId: number;
  sessionId: number;
  /** content_items.id — supports grammar_topic and future exercise rows. */
  contentItemId: number;
  outcome: GradeOutcome;
  currentSessionRun?: number;
  now?: Date;
}

export interface RecordAnswerResult {
  event: LearningEvent;
  progress: ItemProgress;
  /**
   * Achievements that became unlocked as a result of this answer. Empty
   * on every call until a threshold is crossed.
   */
  unlockedAchievements: StudentAchievement[];
}

export interface DueLessonStats {
  totalCount: number;
  dueCount: number;
  newCount: number;
}

export interface DueItem {
  contentItemId: number;
  entryId: number;
  lessonId: number;
  headword: string;
  nextDueAt: Date | null;
}

export interface WeakItem {
  entryId: number;
  contentItemId: number;
  lessonId: number;
  bookId: number;
  headword: string;
  pos: string;
  totalCorrect: number;
  totalWrong: number;
  /** correct / (correct + wrong); 0..1, lower is weaker. */
  accuracy: number;
  lastSeenAt: Date | null;
}

export interface DailyActivityCell {
  /** Local-day timestamp at midnight (caller decides timezone — we store ms). */
  bucketStart: Date;
  count: number;
}

export interface RecentSessionRow {
  sessionId: number;
  mode: PracticeMode;
  startedAt: Date;
  endedAt: Date | null;
  totalAnswered: number;
  totalCorrect: number;
}

export interface TutorOverviewRow {
  student: Student;
  totalSeen: number;
  totalDue: number;
  accuracy: number;
  lastPracticedAt: Date | null;
}

/**
 * All practice-time writes live here. Reads stay narrow on purpose: the
 * tutor analytics screen will sit on top of this in a later PR, so we
 * avoid baking complex aggregations until we know exactly what we need.
 */
export function createProgressRepository(db: AppDatabase) {
  const contentItemForEntry = (entryId: number): { id: number; lessonId: number } | null => {
    const row = db
      .select({ id: contentItems.id, lessonId: contentItems.lessonId })
      .from(contentItems)
      .where(and(eq(contentItems.refTable, "vocab_entries"), eq(contentItems.refId, entryId)))
      .get();
    return row ?? null;
  };

  const contentItemForGrammarTopic = (topicId: number): { id: number; lessonId: number } | null => {
    const row = db
      .select({ id: contentItems.id, lessonId: contentItems.lessonId })
      .from(contentItems)
      .where(and(eq(contentItems.refTable, "grammar_topics"), eq(contentItems.refId, topicId)))
      .get();
    return row ?? null;
  };

  const recordResolvedAnswer = (input: RecordContentAnswerInput): RecordAnswerResult => {
    const now = input.now ?? new Date();
    return db.transaction((tx) => {
      const itemRow = tx
        .select({ id: contentItems.id, lessonId: contentItems.lessonId })
        .from(contentItems)
        .where(eq(contentItems.id, input.contentItemId))
        .get();
      if (!itemRow) {
        throw new Error(`No content_items row for id ${input.contentItemId} — re-run import?`);
      }

      const kind: LearningEventKind = input.outcome.correct ? "answered_correct" : "answered_wrong";

      const event = tx
        .insert(learningEvents)
        .values({
          studentId: input.studentId,
          contentItemId: itemRow.id,
          sessionId: input.sessionId,
          kind,
          payload: {
            correct: input.outcome.correct,
            selfGrade: input.outcome.selfGrade,
            selectedIndex: input.outcome.selectedIndex,
          },
          occurredAt: now,
        })
        .returning()
        .get();
      if (!event) throw new Error("Failed to insert learning_event");

      const prevRow = tx
        .select()
        .from(itemProgress)
        .where(
          and(
            eq(itemProgress.studentId, input.studentId),
            eq(itemProgress.contentItemId, itemRow.id),
          ),
        )
        .get();

      const thresholds = loadFsrsThresholds(tx);
      const rating = fsrs.ratingFromOutcome(input.outcome);
      const next = fsrs.applyAnswer({
        prev: prevRow
          ? {
              stability: prevRow.stability,
              difficulty: prevRow.difficulty,
              state: prevRow.state,
              reps: prevRow.reps,
              lapses: prevRow.lapses,
            }
          : null,
        rating,
        now,
        thresholds,
      });

      const progressValues = {
        studentId: input.studentId,
        contentItemId: itemRow.id,
        track: prevRow?.track ?? ("curated" as const),
        stability: next.stability,
        difficulty: next.difficulty,
        state: next.state,
        reps: next.reps,
        lapses: next.lapses,
        lastSeenAt: next.lastReviewedAt,
        nextDueAt: next.dueAt,
        totalCorrect: (prevRow?.totalCorrect ?? 0) + (input.outcome.correct ? 1 : 0),
        totalWrong: (prevRow?.totalWrong ?? 0) + (input.outcome.correct ? 0 : 1),
        currentStageKind: prevRow?.currentStageKind ?? null,
        updatedAt: now,
      };

      const progress = tx
        .insert(itemProgress)
        .values(progressValues)
        .onConflictDoUpdate({
          target: [itemProgress.studentId, itemProgress.contentItemId],
          set: {
            stability: progressValues.stability,
            difficulty: progressValues.difficulty,
            state: progressValues.state,
            reps: progressValues.reps,
            lapses: progressValues.lapses,
            lastSeenAt: progressValues.lastSeenAt,
            nextDueAt: progressValues.nextDueAt,
            totalCorrect: progressValues.totalCorrect,
            totalWrong: progressValues.totalWrong,
            updatedAt: progressValues.updatedAt,
          },
        })
        .returning()
        .get();
      if (!progress) throw new Error("Failed to upsert item_progress");

      let unlockedAchievements: StudentAchievement[] = [];
      if (input.outcome.correct) {
        const stats = rewardsInternal.buildStats(tx, {
          studentId: input.studentId,
          currentSessionRun: input.currentSessionRun,
          now,
        });
        const earned = evaluateAchievements(stats);
        unlockedAchievements = rewardsInternal.persistNewlyEarned(tx, input.studentId, earned, now);
      }

      return { event, progress, unlockedAchievements };
    });
  };

  return {
    startSession({ studentId, mode }: StartSessionInput): PracticeSession {
      const row = db.insert(practiceSessions).values({ studentId, mode }).returning().get();
      if (!row) throw new Error("Failed to insert practice_session");
      return row;
    },

    endSession({ sessionId, summary }: EndSessionInput): void {
      db.update(practiceSessions)
        .set({ endedAt: new Date(), summary: summary ?? null })
        .where(eq(practiceSessions.id, sessionId))
        .run();
    },

    /**
     * Look up the `content_items` row for a vocab entry. There's exactly
     * one (the import pipeline creates it on first insert).
     */
    contentItemForEntry,

    contentItemForGrammarTopic,

    /**
     * Persist an answered exercise: append a `learning_events` row and
     * upsert the matching `item_progress` row using the SM-2 scheduler.
     * The whole thing runs in a transaction so the event log and the
     * materialised progress stay consistent.
     */
    recordAnswer(input: RecordAnswerInput): RecordAnswerResult {
      const itemRow = contentItemForEntry(input.entryId);
      if (!itemRow) {
        throw new Error(`No content_items row for vocab entry ${input.entryId} — re-run import?`);
      }
      return recordResolvedAnswer({
        studentId: input.studentId,
        sessionId: input.sessionId,
        contentItemId: itemRow.id,
        outcome: input.outcome,
        currentSessionRun: input.currentSessionRun,
        now: input.now,
      });
    },

    recordContentAnswer(input: RecordContentAnswerInput): RecordAnswerResult {
      return recordResolvedAnswer(input);
    },

    /**
     * Per-lesson aggregate: how many entries exist, how many are due now,
     * and how many haven't been seen yet (for the "new" badge in
     * student home).
     */
    dueByLesson({
      studentId,
      lessonId,
      now,
    }: {
      studentId: number;
      lessonId: number;
      now: Date;
    }): DueLessonStats {
      const lessonItems = db
        .select({ id: contentItems.id })
        .from(contentItems)
        .where(eq(contentItems.lessonId, lessonId))
        .all();
      const totalCount = lessonItems.length;
      if (totalCount === 0) {
        return { totalCount: 0, dueCount: 0, newCount: 0 };
      }
      const seenRows = db
        .select({ contentItemId: itemProgress.contentItemId, nextDueAt: itemProgress.nextDueAt })
        .from(itemProgress)
        .where(eq(itemProgress.studentId, studentId))
        .all();
      const seenMap = new Map(seenRows.map((r) => [r.contentItemId, r.nextDueAt]));

      let dueCount = 0;
      let newCount = 0;
      for (const item of lessonItems) {
        const dueAt = seenMap.get(item.id);
        if (dueAt === undefined) {
          newCount += 1;
          continue;
        }
        if (dueAt === null || dueAt.getTime() <= now.getTime()) {
          dueCount += 1;
        }
      }
      return { totalCount, dueCount, newCount };
    },

    /**
     * Vocab entries in a lesson that already have a progress snapshot for
     * this student. StudentSession uses this to keep brand-new entries in a
     * flashcard-first intro phase before recognition drills.
     */
    seenEntryIdsByLesson({
      studentId,
      lessonId,
    }: {
      studentId: number;
      lessonId: number;
    }): number[] {
      const rows = db
        .select({ entryId: vocabEntries.id })
        .from(itemProgress)
        .innerJoin(contentItems, eq(itemProgress.contentItemId, contentItems.id))
        .innerJoin(vocabEntries, eq(contentItems.refId, vocabEntries.id))
        .where(
          and(
            eq(itemProgress.studentId, studentId),
            eq(contentItems.refTable, "vocab_entries"),
            eq(contentItems.lessonId, lessonId),
            eq(vocabEntries.lessonId, lessonId),
          ),
        )
        .orderBy(asc(vocabEntries.id))
        .all();
      return rows.map((row) => row.entryId);
    },

    /**
     * Items currently due for a student across the whole curriculum.
     * Sorted oldest-due-first; a NULL `next_due_at` (just-inserted
     * brand-new) is treated as "due now".
     */
    dueByStudent({
      studentId,
      now,
      limit = 100,
    }: {
      studentId: number;
      now: Date;
      limit?: number;
    }): DueItem[] {
      const rows = db
        .select({
          contentItemId: itemProgress.contentItemId,
          entryId: vocabEntries.id,
          lessonId: vocabEntries.lessonId,
          headword: vocabEntries.headword,
          nextDueAt: itemProgress.nextDueAt,
        })
        .from(itemProgress)
        .innerJoin(contentItems, eq(itemProgress.contentItemId, contentItems.id))
        .innerJoin(vocabEntries, eq(contentItems.refId, vocabEntries.id))
        .where(
          and(
            eq(itemProgress.studentId, studentId),
            eq(contentItems.refTable, "vocab_entries"),
            or(isNull(itemProgress.nextDueAt), lte(itemProgress.nextDueAt, now)),
          ),
        )
        .orderBy(sql`coalesce(${itemProgress.nextDueAt}, 0) asc`)
        .limit(limit)
        .all();
      return rows;
    },

    /**
     * Top-N weakest items for a student: lowest accuracy first, ties
     * broken by most-recently-seen so a stale-but-bad word doesn't
     * crowd out a fresh one. We filter by `minAttempts` so a single
     * unlucky guess on a brand-new word doesn't immediately surface.
     *
     * Returned rows include the curriculum path (lessonId, bookId)
     * so the analytics screen can deep-link straight into the
     * Content browser.
     */
    weakItems({
      studentId,
      minAttempts = 3,
      limit = 10,
    }: {
      studentId: number;
      minAttempts?: number;
      limit?: number;
    }): WeakItem[] {
      const totalAttempts = sql<number>`(${itemProgress.totalCorrect} + ${itemProgress.totalWrong})`;
      const accuracySql = sql<number>`CAST(${itemProgress.totalCorrect} AS REAL) / NULLIF(${totalAttempts}, 0)`;
      const rows = db
        .select({
          entryId: vocabEntries.id,
          contentItemId: itemProgress.contentItemId,
          lessonId: vocabEntries.lessonId,
          bookId: units.bookId,
          headword: vocabEntries.headword,
          pos: vocabEntries.pos,
          totalCorrect: itemProgress.totalCorrect,
          totalWrong: itemProgress.totalWrong,
          accuracy: accuracySql,
          lastSeenAt: itemProgress.lastSeenAt,
        })
        .from(itemProgress)
        .innerJoin(contentItems, eq(itemProgress.contentItemId, contentItems.id))
        .innerJoin(vocabEntries, eq(contentItems.refId, vocabEntries.id))
        .innerJoin(lessons, eq(vocabEntries.lessonId, lessons.id))
        .innerJoin(units, eq(lessons.unitId, units.id))
        .where(
          and(
            eq(itemProgress.studentId, studentId),
            eq(contentItems.refTable, "vocab_entries"),
            gte(totalAttempts, minAttempts),
          ),
        )
        .orderBy(asc(accuracySql), desc(itemProgress.lastSeenAt), asc(vocabEntries.headword))
        .limit(limit)
        .all();
      // Drizzle hands us NULL accuracy when totalAttempts === 0, but the
      // gte() clause above excludes those rows. Coerce defensively so the
      // type matches `WeakItem.accuracy: number`.
      return rows.map((r) => ({
        ...r,
        pos: r.pos ?? "",
        accuracy: r.accuracy ?? 0,
      }));
    },

    /**
     * Per-day learning-event counts inside a window. Cheap path: pull
     * timestamps for the student between `since` and `until`, bucket by
     * local-calendar day in JS — SQLite's `date()` is UTC-only, and we
     * want the tutor's local day boundaries.
     *
     * Returned cells are dense over the requested window (one per day,
     * gaps zero-filled), sorted ascending.
     */
    dailyActivity({
      studentId,
      since,
      until,
    }: {
      studentId: number;
      since: Date;
      until: Date;
    }): DailyActivityCell[] {
      if (until.getTime() < since.getTime()) return [];
      const rows = db
        .select({ occurredAt: learningEvents.occurredAt })
        .from(learningEvents)
        .where(
          and(
            eq(learningEvents.studentId, studentId),
            gte(learningEvents.occurredAt, since),
            lte(learningEvents.occurredAt, until),
          ),
        )
        .all();

      const bucket = new Map<number, number>();
      for (const r of rows) {
        const d = r.occurredAt;
        const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        bucket.set(key, (bucket.get(key) ?? 0) + 1);
      }

      const cells: DailyActivityCell[] = [];
      const start = new Date(since.getFullYear(), since.getMonth(), since.getDate());
      const end = new Date(until.getFullYear(), until.getMonth(), until.getDate());
      const dayMs = 86_400_000;
      for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
        cells.push({ bucketStart: new Date(t), count: bucket.get(t) ?? 0 });
      }
      return cells;
    },

    /**
     * Last N sessions for a student, with answered/correct totals
     * derived from the event log. We use a separate aggregation query
     * + a JS join because Drizzle's typed `groupBy` interaction with
     * `inArray` over a sub-select gets unwieldy for two columns.
     */
    recentSessions({
      studentId,
      limit = 10,
    }: {
      studentId: number;
      limit?: number;
    }): RecentSessionRow[] {
      const sessionRows = db
        .select({
          id: practiceSessions.id,
          mode: practiceSessions.mode,
          startedAt: practiceSessions.startedAt,
          endedAt: practiceSessions.endedAt,
        })
        .from(practiceSessions)
        .where(eq(practiceSessions.studentId, studentId))
        .orderBy(desc(practiceSessions.startedAt), desc(practiceSessions.id))
        .limit(limit)
        .all();
      if (sessionRows.length === 0) return [];

      const ids = sessionRows.map((s) => s.id);
      const aggRows = db
        .select({
          sessionId: learningEvents.sessionId,
          kind: learningEvents.kind,
          n: sql<number>`count(*)`.as("n"),
        })
        .from(learningEvents)
        .where(and(isNotNull(learningEvents.sessionId), inArray(learningEvents.sessionId, ids)))
        .groupBy(learningEvents.sessionId, learningEvents.kind)
        .all();

      const totals = new Map<number, { answered: number; correct: number }>();
      for (const row of aggRows) {
        if (row.sessionId === null) continue;
        const cur = totals.get(row.sessionId) ?? { answered: 0, correct: 0 };
        if (row.kind === "answered_correct") {
          cur.answered += row.n;
          cur.correct += row.n;
        } else if (row.kind === "answered_wrong") {
          cur.answered += row.n;
        }
        totals.set(row.sessionId, cur);
      }

      return sessionRows.map((s) => {
        const t = totals.get(s.id) ?? { answered: 0, correct: 0 };
        return {
          sessionId: s.id,
          mode: s.mode,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          totalAnswered: t.answered,
          totalCorrect: t.correct,
        };
      });
    },

    /**
     * Tutor-side fan-out: one row per active student with the same
     * fields the dashboard table renders. Active = `archivedAt IS NULL`.
     * Sorted by display name, then created order, so the table is
     * stable across renders.
     */
    tutorOverview({ now }: { now: Date }): TutorOverviewRow[] {
      const studentRows = db
        .select()
        .from(students)
        .where(isNull(students.archivedAt))
        .orderBy(asc(students.name), asc(students.id))
        .all();
      if (studentRows.length === 0) return [];

      // One pass of item_progress for all active students; bucket in JS.
      const ids = studentRows.map((s) => s.id);
      const progressRows = db
        .select({
          studentId: itemProgress.studentId,
          totalCorrect: itemProgress.totalCorrect,
          totalWrong: itemProgress.totalWrong,
          nextDueAt: itemProgress.nextDueAt,
          lastSeenAt: itemProgress.lastSeenAt,
        })
        .from(itemProgress)
        .where(inArray(itemProgress.studentId, ids))
        .all();

      const stats = new Map<
        number,
        {
          totalSeen: number;
          totalCorrect: number;
          totalWrong: number;
          totalDue: number;
          lastPracticedAt: Date | null;
        }
      >();
      for (const id of ids) {
        stats.set(id, {
          totalSeen: 0,
          totalCorrect: 0,
          totalWrong: 0,
          totalDue: 0,
          lastPracticedAt: null,
        });
      }
      for (const r of progressRows) {
        const cur = stats.get(r.studentId);
        if (!cur) continue;
        cur.totalSeen += 1;
        cur.totalCorrect += r.totalCorrect;
        cur.totalWrong += r.totalWrong;
        if (r.nextDueAt === null || r.nextDueAt.getTime() <= now.getTime()) {
          cur.totalDue += 1;
        }
        if (r.lastSeenAt) {
          if (!cur.lastPracticedAt || r.lastSeenAt.getTime() > cur.lastPracticedAt.getTime()) {
            cur.lastPracticedAt = r.lastSeenAt;
          }
        }
      }

      return studentRows.map((student) => {
        const s = stats.get(student.id);
        const totalCorrect = s?.totalCorrect ?? 0;
        const totalWrong = s?.totalWrong ?? 0;
        const totalAttempts = totalCorrect + totalWrong;
        return {
          student,
          totalSeen: s?.totalSeen ?? 0,
          totalDue: s?.totalDue ?? 0,
          accuracy: totalAttempts === 0 ? 0 : totalCorrect / totalAttempts,
          lastPracticedAt: s?.lastPracticedAt ?? null,
        };
      });
    },

    /** Coarse student-wide stats used by tutor / student summary cards. */
    studentSummary({ studentId, now }: { studentId: number; now: Date }) {
      const seen = db
        .select({
          totalCorrect: itemProgress.totalCorrect,
          totalWrong: itemProgress.totalWrong,
          nextDueAt: itemProgress.nextDueAt,
        })
        .from(itemProgress)
        .where(eq(itemProgress.studentId, studentId))
        .all();
      const totalSeen = seen.length;
      const totalCorrect = seen.reduce((sum, r) => sum + r.totalCorrect, 0);
      const totalWrong = seen.reduce((sum, r) => sum + r.totalWrong, 0);
      const totalAttempts = totalCorrect + totalWrong;
      const accuracy = totalAttempts === 0 ? 0 : totalCorrect / totalAttempts;
      const totalDue = seen.filter(
        (r) => r.nextDueAt === null || r.nextDueAt.getTime() <= now.getTime(),
      ).length;
      return { totalSeen, totalCorrect, totalWrong, accuracy, totalDue };
    },
  };
}

export type ProgressRepository = ReturnType<typeof createProgressRepository>;
