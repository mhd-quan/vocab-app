import { eq } from "drizzle-orm";
import { appSettings } from "../../../src/data/schema";
import type { AppDatabase } from "../client";

/**
 * Type-safe wrapper around the singleton key/value `app_settings` table.
 *
 * Generic accessors are provided; consumers should layer their own typed
 * helpers per known key (e.g. `getTutorPin`, `setActiveStudentId`).
 */
export function createSettingsRepository(db: AppDatabase) {
  return {
    get<T = unknown>(key: string): T | undefined {
      const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
      return row?.value as T | undefined;
    },

    set(key: string, value: unknown): void {
      db.insert(appSettings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedAt: new Date() },
        })
        .run();
    },

    delete(key: string): void {
      db.delete(appSettings).where(eq(appSettings.key, key)).run();
    },

    getAll(): Record<string, unknown> {
      const rows = db.select().from(appSettings).all();
      const result: Record<string, unknown> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return result;
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
