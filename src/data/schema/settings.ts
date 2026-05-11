import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Singleton key/value store. Keys we expect:
 *   - tutor_pin_hash: bcrypt of the tutor PIN
 *   - active_student_id: which student profile is loaded
 *   - theme: 'dark' | 'light' | 'system'
 *   - locale: 'en' | 'vi'
 *   - schema_version: bumped by the app on first boot per version
 */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
