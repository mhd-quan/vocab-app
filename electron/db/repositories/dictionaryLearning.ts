import { and, asc, desc, eq, lte, or } from "drizzle-orm";
import type { DictionaryEntry } from "../../../src/data/dictionary";
import type {
  DictionaryLearningItemView,
  DictionaryLearningReviewResult,
  DictionaryLearningSummary,
  DictionarySearchHistoryItem,
} from "../../../src/data/dictionaryLearning";
import {
  type DictionaryLearningStage,
  type DictionaryLearningStatus,
  dictionaryLearningItems,
  dictionaryLearningReviews,
  dictionarySearchEvents,
} from "../../../src/data/schema";
import type { AppDatabase } from "../client";

const STAGE_ORDER: DictionaryLearningStage[] = [
  "flashcard",
  "meaning_choice",
  "reverse_choice",
  "cloze",
  "typing",
];
const SHORT_TERM_THRESHOLD = 7;
const LONG_TERM_THRESHOLD = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecordSearchInput {
  studentId: number;
  query: string;
}

export interface RecordLookupInput {
  studentId: number;
  query: string;
  entry: DictionaryEntry;
}

export interface RecordReviewInput {
  studentId: number;
  itemId: number;
  stage: DictionaryLearningStage;
  correct: boolean;
  answer?: string | null;
  expected?: string | null;
  sessionId?: number | null;
  now?: Date;
}

