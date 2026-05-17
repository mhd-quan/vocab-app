import { and, asc, eq, or, sql } from "drizzle-orm";
import type { DictionaryLessonEntry } from "../../../src/data/dictionary";
import {
  type CefrLevel,
  type CollocationPattern,
  type PartOfSpeech,
  type VocabFormKind,
  type VocabRegister,
  type VocabRelationKind,
  books,
  contentItems,
  lessons,
  units,
  vocabCollocations,
  vocabEntries,
  vocabExamples,
  vocabForms,
  vocabRelations,
  vocabSenses,
} from "../../../src/data/schema";
import type {
  VocabCollocation,
  VocabEntry,
  VocabExample,
  VocabForm,
  VocabRelation,
  VocabSense,
} from "../../../src/data/types";
import type { AppDatabase } from "../client";
import { hydrateChildrenSingleQuery } from "./vocab.joins";

export interface VocabEntryFull extends VocabEntry {
  senses: VocabSense[];
  examples: VocabExample[];
  forms: VocabForm[];
  collocations: VocabCollocation[];
  relations: VocabRelation[];
}

export interface SenseInput {
  ordinal: number;
  definitionEn?: string | null;
  definitionVi?: string | null;
  register?: VocabRegister | null;
  domain?: string | null;
  notesMd?: string | null;
}

export interface ExampleInput {
  ordinal: number;
  text: string;
  translation?: string | null;
  clozeTarget?: string | null;
  clozeHint?: string | null;
  audioRef?: string | null;
  sourceRef?: string | null;
}

export interface FormInput {
  kind: VocabFormKind;
  formText: string;
  ipa?: string | null;
}

export interface CollocationInput {
  collocation: string;
  pattern?: CollocationPattern | null;
  exampleText?: string | null;
  notesMd?: string | null;
}

export interface RelationInput {
  relation: VocabRelationKind;
  relatedText?: string | null;
  relatedEntryId?: number | null;
}

export interface UpsertVocabEntryInput {
  lessonId: number;
  sourceId: string;
  contentHash: string;
  headword: string;
  lemma?: string | null;
  pos: PartOfSpeech;
  ipa?: string | null;
  cefrLevel?: CefrLevel | null;
  frequencyRank?: number | null;
  imageRef?: string | null;
  audioRef?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  senses: SenseInput[];
  examples: ExampleInput[];
  forms: FormInput[];
  collocations: CollocationInput[];
  relations: RelationInput[];
}

export type UpsertAction = "inserted" | "updated" | "skipped";

export interface UpsertVocabEntryResult {
  entryId: number;
  action: UpsertAction;
}

