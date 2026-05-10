import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import {
  type LearningEventKind,
  type PracticeMode,
  contentItems,
  itemProgress,
  learningEvents,
  practiceSessions,
  vocabEntries,
} from "../../../src/data/schema";
import type { ItemProgress, LearningEvent, PracticeSession } from "../../../src/data/types";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { applyAnswer, qualityFromOutcome } from "../../../src/modules/srs";
import type { AppDatabase } from "../client";

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
  /** Caller-controlled clock (defaults to `new Date()`). Tests inject a fixed Date. */
  now?: Date;
}

export interface RecordAnswerResult {
  event: LearningEvent;
  progress: ItemProgress;
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

/**
 * All practice-time writes live here. Reads stay narrow on purpose: the
 * tutor analytics screen will sit on top of this in a later PR, so we
 * avoid baking complex aggregations until we know exactly what we need.
 */
export function createProgressRepository(db: AppDatabase) {
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
    contentItemForEntry(entryId: number): { id: number; lessonId: number } | null {
      const row = db
        .select({ id: contentItems.id, lessonId: contentItems.lessonId })
        .from(contentItems)
        .where(and(eq(contentItems.refTable, "vocab_entries"), eq(contentItems.refId, entryId)))
        .get();
      return row ?? null;
    },

    /**
     * Persist an answered exercise: append a `learning_events` row and
     * upsert the matching `item_progress` row using the SM-2 scheduler.
     * The whole thing runs in a transaction so the event log and the
     * materialised progress stay consistent.
     */
    recordAnswer(input: RecordAnswerInput): RecordAnswerResult {
      const now = input.now ?? new Date();
      return db.transaction((tx) => {
        const itemRow = tx
          .select({ id: contentItems.id, lessonId: contentItems.lessonId })
          .from(contentItems)
          .where(
            and(eq(contentItems.refTable, "vocab_entries"), eq(contentItems.refId, input.entryId)),
          )
          .get();
        if (!itemRow) {
          throw new Error(`No content_items row for vocab entry ${input.entryId} — re-run import?`);
        }

        const kind: LearningEventKind = input.outcome.correct
          ? "answered_correct"
          : "answered_wrong";

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

        const quality = qualityFromOutcome(input.outcome);
        const next = applyAnswer({
          prev: prevRow
            ? {
                ease: prevRow.ease ?? 250,
                intervalDays: prevRow.intervalDays ?? 0,
                repetitions: prevRow.streak,
              }
            : null,
          quality,
          now,
        });

        const progressValues = {
          studentId: input.studentId,
          contentItemId: itemRow.id,
          lastSeenAt: next.lastSeenAt,
          nextDueAt: next.nextDueAt,
          ease: next.ease,
          intervalDays: next.intervalDays,
          streak: next.repetitions,
          totalCorrect: (prevRow?.totalCorrect ?? 0) + (input.outcome.correct ? 1 : 0),
          totalWrong: (prevRow?.totalWrong ?? 0) + (input.outcome.correct ? 0 : 1),
          updatedAt: now,
        };

        const progress = tx
          .insert(itemProgress)
          .values(progressValues)
          .onConflictDoUpdate({
            target: [itemProgress.studentId, itemProgress.contentItemId],
            set: {
              lastSeenAt: progressValues.lastSeenAt,
              nextDueAt: progressValues.nextDueAt,
              ease: progressValues.ease,
              intervalDays: progressValues.intervalDays,
              streak: progressValues.streak,
              totalCorrect: progressValues.totalCorrect,
              totalWrong: progressValues.totalWrong,
              updatedAt: progressValues.updatedAt,
            },
          })
          .returning()
          .get();
        if (!progress) throw new Error("Failed to upsert item_progress");

        return { event, progress };
      });
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
        .where(and(eq(contentItems.lessonId, lessonId), eq(contentItems.refTable, "vocab_entries")))
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
