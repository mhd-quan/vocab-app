import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { ZodError } from "zod";
import type { Repositories } from "../../../electron/db/repositories";
import { type ParsedContentFile, parseContentFile } from "./content.parse";
import { GrammarParseError } from "./grammar.parse";
import { hashContent, sha256Hex } from "./hash";
import { type ParsedVocabFile, VocabParseError } from "./vocab.parse";

export interface ImportOptions {
  /** Validate + show a plan; do not write to the DB. */
  dryRun?: boolean;
  /** Re-import even when the file's content_hash matches the previous successful run. */
  force?: boolean;
}

export interface ImportItemResult {
  sourceId: string;
  action: "inserted" | "updated" | "skipped" | "failed";
  error?: string;
}

export interface ImportFileResult {
  filePath: string;
  fileHash: string;
  status: "success" | "partial" | "failed" | "skipped_unchanged";
  durationMs: number;
  bookCode?: string;
  unitCode?: string;
  lessonSlug?: string;
  stats: {
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  items: ImportItemResult[];
  errors: Array<{ sourceId?: string; message: string }>;
}

export interface ImportVocabUseCaseDeps {
  repos: Repositories;
}

export class ImportVocabUseCase {
  constructor(private readonly deps: ImportVocabUseCaseDeps) {}

  /**
   * Import one authored YAML file. The whole operation is structured around an
   * `import_runs` row so re-running on an unchanged file is a no-op
   * (skipped_unchanged) and partial failures are recoverable.
   *
   * Inside a single file we run book/unit/lesson upserts plus all content
   * upserts in one transaction — either everything from the file lands or
   * nothing does. Other files in a batch import are independent.
   */
  async importFile(filePath: string, opts: ImportOptions = {}): Promise<ImportFileResult> {
    const start = Date.now();
    const absPath = path.resolve(filePath);
    const baseResult: ImportFileResult = {
      filePath: absPath,
      fileHash: "",
      status: "failed",
      durationMs: 0,
      stats: { inserted: 0, updated: 0, skipped: 0, failed: 0 },
      items: [],
      errors: [],
    };

    let raw: string;
    try {
      raw = fs.readFileSync(absPath, "utf8");
    } catch (err) {
      baseResult.errors.push({ message: `Cannot read file: ${formatError(err)}` });
      baseResult.durationMs = Date.now() - start;
      return baseResult;
    }
    const fileHash = sha256Hex(raw);
    baseResult.fileHash = fileHash;

    // Short-circuit when the file hasn't changed since the last success.
    if (!opts.force && !opts.dryRun) {
      const previous = this.deps.repos.imports.findLatestSuccessful(absPath);
      if (previous && previous.contentHash === fileHash) {
        baseResult.status = "skipped_unchanged";
        baseResult.durationMs = Date.now() - start;
        return baseResult;
      }
    }

    let yamlData: unknown;
    try {
      yamlData = yaml.load(raw);
    } catch (err) {
      baseResult.errors.push({ message: `YAML parse error: ${formatError(err)}` });
      baseResult.durationMs = Date.now() - start;
      return baseResult;
    }

    let parsed: ParsedContentFile;
    try {
      parsed = parseContentFile(yamlData);
    } catch (err) {
      baseResult.errors.push(formatParseError(err));
      baseResult.durationMs = Date.now() - start;
      return baseResult;
    }

    baseResult.bookCode = parsed.file.book;
    baseResult.unitCode = parsed.file.unit.code;
    baseResult.lessonSlug = parsed.file.lesson.slug;

    if (opts.dryRun) {
      // Plan-only: classify each entry as inserted/updated/skipped against
      // current DB state without touching anything.
      const plan = this.dryRunPlan(parsed);
      baseResult.items = plan.items;
      baseResult.stats = plan.stats;
      baseResult.status =
        plan.stats.failed > 0
          ? "failed"
          : plan.stats.inserted + plan.stats.updated > 0
            ? "success"
            : "skipped_unchanged";
      baseResult.durationMs = Date.now() - start;
      return baseResult;
    }

    const run = this.deps.repos.imports.startRun({
      sourcePath: absPath,
      contentHash: fileHash,
    });

    let runStatus: "success" | "partial" | "failed" = "failed";
    try {
      const items = this.applyParsedFile(parsed, run.id);
      baseResult.items = items;
      for (const item of items) {
        baseResult.stats[item.action] += 1;
        if (item.action === "failed" && item.error) {
          baseResult.errors.push({ sourceId: item.sourceId, message: item.error });
        }
      }
      runStatus = baseResult.stats.failed > 0 ? "partial" : "success";
    } catch (err) {
      baseResult.errors.push({ message: `Import failed: ${formatError(err)}` });
      runStatus = "failed";
    }
    baseResult.status = runStatus;

    this.deps.repos.imports.finishRun({
      runId: run.id,
      status: runStatus,
      stats: { ...baseResult.stats },
      errorLog: baseResult.errors.length
        ? baseResult.errors.map((e) => `${e.sourceId ?? "(file)"}: ${e.message}`).join("\n")
        : null,
    });

    baseResult.durationMs = Date.now() - start;
    return baseResult;
  }

