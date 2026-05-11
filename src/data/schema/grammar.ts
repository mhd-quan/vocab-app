import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { lessons } from "./curriculum";

/**
 * Grammar topic rows. Fine-grained teaching artifacts such as patterns,
 * examples, mistakes, and quick checks currently live in `metadata` so the
 * authoring surface can evolve without a migration for every prompt type.
 */
export const grammarTopics = sqliteTable(
  "grammar_topics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    sourceId: text("source_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summaryMd: text("summary_md"),
    explanationMd: text("explanation_md"),
    difficulty: integer("difficulty"),
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
    lessonSlugUnique: uniqueIndex("grammar_topics_lesson_slug_unique").on(t.lessonId, t.slug),
    titleIdx: index("grammar_topics_title_idx").on(t.title),
  }),
);
