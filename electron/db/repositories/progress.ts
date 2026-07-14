import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import {
  type LearningEventKind,
  type PracticeMode,
  appSettings,
  books,
  contentItems,
  itemProgress,
  learningEvents,
  lessons,
  practiceSessions,
  students,
  unitAssignments,
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
import {
  computeStreak,
  computeStudentXp,
  evaluateAchievements,
} from "../../../src/modules/rewards";
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
  /** Time from prompt render to submitted/self-graded answer. */
  responseMs?: number;
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
  responseMs?: number;
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

/**
 * Truthful learning-state counts for one assigned curriculum scope.
 *
 * `new`, `learning`, and `secure` are the durable mastery buckets. `due`
 * and `current` split the introduced items by scheduling time, while the
 * four *Learning/*Secure breakdown fields retain both dimensions without
 * making the caller guess how much of either mastery bucket is due.
 */
export interface AssignedProgressCounts {
  totalCount: number;
  introducedCount: number;
  newCount: number;
  learningCount: number;
  secureCount: number;
  dueCount: number;
  currentCount: number;
  dueLearningCount: number;
  dueSecureCount: number;
  learningCurrentCount: number;
  secureCurrentCount: number;
  oldestDueAt: Date | null;
}

export interface AssignedLessonProgressRow extends AssignedProgressCounts {
  lessonId: number;
}

export interface AssignedUnitProgressRow extends AssignedProgressCounts {
  bookId: number;
  unitId: number;
  lessons: AssignedLessonProgressRow[];
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

export interface CohortActivityCell {
  /** Local-day timestamp at midnight in the app's current timezone. */
  bucketStart: Date;
  /** Correct + wrong answers from active students on this day. */
  answerCount: number;
  correctCount: number;
  /** Distinct active students who answered at least once on this day. */
  activeStudentCount: number;
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
  totalAttempts: number;
  totalDue: number;
  accuracy: number;
  lastPracticedAt: Date | null;
}

export interface UnitReportRow {
  bookId: number;
  bookTitle: string;
  unitId: number;
  unitCode: string;
  unitTitle: string;
  sessionCount: number;
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
  avgResponseMs: number | null;
  lastPracticedAt: Date | null;
}

export interface UnitSessionReportRow {
  sessionId: number;
  mode: PracticeMode;
  startedAt: Date;
  endedAt: Date | null;
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number | null;
  avgResponseMs: number | null;
}

export interface SessionReportAnswerRow {
  eventId: number;
  occurredAt: Date;
  contentItemId: number;
  lessonId: number;
  lessonTitle: string;
  lessonKind: string;
  unitId: number;
  unitCode: string;
  unitTitle: string;
  bookId: number;
  bookTitle: string;
  itemLabel: string;
  correct: boolean;
  responseMs: number | null;
}

export interface SessionReportUnitRow {
  unitId: number;
  unitCode: string;
  unitTitle: string;
  bookTitle: string;
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number;
}

export interface SessionLearningReport {
  session: {
    id: number;
    studentId: number;
    mode: PracticeMode;
    startedAt: Date;
    endedAt: Date | null;
  };
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number | null;
  avgResponseMs: number | null;
  units: SessionReportUnitRow[];
  answers: SessionReportAnswerRow[];
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

  const answerRows = ({
    studentId,
    sessionId,
    unitId,
  }: {
    studentId: number;
    sessionId?: number;
    unitId?: number;
  }) => {
    const filters = [
      eq(learningEvents.studentId, studentId),
      inArray(learningEvents.kind, ["answered_correct", "answered_wrong"]),
    ];
    if (sessionId !== undefined) filters.push(eq(learningEvents.sessionId, sessionId));
    if (unitId !== undefined) filters.push(eq(units.id, unitId));

    return db
      .select({
        eventId: learningEvents.id,
        sessionId: learningEvents.sessionId,
        kind: learningEvents.kind,
        payload: learningEvents.payload,
        occurredAt: learningEvents.occurredAt,
        contentItemId: contentItems.id,
        lessonId: lessons.id,
        lessonTitle: lessons.title,
        lessonKind: lessons.kind,
        unitId: units.id,
        unitCode: units.code,
        unitTitle: units.title,
        bookId: books.id,
        bookTitle: books.title,
        vocabHeadword: vocabEntries.headword,
      })
      .from(learningEvents)
      .innerJoin(contentItems, eq(learningEvents.contentItemId, contentItems.id))
      .innerJoin(lessons, eq(contentItems.lessonId, lessons.id))
      .innerJoin(units, eq(lessons.unitId, units.id))
      .innerJoin(books, eq(units.bookId, books.id))
      .leftJoin(
        vocabEntries,
        and(eq(contentItems.refTable, "vocab_entries"), eq(contentItems.refId, vocabEntries.id)),
      )
      .where(and(...filters))
      .orderBy(asc(learningEvents.occurredAt), asc(learningEvents.id))
      .all();
  };

  type AnswerRow = ReturnType<typeof answerRows>[number];
  type SessionRow = SessionLearningReport["session"];

  const buildSessionLearningReport = (
    session: SessionRow,
    rows: AnswerRow[],
  ): SessionLearningReport => {
    const answers: SessionReportAnswerRow[] = rows.map((row) => ({
      eventId: row.eventId,
      occurredAt: row.occurredAt,
      contentItemId: row.contentItemId,
      lessonId: row.lessonId,
      lessonTitle: row.lessonTitle,
      lessonKind: row.lessonKind,
      unitId: row.unitId,
      unitCode: row.unitCode,
      unitTitle: row.unitTitle,
      bookId: row.bookId,
      bookTitle: row.bookTitle,
      itemLabel: row.vocabHeadword ?? row.lessonTitle,
      correct: row.kind === "answered_correct",
      responseMs: payloadNumber(row.payload, "responseMs"),
    }));

    const byUnit = new Map<number, SessionReportUnitRow>();
    for (const answer of answers) {
      const current =
        byUnit.get(answer.unitId) ??
        ({
          unitId: answer.unitId,
          unitCode: answer.unitCode,
          unitTitle: answer.unitTitle,
          bookTitle: answer.bookTitle,
          totalAnswered: 0,
          totalCorrect: 0,
          accuracy: 0,
        } satisfies SessionReportUnitRow);
      current.totalAnswered += 1;
      if (answer.correct) current.totalCorrect += 1;
      current.accuracy = current.totalCorrect / current.totalAnswered;
      byUnit.set(answer.unitId, current);
    }

    const totalAnswered = answers.length;
    const totalCorrect = answers.filter((answer) => answer.correct).length;
    const responseMsValues = answers
      .map((answer) => answer.responseMs)
      .filter((value): value is number => value !== null);
    return {
      session,
      totalAnswered,
      totalCorrect,
      totalWrong: totalAnswered - totalCorrect,
      accuracy: totalAnswered === 0 ? null : totalCorrect / totalAnswered,
      avgResponseMs:
        responseMsValues.length === 0
          ? null
          : Math.round(
              responseMsValues.reduce((sum, value) => sum + value, 0) / responseMsValues.length,
            ),
      units: [...byUnit.values()].sort((a, b) => a.unitCode.localeCompare(b.unitCode)),
      answers,
    };
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
            responseMs: input.responseMs,
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
     * upsert the matching `item_progress` row using the FSRS-lite scheduler.
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
        responseMs: input.responseMs,
        now: input.now,
      });
    },

    recordContentAnswer(input: RecordContentAnswerInput): RecordAnswerResult {
      return recordResolvedAnswer(input);
    },

    /**
     * One batch query for every unit currently assigned to the student.
     *
     * The primary mastery buckets come directly from FSRS state:
     * - no curated row / `new` / an unrecognised imported state -> new
     * - `learning` / `short_term` -> learning
     * - `long_term` -> secure
     *
     * Due/current are a second, scheduling dimension over introduced items.
     * Keeping both dimensions makes the following invariants explicit:
     *
     *   new + introduced = total
     *   learning + secure = introduced
     *   due + current = introduced
     *
     * Starting from unit_assignments (rather than item_progress) both includes
     * empty assigned lessons and excludes unassigned/personal content. The
     * student + curated predicates live in the LEFT JOIN so an item with no
     * matching progress snapshot remains visible as new.
     */
    assignedUnitProgress({
      studentId,
      now,
    }: {
      studentId: number;
      now: Date;
    }): AssignedUnitProgressRow[] {
      const nowMs = now.getTime();
      const hasContent = sql`${contentItems.id} is not null`;
      const hasProgress = sql`${itemProgress.contentItemId} is not null`;
      const isLearning = sql`${itemProgress.state} in ('learning', 'short_term')`;
      const isSecure = sql`${itemProgress.state} = 'long_term'`;
      const isIntroduced = sql`(${isLearning} or ${isSecure})`;
      const isDue = sql`(${itemProgress.nextDueAt} is null or ${itemProgress.nextDueAt} <= ${nowMs})`;
      const isCurrent = sql`${itemProgress.nextDueAt} > ${nowMs}`;

      const rows = db
        .select({
          bookId: books.id,
          unitId: units.id,
          lessonId: lessons.id,
          totalCount: sql<number>`sum(case when ${hasContent} then 1 else 0 end)`.as("total_count"),
          introducedCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isIntroduced} then 1 else 0 end)`.as(
              "introduced_count",
            ),
          newCount:
            sql<number>`sum(case when ${hasContent} and not (${hasProgress} and ${isIntroduced}) then 1 else 0 end)`.as(
              "new_count",
            ),
          learningCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isLearning} then 1 else 0 end)`.as(
              "learning_count",
            ),
          secureCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isSecure} then 1 else 0 end)`.as(
              "secure_count",
            ),
          dueCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isIntroduced} and ${isDue} then 1 else 0 end)`.as(
              "due_count",
            ),
          currentCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isIntroduced} and ${isCurrent} then 1 else 0 end)`.as(
              "current_count",
            ),
          dueLearningCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isLearning} and ${isDue} then 1 else 0 end)`.as(
              "due_learning_count",
            ),
          dueSecureCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isSecure} and ${isDue} then 1 else 0 end)`.as(
              "due_secure_count",
            ),
          learningCurrentCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isLearning} and ${isCurrent} then 1 else 0 end)`.as(
              "learning_current_count",
            ),
          secureCurrentCount:
            sql<number>`sum(case when ${hasContent} and ${hasProgress} and ${isSecure} and ${isCurrent} then 1 else 0 end)`.as(
              "secure_current_count",
            ),
          oldestDueAtMs: sql<
            number | null
          >`min(case when ${hasContent} and ${hasProgress} and ${isIntroduced} and ${itemProgress.nextDueAt} is not null and ${itemProgress.nextDueAt} <= ${nowMs} then ${itemProgress.nextDueAt} else null end)`.as(
            "oldest_due_at_ms",
          ),
        })
        .from(unitAssignments)
        .innerJoin(units, eq(unitAssignments.unitId, units.id))
        .innerJoin(books, eq(units.bookId, books.id))
        .leftJoin(lessons, eq(lessons.unitId, units.id))
        .leftJoin(contentItems, eq(contentItems.lessonId, lessons.id))
        .leftJoin(
          itemProgress,
          and(
            eq(itemProgress.studentId, studentId),
            eq(itemProgress.contentItemId, contentItems.id),
            eq(itemProgress.track, "curated"),
          ),
        )
        .where(
          and(eq(unitAssignments.studentId, studentId), eq(unitAssignments.status, "assigned")),
        )
        .groupBy(books.id, books.code, units.id, units.ordinal, lessons.id, lessons.ordinal)
        .orderBy(asc(books.code), asc(units.ordinal), asc(lessons.ordinal))
        .all();

      const byUnit = new Map<number, AssignedUnitProgressRow>();
      for (const row of rows) {
        const lessonCounts: AssignedProgressCounts = {
          totalCount: Number(row.totalCount),
          introducedCount: Number(row.introducedCount),
          newCount: Number(row.newCount),
          learningCount: Number(row.learningCount),
          secureCount: Number(row.secureCount),
          dueCount: Number(row.dueCount),
          currentCount: Number(row.currentCount),
          dueLearningCount: Number(row.dueLearningCount),
          dueSecureCount: Number(row.dueSecureCount),
          learningCurrentCount: Number(row.learningCurrentCount),
          secureCurrentCount: Number(row.secureCurrentCount),
          oldestDueAt: row.oldestDueAtMs === null ? null : new Date(row.oldestDueAtMs),
        };
        let unit = byUnit.get(row.unitId);
        if (!unit) {
          unit = {
            bookId: row.bookId,
            unitId: row.unitId,
            ...emptyAssignedProgressCounts(),
            lessons: [],
          };
          byUnit.set(row.unitId, unit);
        }
        addAssignedProgressCounts(unit, lessonCounts);
        if (row.lessonId !== null) {
          unit.lessons.push({ lessonId: row.lessonId, ...lessonCounts });
        }
      }
      return [...byUnit.values()];
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
     * Dense cohort rhythm for the tutor overview. Only answer events from
     * currently active students are included: viewed/skipped/imported events
     * would inflate practice volume, while archived profiles should not move
     * the live workspace's baseline.
     */
    cohortActivity({
      since,
      until,
    }: {
      since: Date;
      until: Date;
    }): CohortActivityCell[] {
      if (until.getTime() < since.getTime()) return [];

      const studentIds = db
        .select({ id: students.id })
        .from(students)
        .where(isNull(students.archivedAt))
        .all()
        .map((row) => row.id);
      const rows =
        studentIds.length === 0
          ? []
          : db
              .select({
                studentId: learningEvents.studentId,
                kind: learningEvents.kind,
                occurredAt: learningEvents.occurredAt,
              })
              .from(learningEvents)
              .where(
                and(
                  inArray(learningEvents.studentId, studentIds),
                  inArray(learningEvents.kind, ["answered_correct", "answered_wrong"]),
                  gte(learningEvents.occurredAt, since),
                  lte(learningEvents.occurredAt, until),
                ),
              )
              .all();

      const buckets = new Map<
        number,
        { answerCount: number; correctCount: number; studentIds: Set<number> }
      >();
      for (const row of rows) {
        const key = startOfLocalDay(row.occurredAt).getTime();
        const bucket = buckets.get(key) ?? {
          answerCount: 0,
          correctCount: 0,
          studentIds: new Set<number>(),
        };
        bucket.answerCount += 1;
        if (row.kind === "answered_correct") bucket.correctCount += 1;
        bucket.studentIds.add(row.studentId);
        buckets.set(key, bucket);
      }

      const cells: CohortActivityCell[] = [];
      const cursor = startOfLocalDay(since);
      const end = startOfLocalDay(until);
      while (cursor.getTime() <= end.getTime()) {
        const bucket = buckets.get(cursor.getTime());
        cells.push({
          bucketStart: new Date(cursor),
          answerCount: bucket?.answerCount ?? 0,
          correctCount: bucket?.correctCount ?? 0,
          activeStudentCount: bucket?.studentIds.size ?? 0,
        });
        cursor.setDate(cursor.getDate() + 1);
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

    unitReport({ studentId }: { studentId: number }): UnitReportRow[] {
      const rows = answerRows({ studentId });
      const byUnit = new Map<
        number,
        {
          bookId: number;
          bookTitle: string;
          unitId: number;
          unitCode: string;
          unitTitle: string;
          sessionIds: Set<number>;
          totalAnswered: number;
          totalCorrect: number;
          responseTotalMs: number;
          responseCount: number;
          lastPracticedAt: Date | null;
        }
      >();
      for (const row of rows) {
        const cur = byUnit.get(row.unitId) ?? {
          bookId: row.bookId,
          bookTitle: row.bookTitle,
          unitId: row.unitId,
          unitCode: row.unitCode,
          unitTitle: row.unitTitle,
          sessionIds: new Set<number>(),
          totalAnswered: 0,
          totalCorrect: 0,
          responseTotalMs: 0,
          responseCount: 0,
          lastPracticedAt: null,
        };
        if (row.sessionId !== null) cur.sessionIds.add(row.sessionId);
        cur.totalAnswered += 1;
        if (row.kind === "answered_correct") cur.totalCorrect += 1;
        const responseMs = payloadNumber(row.payload, "responseMs");
        if (responseMs !== null) {
          cur.responseTotalMs += responseMs;
          cur.responseCount += 1;
        }
        if (!cur.lastPracticedAt || row.occurredAt.getTime() > cur.lastPracticedAt.getTime()) {
          cur.lastPracticedAt = row.occurredAt;
        }
        byUnit.set(row.unitId, cur);
      }

      return [...byUnit.values()]
        .map((row) => ({
          bookId: row.bookId,
          bookTitle: row.bookTitle,
          unitId: row.unitId,
          unitCode: row.unitCode,
          unitTitle: row.unitTitle,
          sessionCount: row.sessionIds.size,
          totalAnswered: row.totalAnswered,
          totalCorrect: row.totalCorrect,
          totalWrong: row.totalAnswered - row.totalCorrect,
          accuracy: row.totalAnswered === 0 ? 0 : row.totalCorrect / row.totalAnswered,
          avgResponseMs:
            row.responseCount === 0 ? null : Math.round(row.responseTotalMs / row.responseCount),
          lastPracticedAt: row.lastPracticedAt,
        }))
        .sort(
          (a, b) =>
            (b.lastPracticedAt?.getTime() ?? 0) - (a.lastPracticedAt?.getTime() ?? 0) ||
            a.bookTitle.localeCompare(b.bookTitle) ||
            a.unitCode.localeCompare(b.unitCode),
        );
    },

    unitSessions({
      studentId,
      unitId,
      limit = 20,
    }: {
      studentId: number;
      unitId: number;
      limit?: number;
    }): UnitSessionReportRow[] {
      const rows = answerRows({ studentId, unitId });
      const bySession = new Map<
        number,
        {
          sessionId: number;
          totalAnswered: number;
          totalCorrect: number;
          responseTotalMs: number;
          responseCount: number;
        }
      >();
      for (const row of rows) {
        if (row.sessionId === null) continue;
        const cur = bySession.get(row.sessionId) ?? {
          sessionId: row.sessionId,
          totalAnswered: 0,
          totalCorrect: 0,
          responseTotalMs: 0,
          responseCount: 0,
        };
        cur.totalAnswered += 1;
        if (row.kind === "answered_correct") cur.totalCorrect += 1;
        const responseMs = payloadNumber(row.payload, "responseMs");
        if (responseMs !== null) {
          cur.responseTotalMs += responseMs;
          cur.responseCount += 1;
        }
        bySession.set(row.sessionId, cur);
      }
      if (bySession.size === 0) return [];
      const sessions = db
        .select({
          id: practiceSessions.id,
          mode: practiceSessions.mode,
          startedAt: practiceSessions.startedAt,
          endedAt: practiceSessions.endedAt,
        })
        .from(practiceSessions)
        .where(inArray(practiceSessions.id, [...bySession.keys()]))
        .orderBy(desc(practiceSessions.startedAt), desc(practiceSessions.id))
        .limit(limit)
        .all();
      return sessions.map((session) => {
        const stats = bySession.get(session.id) ?? {
          sessionId: session.id,
          totalAnswered: 0,
          totalCorrect: 0,
          responseTotalMs: 0,
          responseCount: 0,
        };
        return {
          sessionId: session.id,
          mode: session.mode,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          totalAnswered: stats.totalAnswered,
          totalCorrect: stats.totalCorrect,
          accuracy: stats.totalAnswered === 0 ? null : stats.totalCorrect / stats.totalAnswered,
          avgResponseMs:
            stats.responseCount === 0
              ? null
              : Math.round(stats.responseTotalMs / stats.responseCount),
        };
      });
    },

    sessionReport({ sessionId }: { sessionId: number }): SessionLearningReport | null {
      const session = db
        .select({
          id: practiceSessions.id,
          studentId: practiceSessions.studentId,
          mode: practiceSessions.mode,
          startedAt: practiceSessions.startedAt,
          endedAt: practiceSessions.endedAt,
        })
        .from(practiceSessions)
        .where(eq(practiceSessions.id, sessionId))
        .get();
      if (!session) return null;

      const rows = answerRows({ studentId: session.studentId, sessionId });
      return buildSessionLearningReport(session, rows);
    },

    /**
     * Complete session learning history for export. Both sessions and answer
     * rows are fetched by student id, then joined in memory, avoiding one
     * report query per session and unbounded caller-generated `IN` lists.
     */
    studentSessionReports({ studentId }: { studentId: number }): SessionLearningReport[] {
      const sessions = db
        .select({
          id: practiceSessions.id,
          studentId: practiceSessions.studentId,
          mode: practiceSessions.mode,
          startedAt: practiceSessions.startedAt,
          endedAt: practiceSessions.endedAt,
        })
        .from(practiceSessions)
        .where(eq(practiceSessions.studentId, studentId))
        .orderBy(desc(practiceSessions.startedAt), desc(practiceSessions.id))
        .all();
      if (sessions.length === 0) return [];

      const rowsBySession = new Map<number, AnswerRow[]>();
      for (const row of answerRows({ studentId })) {
        if (row.sessionId === null) continue;
        const rows = rowsBySession.get(row.sessionId) ?? [];
        rows.push(row);
        rowsBySession.set(row.sessionId, rows);
      }
      return sessions.map((session) =>
        buildSessionLearningReport(session, rowsBySession.get(session.id) ?? []),
      );
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
          totalAttempts,
          totalDue: s?.totalDue ?? 0,
          accuracy: totalAttempts === 0 ? 0 : totalCorrect / totalAttempts,
          lastPracticedAt: s?.lastPracticedAt ?? null,
        };
      });
    },

    /**
     * Pronunciation lab target shortlist. Returns the vocab entries the
     * student is actively learning (new / learning / short_term) ordered
     * by FSRS urgency, plus an occasional long_term sample so mastered
     * words still resurface for spot checks. Each row carries the
     * minimum data the lab needs (id, headword, ipa, pos, cefr, audio).
     */
    studyTargets({ studentId }: { studentId: number }): StudyTargetsResult {
      const baseSelect = {
        entryId: vocabEntries.id,
        lessonId: vocabEntries.lessonId,
        headword: vocabEntries.headword,
        pos: vocabEntries.pos,
        ipa: vocabEntries.ipa,
        cefrLevel: vocabEntries.cefrLevel,
        audioRef: vocabEntries.audioRef,
        state: itemProgress.state,
        nextDueAt: itemProgress.nextDueAt,
        lastSeenAt: itemProgress.lastSeenAt,
      } as const;
      const baseConditions = and(
        eq(itemProgress.studentId, studentId),
        eq(contentItems.refTable, "vocab_entries"),
      );
      const learning = db
        .select(baseSelect)
        .from(itemProgress)
        .innerJoin(contentItems, eq(itemProgress.contentItemId, contentItems.id))
        .innerJoin(vocabEntries, eq(contentItems.refId, vocabEntries.id))
        .where(and(baseConditions, inArray(itemProgress.state, ["new", "learning", "short_term"])))
        .orderBy(
          sql`coalesce(${itemProgress.nextDueAt}, 0) asc`,
          sql`coalesce(${itemProgress.lastSeenAt}, 0) desc`,
        )
        .limit(30)
        .all();
      const longTerm = db
        .select(baseSelect)
        .from(itemProgress)
        .innerJoin(contentItems, eq(itemProgress.contentItemId, contentItems.id))
        .innerJoin(vocabEntries, eq(contentItems.refId, vocabEntries.id))
        .where(and(baseConditions, eq(itemProgress.state, "long_term")))
        .orderBy(sql`coalesce(${itemProgress.lastSeenAt}, 0) asc`)
        .limit(10)
        .all();
      return { learning, longTermSample: longTerm };
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

    /**
     * Tutor-facing headline numbers shown on the picker before drilling
     * into a student: who is active, how many cards are due across the
     * fleet, and who's leading on XP / streak. Single-pass joins keep it
     * cheap even when the fleet grows.
     */
    fleetSnapshot({ now }: { now: Date }): FleetSnapshot {
      const studentRows = db
        .select()
        .from(students)
        .where(isNull(students.archivedAt))
        .orderBy(asc(students.name), asc(students.id))
        .all();
      if (studentRows.length === 0) {
        return { activeCount: 0, totalDue: 0, topXp: null, topStreak: null };
      }

      const ids = studentRows.map((s) => s.id);
      const progressRows = db
        .select({
          studentId: itemProgress.studentId,
          totalCorrect: itemProgress.totalCorrect,
          totalWrong: itemProgress.totalWrong,
          nextDueAt: itemProgress.nextDueAt,
        })
        .from(itemProgress)
        .where(inArray(itemProgress.studentId, ids))
        .all();
      const eventRows = db
        .select({
          studentId: learningEvents.studentId,
          occurredAt: learningEvents.occurredAt,
        })
        .from(learningEvents)
        .where(inArray(learningEvents.studentId, ids))
        .all();

      const stats = new Map<
        number,
        { totalSeen: number; totalCorrect: number; totalWrong: number; totalDue: number }
      >();
      const events = new Map<number, Date[]>();
      for (const id of ids) {
        stats.set(id, { totalSeen: 0, totalCorrect: 0, totalWrong: 0, totalDue: 0 });
        events.set(id, []);
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
      }
      for (const r of eventRows) {
        events.get(r.studentId)?.push(r.occurredAt);
      }

      let totalDue = 0;
      let topXp: FleetSnapshot["topXp"] = null;
      let topStreak: FleetSnapshot["topStreak"] = null;
      for (const student of studentRows) {
        const s = stats.get(student.id);
        const seen = s?.totalSeen ?? 0;
        const correct = s?.totalCorrect ?? 0;
        const wrong = s?.totalWrong ?? 0;
        const attempts = correct + wrong;
        const accuracy = attempts === 0 ? 0 : correct / attempts;
        const streak = computeStreak({ eventTimestamps: events.get(student.id) ?? [], now });
        const xp = computeStudentXp({
          totalSeen: seen,
          totalCorrect: correct,
          totalWrong: wrong,
          accuracy,
          streakDays: streak.currentStreak,
          practicedToday: streak.practicedToday,
        });
        totalDue += s?.totalDue ?? 0;

        const profile = {
          studentId: student.id,
          name: student.displayName ?? student.name,
          avatarSeed: student.avatarSeed,
          color: student.color,
        };
        if (!topXp || xp > topXp.xp) topXp = { ...profile, xp };
        if (!topStreak || streak.currentStreak > topStreak.streak) {
          topStreak = { ...profile, streak: streak.currentStreak };
        }
      }

      if (topXp && topXp.xp === 0) topXp = null;
      if (topStreak && topStreak.streak === 0) topStreak = null;

      return { activeCount: studentRows.length, totalDue, topXp, topStreak };
    },
  };
}

