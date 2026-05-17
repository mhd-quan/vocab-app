/**
 * FSRS-lite SRS schema (v0.10+).
 *
 * `itemProgressV2` is the new live table — unified across the curated
 * vocabulary track and the personal-dict track via the `track` column.
 * It replaces the SM-2 triple (ease / interval_days / streak) with the
 * FSRS-lite triple (stability / difficulty / state). Reads that only
 * touched `next_due_at`, `last_seen_at`, `total_correct`, `total_wrong`
 * stay source-compatible.
 *
 * `itemProgressV1Archive` is the renamed legacy `item_progress` table.
 * Read-only after migration; kept around so v0.10.x can roll back by
 * renaming it back. NEVER delete inside v0.10.
 *
 * The append-only `learning_events` log (in `./progress.ts`) is the
 * source of truth and stays unchanged — that's by design (see the
 * comment on that table).
 */
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { contentItems } from "./content";
import { students } from "./learner";

export const fsrsStates = ["new", "learning", "short_term", "long_term"] as const;
export type FsrsScheduleState = (typeof fsrsStates)[number];

export const srsTracks = ["curated", "personal"] as const;
export type SrsTrack = (typeof srsTracks)[number];

/**
 * Per-(student, content_item) FSRS state. The primary key matches the
 * legacy `item_progress` table so existing analytics joins keep working.
 */
export const itemProgressV2 = sqliteTable(
  "item_progress_v2",
  {
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    contentItemId: integer("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    /** Discriminator — curated YAML or personal dictionary. */
    track: text("track").$type<SrsTrack>().notNull().default("curated"),
    /** FSRS stability in days. 0 ≡ "fresh — no memory yet". */
    stability: real("stability").notNull().default(0),
    /** FSRS difficulty in [1.0, 10.0]. 5.0 is the neutral default. */
    difficulty: real("difficulty").notNull().default(5),
    /** Derived from stability + thresholds at write time. */
    state: text("state").$type<FsrsScheduleState>().notNull().default("new"),
    /** Consecutive non-lapse reviews. */
    reps: integer("reps").notNull().default(0),
    /** Total failures over the item's lifetime. */
    lapses: integer("lapses").notNull().default(0),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    nextDueAt: integer("next_due_at", { mode: "timestamp_ms" }),
    totalCorrect: integer("total_correct").notNull().default(0),
    totalWrong: integer("total_wrong").notNull().default(0),
    /**
     * UI hint for the personal-track stage carousel. Nullable for the
     * curated track. Decoupled from scheduling so the FSRS algorithm
     * stays pure.
     */
    currentStageKind: text("current_stage_kind"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.contentItemId] }),
    nextDueIdx: index("item_progress_v2_next_due_idx").on(t.studentId, t.nextDueAt),
    trackIdx: index("item_progress_v2_student_track_idx").on(t.studentId, t.track),
  }),
);

/**
 * Frozen v1 (SM-2) state. Migration 0004 renames `item_progress` here.
 * No FK constraints — the migration drops them when renaming so the
 * table behaves as a pure read-only archive. Drizzle's typedef mirrors
 * the legacy column shape so the banner / diagnostics screen can count
 * rows or display past state.
 */
export const itemProgressV1Archive = sqliteTable("item_progress_v1_archive", {
  studentId: integer("student_id").notNull(),
  contentItemId: integer("content_item_id").notNull(),
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
});
