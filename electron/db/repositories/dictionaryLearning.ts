import { and, asc, desc, eq, inArray, lte, or } from "drizzle-orm";
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
  appSettings,
  dictionaryLearningItems,
  dictionaryLearningReviews,
  dictionarySearchEvents,
} from "../../../src/data/schema";
import type { SelfGrade } from "../../../src/modules/exercises";
import { fsrs } from "../../../src/modules/srs";
import type { AppDatabase, AppTransaction } from "../client";

/**
 * Kind rotation for the UI dispatcher. Each correct review advances the
 * stage hint one entry forward; a wrong review resets to "flashcard"
 * (the gentlest re-introduction). Mirrors the legacy SM-2-flavored
 * cycle so the UI never has to know we swapped schedulers underneath.
 */
const STAGE_ROTATION: DictionaryLearningStage[] = [
  "flashcard",
  "meaning_choice",
  "reverse_choice",
  "cloze",
  "typing",
  "retention",
];

const FSRS_SHORT_TERM_KEY = "fsrs_short_term_days";
const FSRS_LONG_TERM_KEY = "fsrs_long_term_days";

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
  selfGrade?: SelfGrade | null;
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
      // `averageScore` is now derived from FSRS stability: items with
      // higher stability score better. Clamp to 0..100 for legacy UI
      // gauges that expect that range. 7 days stability ≈ 50 points.
      const scoreSum = rows.reduce((sum, row) => sum + stabilityScore(row.stability), 0);
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

        // FSRS-lite scheduling: thresholds are tutor-tunable, same key set
        // as the curated track so a single Settings panel drives both.
        const thresholds = loadFsrsThresholds(tx);
        const rating = fsrs.ratingFromOutcome({
          correct: input.correct,
          feedback: "",
          selfGrade: input.selfGrade ?? null,
          selectedIndex: null,
        });
        const next = fsrs.applyAnswer({
          prev: {
            stability: item.stability,
            difficulty: item.difficulty,
            state: item.state,
            reps: item.reps,
            lapses: item.lapses,
          },
          rating,
          now,
          thresholds,
        });

        const nextStatus = mapFsrsStateToStatus(next.state);
        const nextStage = nextStageHint(item.stage, input.correct);
        const totalCorrect = item.totalCorrect + (input.correct ? 1 : 0);
        const totalWrong = item.totalWrong + (input.correct ? 0 : 1);

        const updated = tx
          .update(dictionaryLearningItems)
          .set({
            status: nextStatus,
            stage: nextStage,
            stability: next.stability,
            difficulty: next.difficulty,
            state: next.state,
            reps: next.reps,
            lapses: next.lapses,
            totalCorrect,
            totalWrong,
            lastReviewedAt: now,
            nextDueAt: next.dueAt,
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

/**
 * Pick the next exercise kind the UI should render. On a correct answer
 * the rotation walks STAGE_ROTATION forward by one; on a wrong answer we
 * reset to "flashcard" so the kid gets a gentler re-introduction. This
 * keeps the perceived "stage cycle" UX from the legacy algorithm while
 * the underlying scheduling is FSRS-lite.
 */
function nextStageHint(
  current: DictionaryLearningStage,
  correct: boolean,
): DictionaryLearningStage {
  if (!correct) return "flashcard";
  const index = STAGE_ROTATION.indexOf(current);
  if (index < 0) return "meaning_choice";
  return STAGE_ROTATION[(index + 1) % STAGE_ROTATION.length] ?? "flashcard";
}

/** FSRS state → legacy `status` label so the UI grouping stays meaningful. */
function mapFsrsStateToStatus(state: fsrs.FsrsState): DictionaryLearningStatus {
  if (state === "long_term") return "long_term";
  if (state === "short_term") return "short_term";
  return "learning";
}

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

/**
 * Map FSRS stability (days) onto the legacy 0..100 score the summary
 * surfaces. 0 days → 0; 21 days (default long-term threshold) → 100;
 * linear in between. Cosmetic only — never feeds the scheduler.
 */
function stabilityScore(stability: number): number {
  const ceiling = fsrs.DEFAULT_THRESHOLDS.longTermDays;
  if (stability <= 0) return 0;
  const ratio = stability / ceiling;
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
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
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    totalCorrect: row.totalCorrect,
    totalWrong: row.totalWrong,
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
