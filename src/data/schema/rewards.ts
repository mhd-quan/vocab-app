import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { students } from "./learner";

/**
 * Per-student unlocked achievements. The achievement catalogue itself
 * lives in code (`src/modules/rewards/achievements.ts`) — this table
 * only records *when* each one was first earned so the UI can show a
 * "just unlocked" toast and PR #10 analytics can sort by date.
 *
 * Re-evaluating from the event log + item_progress yields the same
 * unlocked set, so the table is a cache, not a source of truth.
 */
export const studentAchievements = sqliteTable(
  "student_achievements",
  {
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.achievementId] }),
    studentIdx: index("student_achievements_student_idx").on(t.studentId, t.unlockedAt),
  }),
);
