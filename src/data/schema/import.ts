import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const importStatuses = ["pending", "success", "partial", "failed"] as const;
export type ImportStatus = (typeof importStatuses)[number];

export const importActions = ["inserted", "updated", "skipped", "failed", "deleted"] as const;
export type ImportAction = (typeof importActions)[number];

/**
 * One row per `npm run import:*` invocation. `contentHash` lets the next run
 * short-circuit if the source file hasn't changed.
 */
export const importRuns = sqliteTable(
  "import_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourcePath: text("source_path").notNull(),
    contentHash: text("content_hash").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    status: text("status").$type<ImportStatus>().notNull().default("pending"),
    stats: text("stats", { mode: "json" }).$type<Record<string, number>>(),
    errorLog: text("error_log"),
  },
  (t) => ({
    sourceStartedIdx: index("import_runs_source_started_idx").on(t.sourcePath, t.startedAt),
  }),
);

export const importItems = sqliteTable(
  "import_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => importRuns.id, { onDelete: "cascade" }),
    sourceId: text("source_id"),
    targetTable: text("target_table").notNull(),
    targetId: integer("target_id"),
    action: text("action").$type<ImportAction>().notNull(),
    hash: text("hash"),
    error: text("error"),
  },
  (t) => ({
    runIdx: index("import_items_run_idx").on(t.runId),
    targetIdx: index("import_items_target_idx").on(t.targetTable, t.targetId),
  }),
);
