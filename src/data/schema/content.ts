import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { lessons } from "./curriculum";

/**
 * Polymorphic content registry. Practice sessions, exercises, and progress
 * all reference content_items rather than the concrete tables, so adding a
 * new content type later (vocab, grammar, custom exercise) does not require
 * migrating downstream tables.
 *
 * `refTable` + `refId` form a soft polymorphic FK. We don't enforce it at the
 * DB layer to keep migrations simple; the application layer owns the
 * invariant.
 */
export const contentItemKinds = ["vocab_entry", "grammar_topic", "exercise"] as const;
export type ContentItemKind = (typeof contentItemKinds)[number];

export const contentItemRefTables = ["vocab_entries", "grammar_topics", "exercises"] as const;
export type ContentItemRefTable = (typeof contentItemRefTables)[number];

export const contentItems = sqliteTable(
  "content_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").$type<ContentItemKind>().notNull(),
    refTable: text("ref_table").$type<ContentItemRefTable>().notNull(),
    refId: integer("ref_id").notNull(),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    refUnique: uniqueIndex("content_items_ref_unique").on(t.refTable, t.refId),
    lessonKindIdx: index("content_items_lesson_kind_idx").on(t.lessonId, t.kind),
  }),
);
