import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { lessons } from "./curriculum";

export const partsOfSpeech = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrase",
  "idiom",
  "phrasal_verb",
  "collocation",
  "pattern",
  "determiner",
  "preposition",
  "conjunction",
  "pronoun",
  "interjection",
  "article",
  "auxiliary",
  "modal",
  "number",
  "abbreviation",
  "prefix",
  "suffix",
  "root",
] as const;
export type PartOfSpeech = (typeof partsOfSpeech)[number];

export const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof cefrLevels)[number];

/**
 * A headword entry — the unit a flashcard / quiz card maps to.
 * `sourceId` is the stable id from the YAML source file (e.g. "relative-noun")
 * and powers idempotent re-import.
 */
export const vocabEntries = sqliteTable(
  "vocab_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    sourceId: text("source_id"),
    headword: text("headword").notNull(),
    lemma: text("lemma"),
    pos: text("pos").$type<PartOfSpeech>().notNull(),
    ipa: text("ipa"),
    cefrLevel: text("cefr_level").$type<CefrLevel>(),
    frequencyRank: integer("frequency_rank"),
    imageRef: text("image_ref"),
    audioRef: text("audio_ref"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    contentHash: text("content_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    lessonSourceUnique: uniqueIndex("vocab_entries_lesson_source_unique")
      .on(t.lessonId, t.sourceId)
      .where(sql`${t.sourceId} IS NOT NULL`),
    headwordIdx: index("vocab_entries_headword_idx").on(t.headword),
    lessonHeadwordIdx: index("vocab_entries_lesson_headword_idx").on(t.lessonId, t.headword),
  }),
);

export const vocabRegisters = [
  "formal",
  "informal",
  "neutral",
  "slang",
  "academic",
  "technical",
  "literary",
] as const;
export type VocabRegister = (typeof vocabRegisters)[number];

export const vocabSenses = sqliteTable(
  "vocab_senses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => vocabEntries.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull().default(0),
    definitionEn: text("definition_en"),
    definitionVi: text("definition_vi"),
    register: text("register").$type<VocabRegister>(),
    domain: text("domain"),
    notesMd: text("notes_md"),
  },
  (t) => ({
    entryOrdinalIdx: index("vocab_senses_entry_ordinal_idx").on(t.entryId, t.ordinal),
  }),
);

export const vocabExamples = sqliteTable(
  "vocab_examples",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => vocabEntries.id, { onDelete: "cascade" }),
    senseId: integer("sense_id").references(() => vocabSenses.id, { onDelete: "set null" }),
    ordinal: integer("ordinal").notNull().default(0),
    text: text("text").notNull(),
    translation: text("translation"),
    clozeTarget: text("cloze_target"),
    clozeHint: text("cloze_hint"),
    audioRef: text("audio_ref"),
    sourceRef: text("source_ref"),
  },
  (t) => ({
    entryOrdinalIdx: index("vocab_examples_entry_ordinal_idx").on(t.entryId, t.ordinal),
  }),
);

export const vocabFormKinds = [
  "plural",
  "past",
  "past_participle",
  "gerund",
  "third_person",
  "comparative",
  "superlative",
  "infinitive",
  "noun",
  "verb",
  "adjective",
  "adverb",
  "opposite",
  "prefix",
  "suffix",
  "root",
  "compound",
  "derivative",
] as const;
export type VocabFormKind = (typeof vocabFormKinds)[number];

export const vocabForms = sqliteTable(
  "vocab_forms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => vocabEntries.id, { onDelete: "cascade" }),
    kind: text("kind").$type<VocabFormKind>().notNull(),
    formText: text("form_text").notNull(),
    ipa: text("ipa"),
  },
  (t) => ({
    entryKindIdx: index("vocab_forms_entry_kind_idx").on(t.entryId, t.kind),
  }),
);

export const collocationPatterns = [
  "verb+noun",
  "adj+noun",
  "noun+noun",
  "verb+prep",
  "adj+prep",
  "noun+prep",
  "prep+noun",
  "verb+object+prep",
  "verb+object+infinitive",
  "verb+object+bare_infinitive",
  "verb+gerund",
  "verb+infinitive",
  "adj+infinitive",
  "adj+that_clause",
  "noun+of+noun",
  "be+adj+prep",
  "adv+adj",
  "adv+verb",
  "other",
] as const;
export type CollocationPattern = (typeof collocationPatterns)[number];

export const vocabCollocations = sqliteTable(
  "vocab_collocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => vocabEntries.id, { onDelete: "cascade" }),
    collocation: text("collocation").notNull(),
    pattern: text("pattern").$type<CollocationPattern>(),
    exampleText: text("example_text"),
    notesMd: text("notes_md"),
  },
  (t) => ({
    entryIdx: index("vocab_collocations_entry_idx").on(t.entryId),
  }),
);

export const vocabRelationKinds = [
  "synonym",
  "antonym",
  "see_also",
  "derived_from",
  "confused_with",
  "false_friend",
  "hypernym",
  "hyponym",
  "word_family",
  "topic_family",
  "variant",
  "prefix_of",
  "suffix_of",
] as const;
export type VocabRelationKind = (typeof vocabRelationKinds)[number];

export const vocabRelations = sqliteTable(
  "vocab_relations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => vocabEntries.id, { onDelete: "cascade" }),
    relatedEntryId: integer("related_entry_id").references(() => vocabEntries.id, {
      onDelete: "set null",
    }),
    relatedText: text("related_text"),
    relation: text("relation").$type<VocabRelationKind>().notNull(),
  },
  (t) => ({
    entryRelationIdx: index("vocab_relations_entry_relation_idx").on(t.entryId, t.relation),
  }),
);
