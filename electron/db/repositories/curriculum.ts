import { and, asc, eq } from "drizzle-orm";
import { type LessonKind, books, lessons, units } from "../../../src/data/schema";
import type { Book, Lesson, Unit } from "../../../src/data/types";
import type { AppDatabase } from "../client";

/**
 * Read-only curriculum access for the renderer. Books, units, and lessons
 * are populated exclusively by the import pipeline (PR #4); we don't expose
 * write methods here to prevent accidental UI-driven schema drift.
 */
export function createCurriculumRepository(db: AppDatabase) {
  return {
    listBooks(): Book[] {
      return db.select().from(books).orderBy(asc(books.code)).all();
    },

    getBookById(id: number): Book | null {
      return db.select().from(books).where(eq(books.id, id)).get() ?? null;
    },

    getBookByCode(code: string): Book | null {
      return db.select().from(books).where(eq(books.code, code)).get() ?? null;
    },

    listUnitsByBook(bookId: number): Unit[] {
      return db
        .select()
        .from(units)
        .where(eq(units.bookId, bookId))
        .orderBy(asc(units.ordinal))
        .all();
    },

    getUnitById(id: number): Unit | null {
      return db.select().from(units).where(eq(units.id, id)).get() ?? null;
    },

    listLessonsByUnit(unitId: number, kind?: LessonKind): Lesson[] {
      const baseQuery = db.select().from(lessons);
      const filtered = kind
        ? baseQuery.where(and(eq(lessons.unitId, unitId), eq(lessons.kind, kind)))
        : baseQuery.where(eq(lessons.unitId, unitId));
      return filtered.orderBy(asc(lessons.ordinal)).all();
    },

    getLessonById(id: number): Lesson | null {
      return db.select().from(lessons).where(eq(lessons.id, id)).get() ?? null;
    },
  };
}

export type CurriculumRepository = ReturnType<typeof createCurriculumRepository>;
