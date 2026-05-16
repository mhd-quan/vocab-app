import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { students } from "./learner";
import { learningEvents, practiceSessions } from "./progress";

export const studentSyncIdentities = sqliteTable(
  "student_sync_identities",
  {
    studentId: integer("student_id")
      .primaryKey()
      .references(() => students.id, { onDelete: "cascade" }),
    syncId: text("sync_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    syncIdUnique: uniqueIndex("student_sync_identities_sync_id_unique").on(t.syncId),
  }),
);

export const syncImports = sqliteTable(
  "sync_imports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    packageId: text("package_id").notNull(),
    sourceDeviceId: text("source_device_id").notNull(),
    studentSyncId: text("student_sync_id").notNull(),
    exportedAt: integer("exported_at", { mode: "timestamp_ms" }).notNull(),
    importedAt: integer("imported_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    summary: text("summary", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => ({
    packageUnique: uniqueIndex("sync_imports_package_unique").on(t.packageId),
    studentImportedIdx: index("sync_imports_student_imported_idx").on(
      t.studentSyncId,
      t.importedAt,
    ),
  }),
);

export const syncImportedSessions = sqliteTable(
  "sync_imported_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceDeviceId: text("source_device_id").notNull(),
    sourceSessionId: integer("source_session_id").notNull(),
    localSessionId: integer("local_session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    importedAt: integer("imported_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    sourceUnique: uniqueIndex("sync_imported_sessions_source_unique").on(
      t.sourceDeviceId,
      t.sourceSessionId,
    ),
    localIdx: index("sync_imported_sessions_local_idx").on(t.localSessionId),
  }),
);

export const syncImportedEvents = sqliteTable(
  "sync_imported_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventUid: text("event_uid").notNull(),
    sourceDeviceId: text("source_device_id").notNull(),
    localEventId: integer("local_event_id")
      .notNull()
      .references(() => learningEvents.id, { onDelete: "cascade" }),
    importedAt: integer("imported_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    eventUidUnique: uniqueIndex("sync_imported_events_event_uid_unique").on(t.eventUid),
    localIdx: index("sync_imported_events_local_idx").on(t.localEventId),
  }),
);
