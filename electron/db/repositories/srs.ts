/**
 * SRS-specific reads. Writes still flow through `progress.recordAnswer`
 * (curated track) and `dictionaryLearning.recordReview` (personal track)
 * for now — Phase 3 deferred consolidating those two writers behind a
 * single `recordReview()` here. This module exists so the migration
 * banner has a clean home for the legacy-archive count.
 */
import type { AppDatabase } from "../client";

export interface SrsArchiveStatus {
  /** Tutor has dismissed the v0.10 migration banner. */
  acknowledged: boolean;
  /** Rows preserved in the `item_progress_v1_archive` table. */
  legacyRowCount: number;
}

export function createSrsRepository(db: AppDatabase) {
  return {
    /**
     * Count of rows surviving in the legacy SM-2 archive. Used by the
     * migration banner to show "X items were archived" before dismiss.
     * Returns 0 if the table doesn't exist (fresh install).
     */
    legacyArchiveCount(): number {
      try {
        const row = db.$sqlite
          .prepare("SELECT COUNT(*) AS n FROM item_progress_v1_archive")
          .get() as { n: number } | undefined;
        return row?.n ?? 0;
      } catch {
        return 0;
      }
    },
  };
}

export type SrsRepository = ReturnType<typeof createSrsRepository>;
