import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { students } from "./learner";
import { practiceSessions } from "./progress";
import type { CefrLevel, PartOfSpeech } from "./vocabulary";

export const dictionaryLearningStages = [
  "flashcard",
  "meaning_choice",
  "reverse_choice",
  "cloze",
  "typing",
  "retention",
] as const;
export type DictionaryLearningStage = (typeof dictionaryLearningStages)[number];

export const dictionaryLearningStatuses = ["learning", "short_term", "long_term"] as const;
export type DictionaryLearningStatus = (typeof dictionaryLearningStatuses)[number];

export const dictionarySearchEvents = sqliteTable(
  "dictionary_search_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    dictionaryKey: text("dictionary_key"),
    headword: text("headword"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    studentCreatedIdx: index("dictionary_search_events_student_created_idx").on(
      t.studentId,
      t.createdAt,
    ),
    studentQueryIdx: index("dictionary_search_events_student_query_idx").on(t.studentId, t.query),
  }),
);

export const dictionaryLearningItems = sqliteTable(
  "dictionary_learning_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    dictionaryKey: text("dictionary_key").notNull(),
    headword: text("headword").notNull(),
    pos: text("pos").$type<PartOfSpeech>().notNull(),
    ipa: text("ipa"),
    cefrLevel: text("cefr_level").$type<CefrLevel>(),
    definitionEn: text("definition_en").notNull(),
    definitionVi: text("definition_vi"),
    exampleText: text("example_text"),
    exampleTranslation: text("example_translation"),
    audioRef: text("audio_ref"),
    audioRefs: text("audio_refs", { mode: "json" }).$type<
      Array<{ ref: string; label: string; accent: "uk" | "us" | "other" }>
    >(),
    status: text("status").$type<DictionaryLearningStatus>().notNull().default("learning"),
    stage: text("stage").$type<DictionaryLearningStage>().notNull().default("flashcard"),
    correctInCycle: integer("correct_in_cycle").notNull().default(0),
    shortTermCorrect: integer("short_term_correct").notNull().default(0),
    totalCorrect: integer("total_correct").notNull().default(0),
    totalWrong: integer("total_wrong").notNull().default(0),
    score: integer("score").notNull().default(0),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
    nextDueAt: integer("next_due_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    studentKeyUnique: uniqueIndex("dictionary_learning_items_student_key_unique").on(
      t.studentId,
      t.dictionaryKey,
    ),
    studentDueIdx: index("dictionary_learning_items_student_due_idx").on(
      t.studentId,
      t.status,
      t.nextDueAt,
    ),
  }),
);

export const dictionaryLearningReviews = sqliteTable(
  "dictionary_learning_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: integer("item_id")
      .notNull()
      .references(() => dictionaryLearningItems.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => practiceSessions.id, {
      onDelete: "set null",
    }),
    stageBefore: text("stage_before").$type<DictionaryLearningStage>().notNull(),
    stageAfter: text("stage_after").$type<DictionaryLearningStage>().notNull(),
    statusAfter: text("status_after").$type<DictionaryLearningStatus>().notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
    answer: text("answer"),
    expected: text("expected"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    itemCreatedIdx: index("dictionary_learning_reviews_item_created_idx").on(t.itemId, t.createdAt),
    studentCreatedIdx: index("dictionary_learning_reviews_student_created_idx").on(
      t.studentId,
      t.createdAt,
    ),
  }),
);
