import path from "node:path";
import process from "node:process";
import { app } from "electron";

const CONTENT_ROOT_ENV = "VOCAB_CONTENT_ROOT";

/**
 * Resolves the writable library where in-app YAML imports are copied before
 * they are parsed by ImportVocabUseCase.
 *
 * - Packaged Electron: `<userData>/content/books` so imports survive upgrades
 *   and never depend on Finder's launch cwd or the read-only app bundle.
 * - Dev Electron / CLI tests: `<cwd>/content/books` for repo-local authoring.
 * - Override via VOCAB_CONTENT_ROOT for tests and operational recovery.
 */
export function getImportedContentBooksRoot(): string {
  const override = process.env[CONTENT_ROOT_ENV];
  if (override) return path.resolve(override);

  if (app?.isPackaged) {
    return path.join(app.getPath("userData"), "content", "books");
  }

  return path.resolve(process.cwd(), "content", "books");
}