export function createDictionaryLearningRepository(db: AppDatabase) {
  return {
    recordSearch(input: RecordSearchInput): DictionarySearchHistoryItem | null {
      const query = input.query.trim();
      if (!query) return null;
      const row = db
        .insert(dictionarySearchEvents)
        .values({ studentId: input.studentId, query })
        .returning()
        .get();
      return row ? toHistoryItem(row) : null;
    },

    recordLookup(input: RecordLookupInput): DictionaryLearningItemView {
      const query = input.query.trim() || input.entry.headword;
      const seed = seedLearningItem(input.studentId, input.entry);
      const now = new Date();
      return db.transaction((tx) => {
        tx.insert(dictionarySearchEvents)
          .values({
            studentId: input.studentId,
            query,
            dictionaryKey: input.entry.key,
            headword: input.entry.headword,
            createdAt: now,
          })
          .run();

        const existing = tx
          .select()
          .from(dictionaryLearningItems)
          .where(
            and(
              eq(dictionaryLearningItems.studentId, input.studentId),
              eq(dictionaryLearningItems.dictionaryKey, input.entry.key),
            ),
          )
          .get();

        if (existing) {
          const updated = tx
            .update(dictionaryLearningItems)
            .set({
              headword: seed.headword,
              pos: seed.pos,
              ipa: seed.ipa,
              cefrLevel: seed.cefrLevel,
              definitionEn: seed.definitionEn,
              definitionVi: seed.definitionVi,
              exampleText: seed.exampleText,
              exampleTranslation: seed.exampleTranslation,
              audioRef: seed.audioRef,
              updatedAt: now,
            })
            .where(eq(dictionaryLearningItems.id, existing.id))
            .returning()
            .get();
          if (!updated) throw new Error("Failed to update dictionary learning item");
          return toItemView(updated);
        }

        const inserted = tx
          .insert(dictionaryLearningItems)
          .values({
            ...seed,
            status: "learning",
            stage: "flashcard",
            nextDueAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get();
        if (!inserted) throw new Error("Failed to insert dictionary learning item");
        return toItemView(inserted);
      });
    },

    summary(studentId: number, now = new Date()): DictionaryLearningSummary {
      const rows = db
        .select()
        .from(dictionaryLearningItems)
        .where(eq(dictionaryLearningItems.studentId, studentId))
        .all();
      const due = rows.filter((row) => isDue(row.nextDueAt, now));
      const scoreSum = rows.reduce((sum, row) => sum + row.score, 0);
      return {
        total: rows.length,
        due: due.length,
        learning: rows.filter((row) => row.status === "learning").length,
        shortTerm: rows.filter((row) => row.status === "short_term").length,
        longTerm: rows.filter((row) => row.status === "long_term").length,
        averageScore: rows.length ? Math.round(scoreSum / rows.length) : 0,
      };
    },

    recentSearches(studentId: number, limit = 12): DictionarySearchHistoryItem[] {
      return db
        .select()
        .from(dictionarySearchEvents)
        .where(eq(dictionarySearchEvents.studentId, studentId))
        .orderBy(desc(dictionarySearchEvents.createdAt))
        .limit(limit)
        .all()
        .map(toHistoryItem);
    },

    listItems(studentId: number): DictionaryLearningItemView[] {
      return db
        .select()
        .from(dictionaryLearningItems)
        .where(eq(dictionaryLearningItems.studentId, studentId))
        .orderBy(asc(dictionaryLearningItems.status), asc(dictionaryLearningItems.nextDueAt))
        .all()
        .map(toItemView);
    },

    practiceQueue(studentId: number, limit = 12, now = new Date()): DictionaryLearningItemView[] {
      return db
        .select()
        .from(dictionaryLearningItems)
        .where(
          and(
            eq(dictionaryLearningItems.studentId, studentId),
            or(
              lte(dictionaryLearningItems.nextDueAt, now),
              eq(dictionaryLearningItems.status, "learning"),
            ),
          ),
        )
        .orderBy(asc(dictionaryLearningItems.status), asc(dictionaryLearningItems.nextDueAt))
        .limit(limit)
        .all()
        .map(toItemView);
    },

    recordReview(input: RecordReviewInput): DictionaryLearningReviewResult {
      const now = input.now ?? new Date();
      return db.transaction((tx) => {
        const item = tx
          .select()
          .from(dictionaryLearningItems)
          .where(
            and(
              eq(dictionaryLearningItems.id, input.itemId),
              eq(dictionaryLearningItems.studentId, input.studentId),
            ),
          )
          .get();
        if (!item) throw new Error("Dictionary learning item not found");

        const next = nextLearningState({
          status: item.status,
          stage: item.stage,
          correctInCycle: item.correctInCycle,
          shortTermCorrect: item.shortTermCorrect,
          totalCorrect: item.totalCorrect,
          totalWrong: item.totalWrong,
          correct: input.correct,
          now,
        });

        const updated = tx
          .update(dictionaryLearningItems)
          .set({
            status: next.status,
            stage: next.stage,
            correctInCycle: next.correctInCycle,
            shortTermCorrect: next.shortTermCorrect,
            totalCorrect: next.totalCorrect,
            totalWrong: next.totalWrong,
            score: scoreLearningItem(next),
            lastReviewedAt: now,
            nextDueAt: next.nextDueAt,
            updatedAt: now,
          })
          .where(eq(dictionaryLearningItems.id, item.id))
          .returning()
          .get();
        if (!updated) throw new Error("Failed to update dictionary learning item");

        tx.insert(dictionaryLearningReviews)
          .values({
            itemId: item.id,
            studentId: input.studentId,
            sessionId: input.sessionId ?? null,
            stageBefore: item.stage,
            stageAfter: updated.stage,
            statusAfter: updated.status,
            correct: input.correct,
            answer: input.answer ?? null,
            expected: input.expected ?? null,
            createdAt: now,
          })
          .run();

        return {
          item: toItemView(updated),
          reset: !input.correct,
          promoted:
            item.status !== updated.status &&
            (updated.status === "short_term" || updated.status === "long_term")
              ? updated.status
              : null,
        };
      });
    },
  };
}

export type DictionaryLearningRepository = ReturnType<typeof createDictionaryLearningRepository>;

function seedLearningItem(studentId: number, entry: DictionaryEntry) {
  const lessonEntry = entry.lessonEntries[0];
  const definitionEn = entry.senses[0]?.definitionEn ?? entry.examples[0] ?? entry.headword;
  return {
    studentId,
    dictionaryKey: entry.key,
    headword: entry.headword,
    pos: entry.posKey,
    ipa: entry.ipaUk ?? entry.ipaUs ?? lessonEntry?.ipa ?? null,
    cefrLevel: entry.cefr ?? lessonEntry?.cefrLevel ?? null,
    definitionEn,
    definitionVi: lessonEntry?.senses.find((sense) => sense.definitionVi)?.definitionVi ?? null,
    exampleText: entry.examples[0] ?? lessonEntry?.examples[0]?.text ?? null,
    exampleTranslation:
      lessonEntry?.examples.find((example) => example.translation)?.translation ?? null,
    audioRef: entry.audio[0]?.ref ?? lessonEntry?.audioRef ?? null,
  };
}

function nextLearningState(input: {
  status: DictionaryLearningStatus;
  stage: DictionaryLearningStage;
  correctInCycle: number;
  shortTermCorrect: number;
  totalCorrect: number;
  totalWrong: number;
  correct: boolean;
  now: Date;
}) {
  if (!input.correct) {
    return {
      status: "learning" as const,
      stage: "flashcard" as const,
      correctInCycle: 0,
      shortTermCorrect: 0,
      totalCorrect: input.totalCorrect,
      totalWrong: input.totalWrong + 1,
      nextDueAt: input.now,
    };
  }

  if (input.status === "short_term" || input.status === "long_term") {
    const shortTermCorrect = input.shortTermCorrect + 1;
    const longTerm = input.status === "long_term" || shortTermCorrect >= LONG_TERM_THRESHOLD;
    return {
      status: longTerm ? ("long_term" as const) : ("short_term" as const),
      stage: "retention" as const,
      correctInCycle: input.correctInCycle,
      shortTermCorrect,
      totalCorrect: input.totalCorrect + 1,
      totalWrong: input.totalWrong,
      nextDueAt: new Date(input.now.getTime() + (longTerm ? 14 : 1) * DAY_MS),
    };
  }

  const correctInCycle = input.correctInCycle + 1;
  if (correctInCycle >= SHORT_TERM_THRESHOLD) {
    return {
      status: "short_term" as const,
      stage: "retention" as const,
      correctInCycle,
      shortTermCorrect: 0,
      totalCorrect: input.totalCorrect + 1,
      totalWrong: input.totalWrong,
      nextDueAt: new Date(input.now.getTime() + DAY_MS),
    };
  }

  return {
    status: "learning" as const,
    stage: nextStage(input.stage),
    correctInCycle,
    shortTermCorrect: input.shortTermCorrect,
    totalCorrect: input.totalCorrect + 1,
    totalWrong: input.totalWrong,
    nextDueAt: input.now,
  };
}

function nextStage(stage: DictionaryLearningStage): DictionaryLearningStage {
  const index = STAGE_ORDER.indexOf(stage);
  if (index < 0) return "flashcard";
  return STAGE_ORDER[(index + 1) % STAGE_ORDER.length] ?? "flashcard";
}

function scoreLearningItem(input: {
  status: DictionaryLearningStatus;
  correctInCycle: number;
  shortTermCorrect: number;
  totalCorrect: number;
  totalWrong: number;
}): number {
  const statusBonus = input.status === "long_term" ? 80 : input.status === "short_term" ? 55 : 0;
  const raw =
    statusBonus +
    input.correctInCycle * 8 +
    input.shortTermCorrect * 12 +
    input.totalCorrect * 4 -
    input.totalWrong * 18;
  return Math.min(100, Math.max(0, raw));
}

function isDue(nextDueAt: Date | null, now: Date): boolean {
  return !nextDueAt || nextDueAt.getTime() <= now.getTime();
}

function toItemView(row: typeof dictionaryLearningItems.$inferSelect): DictionaryLearningItemView {
  return {
    id: row.id,
    studentId: row.studentId,
    dictionaryKey: row.dictionaryKey,
    headword: row.headword,
    pos: row.pos,
    ipa: row.ipa,
    cefrLevel: row.cefrLevel,
    definitionEn: row.definitionEn,
    definitionVi: row.definitionVi,
    exampleText: row.exampleText,
    exampleTranslation: row.exampleTranslation,
    audioRef: row.audioRef,
    status: row.status,
    stage: row.stage,
    correctInCycle: row.correctInCycle,
    shortTermCorrect: row.shortTermCorrect,
    totalCorrect: row.totalCorrect,
    totalWrong: row.totalWrong,
    score: row.score,
    lastReviewedAt: row.lastReviewedAt,
    nextDueAt: row.nextDueAt,
    updatedAt: row.updatedAt,
  };
}

function toHistoryItem(
  row: typeof dictionarySearchEvents.$inferSelect,
): DictionarySearchHistoryItem {
  return {
    id: row.id,
    query: row.query,
    dictionaryKey: row.dictionaryKey,
    headword: row.headword,
    createdAt: row.createdAt,
  };
}
