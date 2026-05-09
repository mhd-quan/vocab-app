import path from "node:path";
import process from "node:process";

const isElectron = Boolean(process.versions.electron);

/**
 * Resolves the on-disk location of `drizzle/` migrations.
 *
 * - Dev (`npm start`, vitest, tsx scripts): `<cwd>/drizzle`
 * - Packaged Electron: `<resources>/drizzle` (forge `extraResource` copies it)
 * - Override via `VOCAB_MIGRATIONS_PATH` for tests / odd setups
 */
export function getMigrationsPath(): string {
  if (process.env.VOCAB_MIGRATIONS_PATH) {
    return process.env.VOCAB_MIGRATIONS_PATH;
  }

  if (isElectron) {
    // Lazy-require keeps this module loadable from plain Node (CLI, tests).
    const electron = require("electron") as typeof import("electron");
    if (electron.app?.isPackaged) {
      return path.join(process.resourcesPath, "drizzle");
    }
  }

  return path.resolve(process.cwd(), "drizzle");
}

/**
 * Resolves the on-disk location of the SQLite database file.
 *
 * - Packaged Electron: `<userData>/vocab.db` (per-user, persists across upgrades)
 * - Dev Electron: `<userData>/vocab.dev.db`
 * - Plain Node (CLI / vitest): `<cwd>/data/dev.db`, or override via VOCAB_DB_PATH
 */
export function getDatabasePath(): string {
  if (process.env.VOCAB_DB_PATH) {
    return process.env.VOCAB_DB_PATH;
  }

  if (isElectron) {
    const electron = require("electron") as typeof import("electron");
    if (electron.app) {
      const filename = electron.app.isPackaged ? "vocab.db" : "vocab.dev.db";
      return path.join(electron.app.getPath("userData"), filename);
    }
  }

  return path.resolve(process.cwd(), "data", "dev.db");
}