  private applyParsedFile(parsed: ParsedContentFile, runId: number): ImportItemResult[] {
    const items: ImportItemResult[] = [];
    const { repos } = this.deps;
    const file = parsed.file;

    const existingBook = repos.curriculum.getBookByCode(file.book);
    const book = repos.curriculum.upsertBook({
      code: file.book,
      title: file.bookTitle ?? existingBook?.title ?? deriveTitle(file.book),
    });
    repos.imports.logItem({
      runId,
      sourceId: book.code,
      targetTable: "books",
      targetId: book.id,
      action: "updated",
    });

    const unit = repos.curriculum.upsertUnit({
      bookId: book.id,
      ordinal: file.unit.ordinal,
      code: file.unit.code,
      title: file.unit.title,
      summaryMd: file.unit.summary_md ?? null,
      metadata: file.unit.metadata ?? null,
    });
    repos.imports.logItem({
      runId,
      sourceId: `${book.code}/${unit.code}`,
      targetTable: "units",
      targetId: unit.id,
      action: "updated",
    });

    const lesson = repos.curriculum.upsertLesson({
      unitId: unit.id,
      ordinal: file.lesson.ordinal,
      kind: file.lesson.kind,
      title: file.lesson.title,
      slug: file.lesson.slug,
      metadata: file.lesson.metadata ?? null,
    });
    repos.imports.logItem({
      runId,
      sourceId: `${book.code}/${unit.code}/${lesson.slug}`,
      targetTable: "lessons",
      targetId: lesson.id,
      action: "updated",
    });

    if (parsed.kind === "vocabulary") {
      for (const entry of parsed.file.entries) {
        try {
          const upsertInput = entry.toUpsertInput(lesson.id);
          const result = repos.vocab.upsertEntryWithChildren(upsertInput);
          items.push({ sourceId: entry.sourceId, action: result.action });
          repos.imports.logItem({
            runId,
            sourceId: entry.sourceId,
            targetTable: "vocab_entries",
            targetId: result.entryId,
            action: result.action,
            hash: entry.contentHash,
          });
        } catch (err) {
          const message = formatError(err);
          items.push({ sourceId: entry.sourceId, action: "failed", error: message });
          repos.imports.logItem({
            runId,
            sourceId: entry.sourceId,
            targetTable: "vocab_entries",
            action: "failed",
            hash: entry.contentHash,
            error: message,
          });
        }
      }
    } else {
      for (const topic of parsed.file.topics) {
        try {
          const upsertInput = topic.toUpsertInput(lesson.id);
          const result = repos.grammar.upsertTopic(upsertInput);
          items.push({ sourceId: topic.sourceId, action: result.action });
          repos.imports.logItem({
            runId,
            sourceId: topic.sourceId,
            targetTable: "grammar_topics",
            targetId: result.topicId,
            action: result.action,
            hash: topic.contentHash,
          });
        } catch (err) {
          const message = formatError(err);
          items.push({ sourceId: topic.sourceId, action: "failed", error: message });
          repos.imports.logItem({
            runId,
            sourceId: topic.sourceId,
            targetTable: "grammar_topics",
            action: "failed",
            hash: topic.contentHash,
            error: message,
          });
        }
      }
    }

    return items;
  }

  private dryRunPlan(parsed: ParsedContentFile): {
    items: ImportItemResult[];
    stats: ImportFileResult["stats"];
  } {
    if (parsed.kind === "grammar") return this.dryRunGrammarPlan(parsed);
    return this.dryRunVocabPlan(parsed.file);
  }

