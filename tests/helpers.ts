import { type AppDatabase, openDatabase } from "../electron/db";
import { type Repositories, createRepositories } from "../electron/db/repositories";
import { books, lessons, units } from "../src/data/schema";
import type { Book, Lesson, Unit } from "../src/data/types";

export function first<T>(rows: T[]): T {
  const value = rows[0];
  if (value === undefined) {
    throw new Error("Expected at least one row, got none");
  }
  return value;
}

export function freshDb(): { db: AppDatabase; repos: Repositories } {
  const db = openDatabase({ dbPath: ":memory:" });
  const repos = createRepositories(db);
  return { db, repos };
}

export interface CurriculumSeed {
  book: Book;
  unit: Unit;
  lesson: Lesson;
}

/**
 * Seed a minimal book → unit → lesson chain so tests that need a lesson
 * scope (vocab, content_items, ...) can avoid 12 lines of setup each.
 */
export function seedCurriculum(
  db: AppDatabase,
  overrides: Partial<{ bookCode: string; lessonKind: Lesson["kind"] }> = {},
): CurriculumSeed {
  const book = first(
    db
      .insert(books)
      .values({ code: overrides.bookCode ?? "destination-b1", title: "Destination B1" })
      .returning()
      .all(),
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
        kind: overrides.lessonKind ?? "vocabulary",
        title: "Lesson 1",
        slug: "lesson-1",
      })
      .returning()
      .all(),
  );
  return { book, unit, lesson };
}
