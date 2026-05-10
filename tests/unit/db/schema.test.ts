import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase, openDatabase } from "../../../electron/db";
import {
  books,
  contentItems,
  enrollments,
  importItems,
  importRuns,
  itemProgress,
  learningEvents,
  lessons,
  practiceSessions,
  students,
  units,
  vocabCollocations,
  vocabEntries,
  vocabExamples,
  vocabForms,
  vocabRelations,
  vocabSenses,
} from "../../../src/data/schema";
import { first } from "../../helpers";

describe("DB schema migrations", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = openDatabase({ dbPath: ":memory:" });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("creates all expected tables", () => {
    const rows = db.$sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all() as Array<{ name: string }>;
    const names = rows.map((r) => r.name).sort();

    expect(names).toEqual([
      "app_settings",
      "books",
      "content_items",
      "enrollments",
      "grammar_topics",
      "import_items",
      "import_runs",
      "item_progress",
      "learning_events",
      "lessons",
      "practice_sessions",
      "student_achievements",
      "students",
      "units",
      "vocab_collocations",
      "vocab_entries",
      "vocab_examples",
      "vocab_forms",
      "vocab_relations",
      "vocab_senses",
    ]);
  });

  it("enables foreign keys + cascades on vocab_entry deletion", () => {
    const fkPragma = db.$sqlite.pragma("foreign_keys", { simple: true });
    expect(fkPragma).toBe(1);

    const book = first(
      db.insert(books).values({ code: "destination-b1", title: "B1" }).returning().all(),
    );
    const unit = first(
      db
        .insert(units)
        .values({ bookId: book.id, ordinal: 1, code: "U01", title: "Unit 1" })
        .returning()
        .all(),
    );
    const lesson = first(
      db
        .insert(lessons)
        .values({
          unitId: unit.id,
          ordinal: 1,
          kind: "vocabulary",
          title: "Family",
          slug: "family",
        })
        .returning()
        .all(),
    );
    const entry = first(
      db
        .insert(vocabEntries)
        .values({
          lessonId: lesson.id,
          sourceId: "relative-noun",
          headword: "relative",
          pos: "noun",
          ipa: "/ˈrelətɪv/",
          cefrLevel: "B1",
          tags: ["family", "people"],
        })
        .returning()
        .all(),
    );

    db.insert(vocabSenses)
      .values({ entryId: entry.id, definitionEn: "a member of your family" })
      .run();
    db.insert(vocabExamples)
      .values({
        entryId: entry.id,
        text: "I have many relatives in Hanoi.",
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

    expect(db.select().from(vocabSenses).all()).toHaveLength(1);
    expect(db.select().from(vocabExamples).all()).toHaveLength(1);
    expect(db.select().from(vocabForms).all()).toHaveLength(1);
    expect(db.select().from(vocabCollocations).all()).toHaveLength(1);
    expect(db.select().from(vocabRelations).all()).toHaveLength(1);

    db.delete(vocabEntries).where(eq(vocabEntries.id, entry.id)).run();

    expect(db.select().from(vocabSenses).all()).toHaveLength(0);
    expect(db.select().from(vocabExamples).all()).toHaveLength(0);
    expect(db.select().from(vocabForms).all()).toHaveLength(0);
    expect(db.select().from(vocabCollocations).all()).toHaveLength(0);
    expect(db.select().from(vocabRelations).all()).toHaveLength(0);
  });

  it("enforces uniqueness on books.code and lessons.(unit_id, slug)", () => {
    db.insert(books).values({ code: "destination-b1", title: "B1" }).run();
    expect(() =>
      db.insert(books).values({ code: "destination-b1", title: "duplicate" }).run(),
    ).toThrow();

    const book = first(
      db.insert(books).values({ code: "destination-b2", title: "B2" }).returning().all(),
    );
    const unit = first(
      db
        .insert(units)
        .values({ bookId: book.id, ordinal: 1, code: "U01", title: "Unit 1" })
        .returning()
        .all(),
    );
    db.insert(lessons)
      .values({ unitId: unit.id, ordinal: 1, kind: "vocabulary", title: "L1", slug: "l1" })
      .run();
    expect(() =>
      db
        .insert(lessons)
        .values({ unitId: unit.id, ordinal: 2, kind: "grammar", title: "L1 dup", slug: "l1" })
        .run(),
    ).toThrow();
  });

  it("supports the polymorphic content_items registry", () => {
    const book = first(db.insert(books).values({ code: "b1", title: "B1" }).returning().all());
    const unit = first(
      db
        .insert(units)
        .values({ bookId: book.id, ordinal: 1, code: "U01", title: "Unit 1" })
        .returning()
        .all(),
    );
    const lesson = first(
      db
        .insert(lessons)
        .values({ unitId: unit.id, ordinal: 1, kind: "vocabulary", title: "L1", slug: "l1" })
        .returning()
        .all(),
    );
    const entry = first(
      db
        .insert(vocabEntries)
        .values({ lessonId: lesson.id, headword: "hello", pos: "interjection" })
        .returning()
        .all(),
    );

    const item = first(
      db
        .insert(contentItems)
        .values({
          kind: "vocab_entry",
          refTable: "vocab_entries",
          refId: entry.id,
          lessonId: lesson.id,
        })
        .returning()
        .all(),
    );

    expect(item.kind).toBe("vocab_entry");
    expect(item.refId).toBe(entry.id);

    expect(() =>
      db
        .insert(contentItems)
        .values({
          kind: "vocab_entry",
          refTable: "vocab_entries",
          refId: entry.id,
          lessonId: lesson.id,
        })
        .run(),
    ).toThrow();
  });

  it("supports the learner + progress event log", () => {
    const book = first(db.insert(books).values({ code: "b1", title: "B1" }).returning().all());
    const unit = first(
      db
        .insert(units)
        .values({ bookId: book.id, ordinal: 1, code: "U01", title: "U" })
        .returning()
        .all(),
    );
    const lesson = first(
      db
        .insert(lessons)
        .values({ unitId: unit.id, ordinal: 1, kind: "vocabulary", title: "L", slug: "l" })
        .returning()
        .all(),
    );
    const entry = first(
      db
        .insert(vocabEntries)
        .values({ lessonId: lesson.id, headword: "x", pos: "noun" })
        .returning()
        .all(),
    );
    const item = first(
      db
        .insert(contentItems)
        .values({
          kind: "vocab_entry",
          refTable: "vocab_entries",
          refId: entry.id,
          lessonId: lesson.id,
        })
        .returning()
        .all(),
    );

    const student = first(db.insert(students).values({ name: "Alice" }).returning().all());
    db.insert(enrollments)
      .values({ studentId: student.id, bookId: book.id, currentUnitId: unit.id })
      .run();

    const session = first(
      db
        .insert(practiceSessions)
        .values({ studentId: student.id, mode: "flashcard" })
        .returning()
        .all(),
    );

    db.insert(learningEvents)
      .values({
        studentId: student.id,
        contentItemId: item.id,
        sessionId: session.id,
        kind: "answered_correct",
      })
      .run();

    db.insert(itemProgress)
      .values({
        studentId: student.id,
        contentItemId: item.id,
        streak: 1,
        totalCorrect: 1,
      })
      .run();

    const events = db
      .select()
      .from(learningEvents)
      .where(eq(learningEvents.studentId, student.id))
      .all();
    expect(events).toHaveLength(1);
    expect(first(events).kind).toBe("answered_correct");

    const progress = db.select().from(itemProgress).all();
    expect(progress).toHaveLength(1);
    expect(first(progress).streak).toBe(1);
  });

  it("logs import runs + items", () => {
    const run = first(
      db
        .insert(importRuns)
        .values({
          sourcePath: "content/books/destination-b1/unit-01-vocab.yaml",
          contentHash: "abc123",
          status: "success",
          stats: { inserted: 5, updated: 0, skipped: 0 },
        })
        .returning()
        .all(),
    );

    db.insert(importItems)
      .values({
        runId: run.id,
        sourceId: "relative-noun",
        targetTable: "vocab_entries",
        targetId: 1,
        action: "inserted",
      })
      .run();

    const items = db.select().from(importItems).all();
    expect(items).toHaveLength(1);
    expect(first(items).action).toBe("inserted");
  });
});
