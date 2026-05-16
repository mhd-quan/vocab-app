import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import {
  vocabCollocations,
  vocabEntries,
  vocabExamples,
  vocabForms,
  vocabRelations,
  vocabSenses,
} from "../../../src/data/schema";
import { first, freshDb, seedCurriculum } from "../../helpers";

describe("VocabRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("returns empty arrays + zero counts for an unseeded lesson", () => {
    const { lesson } = seedCurriculum(db);
    expect(repos.vocab.listByLesson(lesson.id)).toEqual([]);
    expect(repos.vocab.listFullByLesson(lesson.id)).toEqual([]);
    expect(repos.vocab.countByLesson(lesson.id)).toBe(0);
    expect(repos.vocab.getById(1)).toBeNull();
  });

  it("listByLesson sorts entries alphabetically by headword", () => {
    const { lesson } = seedCurriculum(db);
    db.insert(vocabEntries).values({ lessonId: lesson.id, headword: "zebra", pos: "noun" }).run();
    db.insert(vocabEntries).values({ lessonId: lesson.id, headword: "apple", pos: "noun" }).run();
    db.insert(vocabEntries)
      .values({ lessonId: lesson.id, headword: "mountain", pos: "noun" })
      .run();

    const headwords = repos.vocab.listByLesson(lesson.id).map((e) => e.headword);
    expect(headwords).toEqual(["apple", "mountain", "zebra"]);
  });

  it("listFullByLesson hydrates senses, examples, forms, collocations, relations", () => {
    const { lesson } = seedCurriculum(db);
    const entry = first(
      db
        .insert(vocabEntries)
        .values({
          lessonId: lesson.id,
          headword: "relative",
          pos: "noun",
          ipa: "/ˈrelətɪv/",
          cefrLevel: "B1",
          tags: ["family"],
        })
        .returning()
        .all(),
    );

    db.insert(vocabSenses)
      .values([
        { entryId: entry.id, ordinal: 0, definitionEn: "family member" },
        { entryId: entry.id, ordinal: 1, definitionEn: "compared with another" },
      ])
      .run();
    db.insert(vocabExamples)
      .values({
        entryId: entry.id,
        text: "I have many relatives.",
        clozeTarget: "relatives",
      })
      .run();
    db.insert(vocabForms)
      .values({ entryId: entry.id, kind: "plural", formText: "relatives" })
      .run();
    db.insert(vocabCollocations)
      .values({ entryId: entry.id, collocation: "close relative", pattern: "adj+noun" })
      .run();
    db.insert(vocabRelations)
      .values({ entryId: entry.id, relation: "synonym", relatedText: "family member" })
      .run();

    const list = repos.vocab.listFullByLesson(lesson.id);
    expect(list).toHaveLength(1);
    const full = first(list);
    expect(full.headword).toBe("relative");
    expect(full.tags).toEqual(["family"]);
    expect(full.senses).toHaveLength(2);
    expect(full.examples).toHaveLength(1);
    expect(full.forms).toHaveLength(1);
    expect(full.collocations).toHaveLength(1);
    expect(full.relations).toHaveLength(1);
  });

  it("getById returns the same shape as listFullByLesson", () => {
    const { lesson } = seedCurriculum(db);
    const entry = first(
      db
        .insert(vocabEntries)
        .values({ lessonId: lesson.id, headword: "x", pos: "noun" })
        .returning()
        .all(),
    );
    db.insert(vocabSenses).values({ entryId: entry.id, definitionEn: "x def" }).run();

    const fetched = repos.vocab.getById(entry.id);
    expect(fetched?.id).toBe(entry.id);
    expect(fetched?.senses).toHaveLength(1);
    expect(fetched?.examples).toHaveLength(0);
  });

  it("findDictionaryMatches returns lesson context and Vietnamese content", () => {
    const { book, unit, lesson } = seedCurriculum(db);
    const entry = first(
      db
        .insert(vocabEntries)
        .values({
          lessonId: lesson.id,
          headword: "foundation stone",
          pos: "noun",
          cefrLevel: "B2",
        })
        .returning()
        .all(),
    );
    db.insert(vocabSenses)
      .values({
        entryId: entry.id,
        definitionEn: "a starting point",
        definitionVi: "nền tảng ban đầu",
      })
      .run();
    db.insert(vocabExamples)
      .values({
        entryId: entry.id,
        text: "This is the foundation stone.",
        translation: "Đây là nền tảng ban đầu.",
      })
      .run();

    const matches = repos.vocab.findDictionaryMatches({ term: "foundation-stone" });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: entry.id,
      bookTitle: book.title,
      unitTitle: unit.title,
      lessonTitle: lesson.title,
      unitOrdinal: 1,
      cefrLevel: "B2",
    });
    expect(matches[0]?.senses[0]?.definitionVi).toBe("nền tảng ban đầu");
    expect(matches[0]?.examples[0]?.translation).toBe("Đây là nền tảng ban đầu.");
  });

  it("hydration is N+1-safe across multiple entries", () => {
    const { lesson } = seedCurriculum(db);
    for (let i = 0; i < 5; i++) {
      const e = first(
        db
          .insert(vocabEntries)
          .values({ lessonId: lesson.id, headword: `word_${i}`, pos: "noun" })
          .returning()
          .all(),
      );
      db.insert(vocabSenses)
        .values({ entryId: e.id, definitionEn: `def_${i}` })
        .run();
    }
    const list = repos.vocab.listFullByLesson(lesson.id);
    expect(list).toHaveLength(5);
    expect(list.every((e) => e.senses.length === 1)).toBe(true);
  });
});