  private dryRunVocabPlan(parsed: ParsedVocabFile): {
    items: ImportItemResult[];
    stats: ImportFileResult["stats"];
  } {
    const stats = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
    const items: ImportItemResult[] = [];
    const { repos } = this.deps;

    const book = repos.curriculum.getBookByCode(parsed.book);
    if (!book) {
      // Brand new book — every entry would be inserted.
      for (const entry of parsed.entries) {
        items.push({ sourceId: entry.sourceId, action: "inserted" });
        stats.inserted += 1;
      }
      return { items, stats };
    }
    const unit = repos.curriculum.listUnitsByBook(book.id).find((u) => u.code === parsed.unit.code);
    const lesson = unit
      ? repos.curriculum.listLessonsByUnit(unit.id).find((l) => l.slug === parsed.lesson.slug)
      : undefined;

    if (!lesson) {
      for (const entry of parsed.entries) {
        items.push({ sourceId: entry.sourceId, action: "inserted" });
        stats.inserted += 1;
      }
      return { items, stats };
    }

    const existingByCode = new Map<string, string | null>(
      repos.vocab
        .listIdsByLesson(lesson.id)
        .map((row) => [
          row.sourceId ?? `__noid_${row.id}`,
          repos.vocab.getById(row.id)?.contentHash ?? null,
        ]),
    );

    for (const entry of parsed.entries) {
      const previousHash = existingByCode.get(entry.sourceId);
      if (previousHash === undefined) {
        items.push({ sourceId: entry.sourceId, action: "inserted" });
        stats.inserted += 1;
      } else if (previousHash === entry.contentHash) {
        items.push({ sourceId: entry.sourceId, action: "skipped" });
        stats.skipped += 1;
      } else {
        items.push({ sourceId: entry.sourceId, action: "updated" });
        stats.updated += 1;
      }
    }

    return { items, stats };
  }

  private dryRunGrammarPlan(parsed: Extract<ParsedContentFile, { kind: "grammar" }>): {
    items: ImportItemResult[];
    stats: ImportFileResult["stats"];
  } {
    const stats = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
    const items: ImportItemResult[] = [];
    const { repos } = this.deps;
    const file = parsed.file;

    const book = repos.curriculum.getBookByCode(file.book);
    if (!book) {
      for (const topic of file.topics) {
        items.push({ sourceId: topic.sourceId, action: "inserted" });
        stats.inserted += 1;
      }
      return { items, stats };
    }
    const unit = repos.curriculum.listUnitsByBook(book.id).find((u) => u.code === file.unit.code);
    const lesson = unit
      ? repos.curriculum.listLessonsByUnit(unit.id).find((l) => l.slug === file.lesson.slug)
      : undefined;

    if (!lesson) {
      for (const topic of file.topics) {
        items.push({ sourceId: topic.sourceId, action: "inserted" });
        stats.inserted += 1;
      }
      return { items, stats };
    }

    const existingBySource = new Map<string, string | null>(
      repos.grammar
        .listIdsByLesson(lesson.id)
        .map((row) => [row.sourceId ?? `__noid_${row.id}`, row.contentHash]),
    );

    for (const topic of file.topics) {
      const previousHash = existingBySource.get(topic.sourceId);
      if (previousHash === undefined) {
        items.push({ sourceId: topic.sourceId, action: "inserted" });
        stats.inserted += 1;
      } else if (previousHash === topic.contentHash) {
        items.push({ sourceId: topic.sourceId, action: "skipped" });
        stats.skipped += 1;
      } else {
        items.push({ sourceId: topic.sourceId, action: "updated" });
        stats.updated += 1;
      }
    }

    return { items, stats };
  }
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function formatParseError(err: unknown): { sourceId?: string; message: string } {
  if (err instanceof VocabParseError) {
    return { sourceId: err.sourceId, message: err.message };
  }
  if (err instanceof GrammarParseError) {
    return { sourceId: err.sourceId, message: err.message };
  }
  if (err instanceof ZodError) {
    return {
      message: err.errors.map((e) => `${e.path.join(".") || "(root)"}: ${e.message}`).join("; "),
    };
  }
  return { message: formatError(err) };
}

function deriveTitle(code: string): string {
  return code
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Hash the canonicalized parsed shape — used by tests / external tooling
 * that needs to predict whether a re-import would skip.
 */
export const __test_hashEntry = hashContent;
