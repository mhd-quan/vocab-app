import fs from "node:fs";
import path from "node:path";
import Database, { type Database as SqliteDatabase } from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../../src/data/schema";
import { getDatabasePath, getMigrationsPath } from "./paths";

export type AppDatabase = BetterSQLite3Database<typeof schema> & {
  readonly $sqlite: SqliteDatabase;
};

/**
 * The handle yielded inside `db.transaction((tx) => …)`. Typed via the
 * parameter of Drizzle's `transaction` so we never depend on Drizzle's
 * internal class names — both the tx and the top-level db expose the
 * same query API to repository code.
 */
export type AppTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export interface OpenDbOptions {
  /** Override the resolved DB path. `:memory:` opens a transient in-memory DB. */
  dbPath?: string;
  /** Override the resolved migrations folder. */
  migrationsPath?: string;
  /** Skip migrations entirely (useful for read-only debug sessions). */
  skipMigrations?: boolean;
  /** Print every executed SQL statement. Off by default. */
  verbose?: boolean;
}

/**
 * Opens a SQLite connection and runs pending migrations.
 *
 * Always returns a fully-migrated DB. Callers are responsible for closing it
 * via `closeDatabase(db)` on app shutdown.
 */
export function openDatabase(options: OpenDbOptions = {}): AppDatabase {
  const dbPath = options.dbPath ?? getDatabasePath();
  const migrationsPath = options.migrationsPath ?? getMigrationsPath();

  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const sqlite = new Database(dbPath, options.verbose ? { verbose: console.log } : {});

  // Pragmas: WAL for concurrent reads, FKs on for cascades, busy timeout
  // so a renderer hitting the DB during a write doesn't error out.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  const db = drizzle(sqlite, { schema });
  Object.defineProperty(db, "$sqlite", { value: sqlite, writable: false, enumerable: false });

  if (!options.skipMigrations) {
    drizzleMigrate(db, { migrationsFolder: migrationsPath });
  }

  return db as unknown as AppDatabase;
}

export function closeDatabase(db: AppDatabase): void {
  db.$sqlite.close();
}
