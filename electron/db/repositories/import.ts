import { asc, desc, eq } from "drizzle-orm";
import {
  type ImportAction,
  type ImportStatus,
  importItems,
  importRuns,
} from "../../../src/data/schema";
import type { ImportItem, ImportRun } from "../../../src/data/types";
import type { AppDatabase } from "../client";

export interface StartRunInput {
  sourcePath: string;
  contentHash: string;
}

export interface FinishRunInput {
  runId: number;
  status: ImportStatus;
  stats: Record<string, number>;
  errorLog?: string | null;
}

export interface LogItemInput {
  runId: number;
  sourceId?: string | null;
  targetTable: string;
  targetId?: number | null;
  action: ImportAction;
  hash?: string | null;
  error?: string | null;
}

export function createImportRepository(db: AppDatabase) {
  return {
    startRun(input: StartRunInput): ImportRun {
      const row = db
        .insert(importRuns)
        .values({
          sourcePath: input.sourcePath,
          contentHash: input.contentHash,
          status: "pending",
        })
        .returning()
        .get();
      if (!row) throw new Error("Failed to insert import_run");
      return row;
    },

    finishRun(input: FinishRunInput): void {
      db.update(importRuns)
        .set({
          status: input.status,
          stats: input.stats,
          errorLog: input.errorLog ?? null,
          finishedAt: new Date(),
        })
        .where(eq(importRuns.id, input.runId))
        .run();
    },

    logItem(input: LogItemInput): void {
      db.insert(importItems)
        .values({
          runId: input.runId,
          sourceId: input.sourceId ?? null,
          targetTable: input.targetTable,
          targetId: input.targetId ?? null,
          action: input.action,
          hash: input.hash ?? null,
          error: input.error ?? null,
        })
        .run();
    },

    /** Most recent successful run for a given source path, if any. */
    findLatestSuccessful(sourcePath: string): ImportRun | null {
      return (
        db
          .select()
          .from(importRuns)
          .where(eq(importRuns.sourcePath, sourcePath))
          .orderBy(desc(importRuns.startedAt))
          .all()
          .find((run) => run.status === "success") ?? null
      );
    },

    /**
     * Most-recent-first listing of all import runs. Includes `id` as a
     * tiebreaker so two runs that share a millisecond keep a stable order.
     */
    listRuns(limit = 100): ImportRun[] {
      return db
        .select()
        .from(importRuns)
        .orderBy(desc(importRuns.startedAt), desc(importRuns.id))
        .limit(limit)
        .all();
    },

    /** Per-row outcomes for a single import run, in insertion order. */
    listItems(runId: number): ImportItem[] {
      return db
        .select()
        .from(importItems)
        .where(eq(importItems.runId, runId))
        .orderBy(asc(importItems.id))
        .all();
    },
  };
}

export type ImportRepository = ReturnType<typeof createImportRepository>;
