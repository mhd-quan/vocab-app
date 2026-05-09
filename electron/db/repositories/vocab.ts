import { asc, eq, inArray } from "drizzle-orm";
import {
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

export interface VocabEntryFull extends VocabEntry {
  senses: VocabSense[];
  examples: VocabExample[];
  forms: VocabForm[];
  collocations: VocabCollocation[];
  relations: VocabRelation[];
}

/**
 * Read access to vocabulary. Writes land in PR #4 alongside the import
 * pipeline so insertion logic stays colocated with validation.
 */
export function createVocabRepository(db: AppDatabase) {
  return {
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

    /**
     * Hydrate full entries (with children) for a lesson. Single SQL round
     * trip per child table — N+1-safe.
     */
    listFullByLesson(lessonId: number): VocabEntryFull[] {
      const entries = db
        .select()
        .from(vocabEntries)
        .where(eq(vocabEntries.lessonId, lessonId))
        .orderBy(asc(vocabEntries.headword))
        .all();
      return hydrateChildren(db, entries);
    },
  };
}

export type VocabRepository = ReturnType<typeof createVocabRepository>;

function hydrateChildren(db: AppDatabase, entries: VocabEntry[]): VocabEntryFull[] {
  if (entries.length === 0) return [];
  const ids = entries.map((e) => e.id);

  const [senses, examples, forms, collocations, relations] = [
    db.select().from(vocabSenses).where(inArray(vocabSenses.entryId, ids)).all(),
    db.select().from(vocabExamples).where(inArray(vocabExamples.entryId, ids)).all(),
    db.select().from(vocabForms).where(inArray(vocabForms.entryId, ids)).all(),
    db.select().from(vocabCollocations).where(inArray(vocabCollocations.entryId, ids)).all(),
    db.select().from(vocabRelations).where(inArray(vocabRelations.entryId, ids)).all(),
  ];

  const groupBy = <T extends { entryId: number }>(rows: T[]) => {
    const map = new Map<number, T[]>();
    for (const row of rows) {
      const list = map.get(row.entryId) ?? [];
      list.push(row);
      map.set(row.entryId, list);
    }
    return map;
  };

  const sensesByEntry = groupBy(senses);
  const examplesByEntry = groupBy(examples);
  const formsByEntry = groupBy(forms);
  const collocationsByEntry = groupBy(collocations);
  const relationsByEntry = groupBy(relations);

  return entries.map((entry) => ({
    ...entry,
    senses: sensesByEntry.get(entry.id) ?? [],
    examples: examplesByEntry.get(entry.id) ?? [],
    forms: formsByEntry.get(entry.id) ?? [],
    collocations: collocationsByEntry.get(entry.id) ?? [],
    relations: relationsByEntry.get(entry.id) ?? [],
  }));
}
