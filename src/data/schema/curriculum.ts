import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * A textbook (vd. Destination B1, Destination B2). Top of the curriculum
 * hierarchy. `code` is the stable slug we use across YAML imports and IPC.
 */
export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    level: text("level"),
    publisher: text("publisher"),
    language: text("language").notNull().default("en"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    codeUnique: uniqueIndex("books_code_unique").on(t.code),
  }),
);

export const units = sqliteTable(
  "units",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    summaryMd: text("summary_md"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    bookOrdinalUnique: uniqueIndex("units_book_ordinal_unique").on(t.bookId, t.ordinal),
    bookCodeUnique: uniqueIndex("units_book_code_unique").on(t.bookId, t.code),
  }),
);

export const lessonKinds = [
  "grammar",
  "vocabulary",
  "mixed",
  "reading",
  "listening",
  "revision",
  "exercise",
  "exam_practice",
] as const;
export type LessonKind = (typeof lessonKinds)[number];

export const lessons = sqliteTable(
  "lessons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    kind: text("kind").$type<LessonKind>().notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    unitSlugUnique: uniqueIndex("lessons_unit_slug_unique").on(t.unitId, t.slug),
    unitOrdinalIdx: index("lessons_unit_ordinal_idx").on(t.unitId, t.ordinal),
  }),
);
