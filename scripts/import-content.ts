/**
 * CLI: import vocab YAML files into the local SQLite DB.
 *
 *   npm run import                       # imports all YAML in content/books/
 *   npm run import -- ./content/books/destination-b1
 *   npm run import:dry-run -- ./path
 *   npm run import:watch                 # re-runs on file changes
 *
 * Flags:
 *   --dry-run    Validate + show plan; don't write to the DB
 *   --watch      Watch for changes (chokidar) and re-import on save
 *   --force      Re-import even if file content_hash matches the last run
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import chokidar from "chokidar";
import { closeDatabase, openDatabase } from "../electron/db";
import { createRepositories } from "../electron/db/repositories";
import { type ImportFileResult, ImportVocabUseCase } from "../src/application/import";

const DEFAULT_GLOB = "content/books";

interface CliArgs {
  dryRun: boolean;
  watch: boolean;
  force: boolean;
  positionals: string[];
}

function parseCliArgs(): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      watch: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  return {
    dryRun: Boolean(values["dry-run"]),
    watch: Boolean(values.watch),
    force: Boolean(values.force),
    positionals,
  };
}

function printUsage(): void {
  console.log(`
Usage: npm run import [-- <path>...] [--dry-run] [--watch] [--force]

  <path>      File or directory. Directories are scanned for *-vocab.yaml.
              Defaults to content/books.

Flags:
  --dry-run   Validate + show what would change, do not write.
  --watch     Stay running and re-import on save.
  --force     Re-import even if the file's hash matches the last run.
  -h, --help  Show this help.
`);
}

async function expandPaths(args: string[]): Promise<string[]> {
  const targets = args.length > 0 ? args : [DEFAULT_GLOB];
  const out = new Set<string>();

  for (const target of targets) {
    const absoluteOrPattern = path.isAbsolute(target)
      ? target
      : path.resolve(process.cwd(), target);

    const stat = await safeStat(absoluteOrPattern);
    if (stat?.isFile()) {
      if (absoluteOrPattern.endsWith(".yaml") || absoluteOrPattern.endsWith(".yml")) {
        out.add(absoluteOrPattern);
      }
      continue;
    }
    if (stat?.isDirectory()) {
      const files = await fs.readdir(absoluteOrPattern, { recursive: true });
      for (const file of files) {
        if (typeof file === "string" && (file.endsWith("-vocab.yaml") || file.endsWith("-vocab.yml"))) {
          out.add(path.join(absoluteOrPattern, file));
        }
      }
      continue;
    }
    // Treat as relative pattern or just file
    if (target.endsWith("-vocab.yaml") || target.endsWith("-vocab.yml")) {
       out.add(path.resolve(process.cwd(), target));
    }
  }

  return [...out].sort();
}

async function safeStat(p: string) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

const STATUS_GLYPH: Record<ImportFileResult["status"], string> = {
  success: "✓",
  partial: "⚠",
  failed: "✗",
  skipped_unchanged: "·",
};

function printResult(result: ImportFileResult): void {
  const rel = path.relative(process.cwd(), result.filePath);
  const stats = result.stats;
  const summary = `+${stats.inserted} ~${stats.updated} =${stats.skipped} !${stats.failed}`;
  const head = `${STATUS_GLYPH[result.status]} ${rel.padEnd(60)} ${summary.padEnd(18)} ${result.durationMs}ms`;
  console.log(head);
  for (const err of result.errors) {
    console.log(`    ${err.sourceId ? `[${err.sourceId}] ` : ""}${err.message}`);
  }
}

function printBatchSummary(results: ImportFileResult[]): void {
  const total = results.reduce(
    (acc, r) => {
      acc.inserted += r.stats.inserted;
      acc.updated += r.stats.updated;
      acc.skipped += r.stats.skipped;
      acc.failed += r.stats.failed;
      return acc;
    },
    { inserted: 0, updated: 0, skipped: 0, failed: 0 },
  );
  const failedFiles = results.filter((r) => r.status === "failed").length;
  const partialFiles = results.filter((r) => r.status === "partial").length;
  const failedSuffix = failedFiles ? ` · ${failedFiles} file(s) failed` : "";
  const partialSuffix = partialFiles ? ` · ${partialFiles} partial` : "";
  console.log("─".repeat(60));
  console.log(
    `${results.length} file(s) · inserted ${total.inserted} · updated ${total.updated} · skipped ${total.skipped} · failed ${total.failed}${failedSuffix}${partialSuffix}`,
  );
}

async function runOnce(
  usecase: ImportVocabUseCase,
  files: string[],
  args: CliArgs,
): Promise<ImportFileResult[]> {
  const results: ImportFileResult[] = [];
  for (const file of files) {
    const result = await usecase.importFile(file, {
      dryRun: args.dryRun,
      force: args.force,
    });
    printResult(result);
    results.push(result);
  }
  printBatchSummary(results);
  return results;
}

async function main(): Promise<void> {
  const args = parseCliArgs();
  const db = openDatabase();
  const repos = createRepositories(db);
  const usecase = new ImportVocabUseCase({ repos });

  try {
    const files = await expandPaths(args.positionals);
    if (files.length === 0) {
      console.log(`No vocab YAML files matched. Default pattern: ${DEFAULT_GLOB}`);
    }

    const results = await runOnce(usecase, files, args);

    if (args.watch) {
      console.log("\nWatching for changes (Ctrl+C to stop)...");
      const watcher = chokidar.watch(files.length > 0 ? files : DEFAULT_GLOB, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
      });
      watcher.on("change", async (changedPath) => {
        const abs = path.isAbsolute(changedPath)
          ? changedPath
          : path.resolve(process.cwd(), changedPath);
        const result = await usecase.importFile(abs, { force: false });
        console.log("");
        printResult(result);
      });
      watcher.on("add", async (addedPath) => {
        const abs = path.isAbsolute(addedPath) ? addedPath : path.resolve(process.cwd(), addedPath);
        const result = await usecase.importFile(abs, { force: false });
        console.log("");
        printResult(result);
      });
      // Keep the process alive — chokidar holds it through its file handles,
      // but a SIGINT cleans up gracefully.
      await new Promise<void>((resolve) => {
        process.on("SIGINT", () => {
          watcher.close().finally(resolve);
        });
      });
    } else {
      const failed = results.some((r) => r.status === "failed" || r.status === "partial");
      process.exitCode = failed ? 1 : 0;
    }
  } finally {
    closeDatabase(db);
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
