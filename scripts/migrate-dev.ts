/**
 * Run pending migrations against the dev database without launching Electron.
 *
 *   npm run db:migrate:dev
 *
 * Useful when you want to inspect the schema with `sqlite3 data/dev.db`
 * before any app code touches it.
 */
import { closeDatabase, openDatabase } from "../electron/db";

const db = openDatabase();
console.log("Migrations applied. Schema is up to date.");
closeDatabase(db);
