import { and, asc, desc, eq, inArray, lte, or } from "drizzle-orm";
import type { DictionaryAudioRef, DictionaryEntry } from "../../../src/data/dictionary";
import type {
  DictionaryLearningAudioRef,
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
  vocabEntries,
} from "../../../src/data/schema";
import type { AppDatabase } from "../client";
import type { VocabEntryFull } from "./vocab";

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

export interface EnsureUnitLessonItemsInput {
  studentId: number;
  lessonId: number;
  entries: VocabEntryFull[];
  enrichments?: Map<number, DictionaryEntry | null>;
}

export interface EnsureUnitLessonItemsResult {
  total: number;
  inserted: number;
  updated: number;
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
              audioRefs: seed.audioRefs,
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

    ensureUnitLessonItems(input: EnsureUnitLessonItemsInput): EnsureUnitLessonItemsResult {
      const now = new Date();
      return db.transaction((tx) => {
        let inserted = 0;
        let updated = 0;

        for (const entry of input.entries) {
          if (entry.lessonId !== input.lessonId) continue;
          const seed = seedUnitLearningItem(
            input.studentId,
            entry,
            input.enrichments?.get(entry.id) ?? null,
          );
          const existing = tx
            .select()
            .from(dictionaryLearningItems)
            .where(
              and(
                eq(dictionaryLearningItems.studentId, input.studentId),
                eq(dictionaryLearningItems.dictionaryKey, seed.dictionaryKey),
              ),
            )
            .get();

          if (existing) {
            tx.update(dictionaryLearningItems)
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
                audioRefs: seed.audioRefs,
                updatedAt: now,
              })
              .where(eq(dictionaryLearningItems.id, existing.id))
              .run();
            updated += 1;
            continue;
          }

          tx.insert(dictionaryLearningItems)
            .values({
              ...seed,
              status: "learning",
              stage: "flashcard",
              nextDueAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          inserted += 1;
        }

        return { total: input.entries.length, inserted, updated };
      });
    },

    lessonSummary(
      studentId: number,
      lessonId: number,
      now = new Date(),
    ): DictionaryLearningSummary {
      const keys = unitLessonKeys(db, lessonId);
      if (keys.length === 0) {
        return {
          total: 0,
          due: 0,
          new: 0,
          learning: 0,
          shortTerm: 0,
          longTerm: 0,
          averageScore: 0,
        };
      }

      const rows = db
        .select()
        .from(dictionaryLearningItems)
        .where(
          and(
            eq(dictionaryLearningItems.studentId, studentId),
            inArray(dictionaryLearningItems.dictionaryKey, keys),
          ),
        )
        .all();
      const scoreSum = rows.reduce((sum, row) => sum + row.score, 0);
      return {
        total: keys.length,
        due: rows.filter((row) => isDue(row.nextDueAt, now)).length,
        new: Math.max(keys.length - rows.length, 0),
        learning: rows.filter((row) => row.status === "learning").length,
        shortTerm: rows.filter((row) => row.status === "short_term").length,
        longTerm: rows.filter((row) => row.status === "long_term").length,
        averageScore: rows.length ? Math.round(scoreSum / rows.length) : 0,
      };
    },

    lessonItems(studentId: number, lessonId: number): DictionaryLearningItemView[] {
      const keys = unitLessonKeys(db, lessonId);
      if (keys.length === 0) return [];
      return db
        .select()
        .from(dictionaryLearningItems)
        .where(
          and(
            eq(dictionaryLearningItems.studentId, studentId),
            inArray(dictionaryLearningItems.dictionaryKey, keys),
          ),
        )
        .orderBy(asc(dictionaryLearningItems.status), asc(dictionaryLearningItems.nextDueAt))
        .all()
        .map(toItemView);
    },

