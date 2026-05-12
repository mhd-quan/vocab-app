import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { contentItems } from "./content";
import { students } from "./learner";

export const practiceModes = [
  "flashcard",
  "multiple_choice",
  "fill_blank",
  "matching",
  "review",
  "mixed",
  "grammar",
  "revision",
  "unit_review",
  "multi_unit_review",
] as const;
export type PracticeMode = (typeof practiceModes)[number];

export const practiceSessions = sqliteTable(
  "practice_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    mode: text("mode").$type<PracticeMode>().notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    summary: text("summary", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => ({
    studentStartedIdx: index("practice_sessions_student_started_idx").on(t.studentId, t.startedAt),
  }),
);

export const learningEventKinds = [
  "viewed",
  "practiced",
  "answered_correct",
  "answered_wrong",
  "skipped",
  "marked_known",
  "marked_unknown",
] as const;
export type LearningEventKind = (typeof learningEventKinds)[number];

/**
 * Append-only event log. All progress metrics (streak, ease, mastery) are
 * derivable from this table, so changing SRS algorithm later won't corrupt
 * historical data.
 */
export const learningEvents = sqliteTable(
  "learning_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    contentItemId: integer("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => practiceSessions.id, {
      onDelete: "set null",
    }),
    kind: text("kind").$type<LearningEventKind>().notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    studentItemIdx: index("learning_events_student_item_idx").on(t.studentId, t.contentItemId),
    occurredAtIdx: index("learning_events_occurred_at_idx").on(t.occurredAt),
  }),
);

/**
 * Materialized snapshot of per-item progress. Always rebuildable from
 * learning_events, so we never block on it for correctness.
 */
export const itemProgress = sqliteTable(
  "item_progress",
  {
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    contentItemId: integer("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    nextDueAt: integer("next_due_at", { mode: "timestamp_ms" }),
    ease: integer("ease"),
    intervalDays: integer("interval_days"),
    streak: integer("streak").notNull().default(0),
    totalCorrect: integer("total_correct").notNull().default(0),
    totalWrong: integer("total_wrong").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.contentItemId] }),
    nextDueIdx: index("item_progress_next_due_idx").on(t.studentId, t.nextDueAt),
  }),
);
