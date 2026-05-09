import { and, asc, eq } from "drizzle-orm";
import { type LessonKind, books, lessons, units } from "../../../src/data/schema";
import type { Book, Lesson, NewBook, NewLesson, NewUnit, Unit } from "../../../src/data/types";
import type { AppDatabase } from "../client";

export interface UpsertBookInput {
  code: string;
  title: string;
  level?: string | null;
  publisher?: string | null;
  language?: string;
  metadata?: Record<string, unknown> | null;
}

export interface UpsertUnitInput {
  bookId: number;
  ordinal: number;
  code: string;
  title: string;
  summaryMd?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpsertLessonInput {
  unitId: number;
  ordinal: number;
  kind: LessonKind;
  title: string;
  slug: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Curriculum access. Reads (used by IPC) are public-facing; writes
 * (`upsert*`) are reserved for the import pipeline and are NOT exposed via
 * IPC, so the UI cannot accidentally mutate book/unit/lesson rows.
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

    /** Insert-or-update by `code`. Always returns the canonical row. */
    upsertBook(input: UpsertBookInput): Book {
      const values: NewBook = {
        code: input.code,
        title: input.title,
        level: input.level ?? null,
        publisher: input.publisher ?? null,
        language: input.language ?? "en",
        metadata: input.metadata ?? null,
        updatedAt: new Date(),
      };
      const row = db
        .insert(books)
        .values(values)
        .onConflictDoUpdate({
          target: books.code,
          set: {
            title: values.title,
            level: values.level,
            publisher: values.publisher,
            language: values.language,
            metadata: values.metadata,
            updatedAt: values.updatedAt,
          },
        })
        .returning()
        .get();
      if (!row) throw new Error(`Failed to upsert book ${input.code}`);
      return row;
    },

    /** Insert-or-update by `(book_id, code)`. */
    upsertUnit(input: UpsertUnitInput): Unit {
      const values: NewUnit = {
        bookId: input.bookId,
        ordinal: input.ordinal,
        code: input.code,
        title: input.title,
        summaryMd: input.summaryMd ?? null,
        metadata: input.metadata ?? null,
        updatedAt: new Date(),
      };
      const row = db
        .insert(units)
        .values(values)
        .onConflictDoUpdate({
          target: [units.bookId, units.code],
          set: {
            ordinal: values.ordinal,
            title: values.title,
            summaryMd: values.summaryMd,
            metadata: values.metadata,
            updatedAt: values.updatedAt,
          },
        })
        .returning()
        .get();
      if (!row) throw new Error(`Failed to upsert unit ${input.code}`);
      return row;
    },

    /** Insert-or-update by `(unit_id, slug)`. */
    upsertLesson(input: UpsertLessonInput): Lesson {
      const values: NewLesson = {
        unitId: input.unitId,
        ordinal: input.ordinal,
        kind: input.kind,
        title: input.title,
        slug: input.slug,
        metadata: input.metadata ?? null,
        updatedAt: new Date(),
      };
      const row = db
        .insert(lessons)
        .values(values)
        .onConflictDoUpdate({
          target: [lessons.unitId, lessons.slug],
          set: {
            ordinal: values.ordinal,
            kind: values.kind,
            title: values.title,
            metadata: values.metadata,
            updatedAt: values.updatedAt,
          },
        })
        .returning()
        .get();
      if (!row) throw new Error(`Failed to upsert lesson ${input.slug}`);
      return row;
    },
  };
}

export type CurriculumRepository = ReturnType<typeof createCurriculumRepository>;