export function createVocabRepository(db: AppDatabase) {
  const repo = {
    listByLesson(lessonId: number): VocabEntry[] {
      return db
        .select()
        .from(vocabEntries)
        .where(eq(vocabEntries.lessonId, lessonId))
        .orderBy(asc(vocabEntries.headword))
        .all();
    },

    countByLesson(lessonId: number): number {
      const rows = db
        .select({ id: vocabEntries.id })
        .from(vocabEntries)
        .where(eq(vocabEntries.lessonId, lessonId))
        .all();
      return rows.length;
    },

    getById(id: number): VocabEntryFull | null {
      const entry = db.select().from(vocabEntries).where(eq(vocabEntries.id, id)).get();
      if (!entry) return null;
      return hydrateChildren(db, [entry])[0] ?? null;
    },

    listFullByLesson(lessonId: number): VocabEntryFull[] {
      const entries = db
        .select()
        .from(vocabEntries)
        .where(eq(vocabEntries.lessonId, lessonId))
        .orderBy(asc(vocabEntries.headword))
        .all();
      return hydrateChildren(db, entries);
    },

    findDictionaryMatches(input: {
      term: string;
      headword?: string | null;
    }): DictionaryLessonEntry[] {
      const terms = dictionaryMatchTerms(input.term, input.headword);
      if (terms.length === 0) return [];
      const conditions = terms.flatMap((term) => [
        sql`lower(${vocabEntries.headword}) = ${term}`,
        sql`lower(coalesce(${vocabEntries.lemma}, '')) = ${term}`,
      ]);

      const rows = db
        .select({
          entry: vocabEntries,
          lesson: lessons,
          unit: units,
          book: books,
        })
        .from(vocabEntries)
        .innerJoin(lessons, eq(vocabEntries.lessonId, lessons.id))
        .innerJoin(units, eq(lessons.unitId, units.id))
        .innerJoin(books, eq(units.bookId, books.id))
        .where(or(...conditions))
        .orderBy(
          asc(books.code),
          asc(units.ordinal),
          asc(lessons.ordinal),
          asc(vocabEntries.headword),
        )
        .all();

      const fullById = new Map(
        hydrateChildren(
          db,
          rows.map((row) => row.entry),
        ).map((entry) => [entry.id, entry]),
      );
      return rows.map(({ entry, lesson, unit, book }) => {
        const full = fullById.get(entry.id);
        return {
          id: entry.id,
          headword: entry.headword,
          lemma: entry.lemma,
          pos: entry.pos,
          ipa: entry.ipa,
          cefrLevel: entry.cefrLevel,
          audioRef: entry.audioRef,
          bookCode: book.code,
          bookTitle: book.title,
          unitCode: unit.code,
          unitTitle: unit.title,
          unitOrdinal: unit.ordinal,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          senses:
            full?.senses.map((sense) => ({
              definitionEn: sense.definitionEn,
              definitionVi: sense.definitionVi,
            })) ?? [],
          examples:
            full?.examples.map((example) => ({
              text: example.text,
              translation: example.translation,
            })) ?? [],
        };
      });
    },

    /**
     * Atomically upsert one entry plus its children.
     *
     * Idempotency: when an existing row's `contentHash` matches the input's
     * we early-return `skipped` without touching the DB. Any other case
     * wipes the entry's children and re-inserts them — simpler and safer
     * than diffing each child collection.
     *
     * The first insert also seeds a row in `content_items` so progress and
     * exercise tables can reference the entry polymorphically.
     */
    upsertEntryWithChildren(input: UpsertVocabEntryInput): UpsertVocabEntryResult {
      return db.transaction((tx) => {
        const existing = tx
          .select()
          .from(vocabEntries)
          .where(
            and(
              eq(vocabEntries.lessonId, input.lessonId),
              eq(vocabEntries.sourceId, input.sourceId),
            ),
          )
          .get();

        if (existing && existing.contentHash === input.contentHash) {
          return { entryId: existing.id, action: "skipped" as const };
        }

        const now = new Date();
        let entryId: number;
        let action: UpsertAction;

        if (existing) {
          tx.update(vocabEntries)
            .set({
              headword: input.headword,
              lemma: input.lemma ?? null,
              pos: input.pos,
              ipa: input.ipa ?? null,
              cefrLevel: input.cefrLevel ?? null,
              frequencyRank: input.frequencyRank ?? null,
              imageRef: input.imageRef ?? null,
              audioRef: input.audioRef ?? null,
              tags: input.tags ?? null,
              metadata: input.metadata ?? null,
              contentHash: input.contentHash,
              updatedAt: now,
            })
            .where(eq(vocabEntries.id, existing.id))
            .run();
          entryId = existing.id;
          action = "updated";

          tx.delete(vocabSenses).where(eq(vocabSenses.entryId, entryId)).run();
          tx.delete(vocabExamples).where(eq(vocabExamples.entryId, entryId)).run();
          tx.delete(vocabForms).where(eq(vocabForms.entryId, entryId)).run();
          tx.delete(vocabCollocations).where(eq(vocabCollocations.entryId, entryId)).run();
          tx.delete(vocabRelations).where(eq(vocabRelations.entryId, entryId)).run();
        } else {
          const inserted = tx
            .insert(vocabEntries)
            .values({
              lessonId: input.lessonId,
              sourceId: input.sourceId,
              headword: input.headword,
              lemma: input.lemma ?? null,
              pos: input.pos,
              ipa: input.ipa ?? null,
              cefrLevel: input.cefrLevel ?? null,
              frequencyRank: input.frequencyRank ?? null,
              imageRef: input.imageRef ?? null,
              audioRef: input.audioRef ?? null,
              tags: input.tags ?? null,
              metadata: input.metadata ?? null,
              contentHash: input.contentHash,
              createdAt: now,
              updatedAt: now,
            })
            .returning({ id: vocabEntries.id })
            .get();
          if (!inserted) throw new Error("Failed to insert vocab entry");
          entryId = inserted.id;
          action = "inserted";

          tx.insert(contentItems)
            .values({
              kind: "vocab_entry",
              refTable: "vocab_entries",
              refId: entryId,
              lessonId: input.lessonId,
              tags: input.tags ?? null,
            })
            .run();
        }

        if (input.senses.length > 0) {
          tx.insert(vocabSenses)
            .values(input.senses.map((s) => ({ ...s, entryId })))
            .run();
        }
        if (input.examples.length > 0) {
          tx.insert(vocabExamples)
            .values(input.examples.map((e) => ({ ...e, entryId })))
            .run();
        }
        if (input.forms.length > 0) {
          tx.insert(vocabForms)
            .values(input.forms.map((f) => ({ ...f, entryId })))
            .run();
        }
        if (input.collocations.length > 0) {
          tx.insert(vocabCollocations)
            .values(input.collocations.map((c) => ({ ...c, entryId })))
            .run();
        }
        if (input.relations.length > 0) {
          tx.insert(vocabRelations)
            .values(input.relations.map((r) => ({ ...r, entryId })))
            .run();
        }

        return { entryId, action };
      });
    },

    /** Delete an entry. CASCADE removes children + the content_items row. */
    deleteById(id: number): void {
      db.transaction((tx) => {
        tx.delete(contentItems)
          .where(and(eq(contentItems.refTable, "vocab_entries"), eq(contentItems.refId, id)))
          .run();
        tx.delete(vocabEntries).where(eq(vocabEntries.id, id)).run();
      });
    },

    /** All entry ids that exist for a lesson (fast — single column scan). */
    listIdsByLesson(lessonId: number): Array<{ id: number; sourceId: string | null }> {
      return db
        .select({ id: vocabEntries.id, sourceId: vocabEntries.sourceId })
        .from(vocabEntries)
        .where(eq(vocabEntries.lessonId, lessonId))
        .all();
    },
  };
  return repo;
}

export type VocabRepository = ReturnType<typeof createVocabRepository>;

function dictionaryMatchTerms(term: string, headword?: string | null): string[] {
  const seeds = [term, headword ?? ""];
  const out = new Set<string>();
  for (const seed of seeds) {
    const normalized = seed.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized) continue;
    out.add(normalized);
    out.add(normalized.replace(/-/g, " "));
    out.add(normalized.replace(/\s+/g, "-"));
  }
  return [...out].filter(Boolean);
}

function hydrateChildren(db: AppDatabase, entries: VocabEntry[]): VocabEntryFull[] {
  if (entries.length === 0) return [];
  // One SQL round trip — see `vocab.joins.ts` for the UNION ALL query.
  const bundles = hydrateChildrenSingleQuery(
    db,
    entries.map((e) => e.id),
  );
  return entries.map((entry) => {
    const bundle = bundles.get(entry.id);
    return {
      ...entry,
      senses: bundle?.senses ?? [],
      examples: bundle?.examples ?? [],
      forms: bundle?.forms ?? [],
      collocations: bundle?.collocations ?? [],
      relations: bundle?.relations ?? [],
    };
  });
}