export type ProgressRepository = ReturnType<typeof createProgressRepository>;

export interface StudyTargetRow {
  entryId: number;
  lessonId: number;
  headword: string;
  pos: string;
  ipa: string | null;
  cefrLevel: string | null;
  audioRef: string | null;
  state: "new" | "learning" | "short_term" | "long_term";
  nextDueAt: Date | null;
  lastSeenAt: Date | null;
}

export interface StudyTargetsResult {
  learning: StudyTargetRow[];
  longTermSample: StudyTargetRow[];
}

export interface FleetSnapshotProfile {
  studentId: number;
  name: string;
  avatarSeed: string | null;
  color: string | null;
}

export interface FleetSnapshot {
  activeCount: number;
  totalDue: number;
  topXp: (FleetSnapshotProfile & { xp: number }) | null;
  topStreak: (FleetSnapshotProfile & { streak: number }) | null;
}

function emptyAssignedProgressCounts(): AssignedProgressCounts {
  return {
    totalCount: 0,
    introducedCount: 0,
    newCount: 0,
    learningCount: 0,
    secureCount: 0,
    dueCount: 0,
    currentCount: 0,
    dueLearningCount: 0,
    dueSecureCount: 0,
    learningCurrentCount: 0,
    secureCurrentCount: 0,
    oldestDueAt: null,
  };
}

function addAssignedProgressCounts(
  target: AssignedProgressCounts,
  source: AssignedProgressCounts,
): void {
  target.totalCount += source.totalCount;
  target.introducedCount += source.introducedCount;
  target.newCount += source.newCount;
  target.learningCount += source.learningCount;
  target.secureCount += source.secureCount;
  target.dueCount += source.dueCount;
  target.currentCount += source.currentCount;
  target.dueLearningCount += source.dueLearningCount;
  target.dueSecureCount += source.dueSecureCount;
  target.learningCurrentCount += source.learningCurrentCount;
  target.secureCurrentCount += source.secureCurrentCount;
  if (
    source.oldestDueAt &&
    (!target.oldestDueAt || source.oldestDueAt.getTime() < target.oldestDueAt.getTime())
  ) {
    target.oldestDueAt = source.oldestDueAt;
  }
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function payloadNumber(payload: Record<string, unknown> | null, key: string): number | null {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