    lessonPracticeQueue(
      studentId: number,
      lessonId: number,
      limit = 12,
      now = new Date(),
    ): DictionaryLearningItemView[] {
      const keys = unitLessonKeys(db, lessonId);
      if (keys.length === 0) return [];
      return db
        .select()
        .from(dictionaryLearningItems)
        .where(
          and(
            eq(dictionaryLearningItems.studentId, studentId),
            inArray(dictionaryLearningItems.dictionaryKey, keys),
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
  const audioRefs = normalizeAudioRefs(entry.audio);
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
    audioRef: preferredAudioRef(audioRefs)?.ref ?? lessonEntry?.audioRef ?? null,
    audioRefs,
  };
}

function seedUnitLearningItem(
  studentId: number,
  entry: VocabEntryFull,
  dictionaryEntry: DictionaryEntry | null,
) {
  const senses = entry.senses.slice().sort((a, b) => a.ordinal - b.ordinal);
  const examples = entry.examples.slice().sort((a, b) => a.ordinal - b.ordinal);
  const dictionaryDefinitionEn = dictionaryEntry?.senses[0]?.definitionEn?.trim() || null;
  const localDefinitionEn =
    senses.find((sense) => sense.definitionEn)?.definitionEn?.trim() || null;
  const definitionEn = dictionaryDefinitionEn ?? localDefinitionEn ?? entry.headword;
  const definitionVi = senses.find((sense) => sense.definitionVi)?.definitionVi?.trim() ?? null;
  const audioRefs = mergeAudioRefs(
    normalizeAudioRefs(dictionaryEntry?.audio ?? []),
    entry.audioRef ? [{ ref: entry.audioRef, label: "Audio", accent: "other" }] : [],
  );

  return {
    studentId,
    dictionaryKey: unitVocabDictionaryKey(entry.id),
    headword: entry.headword,
    pos: entry.pos,
    ipa: entry.ipa ?? dictionaryEntry?.ipaUk ?? dictionaryEntry?.ipaUs ?? null,
    cefrLevel: entry.cefrLevel ?? dictionaryEntry?.cefr ?? null,
    definitionEn,
    definitionVi,
    exampleText: examples[0]?.text ?? dictionaryEntry?.examples[0] ?? null,
    exampleTranslation: examples.find((example) => example.translation)?.translation ?? null,
    audioRef: preferredAudioRef(audioRefs)?.ref ?? null,
    audioRefs,
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

function unitVocabDictionaryKey(entryId: number): string {
  return `unit:vocab:${entryId}`;
}

function unitLessonKeys(db: AppDatabase, lessonId: number): string[] {
  return db
    .select({ id: vocabEntries.id })
    .from(vocabEntries)
    .where(eq(vocabEntries.lessonId, lessonId))
    .orderBy(asc(vocabEntries.headword), asc(vocabEntries.id))
    .all()
    .map((row) => unitVocabDictionaryKey(row.id));
}

function normalizeAudioRefs(refs: DictionaryAudioRef[]): DictionaryLearningAudioRef[] {
  return mergeAudioRefs(
    refs.map((ref) => ({
      ref: ref.ref,
      label: ref.label,
      accent: ref.accent,
    })),
  );
}

function mergeAudioRefs(...groups: DictionaryLearningAudioRef[][]): DictionaryLearningAudioRef[] {
  const out: DictionaryLearningAudioRef[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      const ref = item.ref.trim();
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      out.push({
        ref,
        label: item.label.trim() || audioLabel(item.accent),
        accent: item.accent,
      });
    }
  }
  return out;
}

function preferredAudioRef(refs: DictionaryLearningAudioRef[]): DictionaryLearningAudioRef | null {
  return (
    refs.find((ref) => ref.accent === "uk") ??
    refs.find((ref) => ref.accent === "us") ??
    refs[0] ??
    null
  );
}

function audioLabel(accent: DictionaryLearningAudioRef["accent"]): string {
  if (accent === "uk") return "UK";
  if (accent === "us") return "US";
  return "Audio";
}

function fallbackAudioRefs(audioRef: string | null): DictionaryLearningAudioRef[] {
  return audioRef ? [{ ref: audioRef, label: "Audio", accent: "other" }] : [];
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
    audioRefs: row.audioRefs ?? fallbackAudioRefs(row.audioRef),
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
