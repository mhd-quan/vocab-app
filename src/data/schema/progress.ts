import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
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
 * Append-only event log. All progress metrics (state, stability, mastery) are
 * derivable from this table, so changing the SRS algorithm doesn't corrupt
 * historical data. v0.10 migrated from SM-2 → FSRS-lite (see `./srs.ts`)
 * without touching this table.
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
 * `itemProgress` now points at the FSRS-lite v2 table. Re-exported here
 * so all the existing repo / analytics code that imports `itemProgress`
 * by name keeps compiling. The legacy SM-2 columns (`ease`,
 * `interval_days`, `streak`) are gone; new code reads `stability`,
 * `difficulty`, `state`, `reps`, `lapses` instead. Reads that only
 * touched `next_due_at`, `last_seen_at`, `total_correct`, `total_wrong`
 * keep working unchanged.
 */
export { itemProgressV2 as itemProgress, itemProgressV1Archive } from "./srs";
export type { FsrsScheduleState, SrsTrack } from "./srs";
export { fsrsStates, srsTracks } from "./srs";
