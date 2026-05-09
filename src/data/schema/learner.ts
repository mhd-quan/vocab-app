import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { books, units } from "./curriculum";

export const students = sqliteTable(
  "students",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    displayName: text("display_name"),
    avatarSeed: text("avatar_seed"),
    color: text("color"),
    pinHash: text("pin_hash"),
    notes: text("notes"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    nameIdx: index("students_name_idx").on(t.name),
  }),
);

export const enrollmentStatuses = ["active", "paused", "completed", "dropped"] as const;
export type EnrollmentStatus = (typeof enrollmentStatuses)[number];

export const enrollments = sqliteTable(
  "enrollments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    currentUnitId: integer("current_unit_id").references(() => units.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<EnrollmentStatus>().notNull().default("active"),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    studentBookUnique: uniqueIndex("enrollments_student_book_unique").on(t.studentId, t.bookId),
    studentStatusIdx: index("enrollments_student_status_idx").on(t.studentId, t.status),
  }),
);
