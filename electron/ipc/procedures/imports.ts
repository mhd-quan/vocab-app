import fs from "node:fs/promises";
import path from "node:path";
import { type OpenDialogOptions, dialog } from "electron";
import yaml from "js-yaml";
import { z } from "zod";
import {
  type ImportFileResult,
  ImportVocabUseCase,
  parseContentFile,
} from "../../../src/application/import";
import { getImportedContentBooksRoot } from "../../content/paths";
import type { Repositories } from "../../db/repositories";
import { defineProcedure } from "../procedure";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const listRunsInput = z.object({
  limit: z.number().int().positive().max(500).optional(),
});

const listItemsInput = z.object({
  runId: z.number().int().positive(),
});

const uploadFileInput = z.object({
  fileName: z.string().min(1).max(255),
  content: z.string().max(MAX_IMPORT_BYTES),
});

export const importsProcedures = [
  defineProcedure({
    name: "imports.listRuns",
    input: listRunsInput,
    handler: ({ limit }, ctx) => ctx.repos.imports.listRuns(limit),
  }),
  defineProcedure({
    name: "imports.listItems",
    input: listItemsInput,
    handler: ({ runId }, ctx) => ctx.repos.imports.listItems(runId),
  }),
  defineProcedure({
    name: "imports.uploadFile",
    input: uploadFileInput,
    handler: async ({ fileName, content }, ctx) => importContent(fileName, content, ctx.repos),
  }),
  defineProcedure({
    name: "imports.openImportDialog",
    input: z.void(),
    handler: async (_input, ctx) => {
      const options: OpenDialogOptions = {
        title: "Import YAML",
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
      };
      const parent = ctx.getMainWindow?.();
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled) {
        return { canceled: true, results: [] };
      }

      const results: ImportFileResult[] = [];
      for (const filePath of result.filePaths) {
        results.push(await importSelectedFile(filePath, ctx.repos));
      }
      return { canceled: false, results };
    },
  }),
];

async function importSelectedFile(
  filePath: string,
  repos: Repositories,
): Promise<ImportFileResult> {
  const start = Date.now();
  try {
    const content = await fs.readFile(filePath, "utf8");
    return importContent(path.basename(filePath), content, repos);
  } catch (err) {
    return failedImportResult(filePath, start, `Cannot read file: ${formatError(err)}`);
  }
}

async function importContent(
  fileName: string,
  content: string,
  repos: Repositories,
): Promise<ImportFileResult> {
  const start = Date.now();
  try {
    const byteLength = Buffer.byteLength(content, "utf8");
    if (byteLength > MAX_IMPORT_BYTES) {
      throw new Error("YAML file must be 5MB or smaller");
    }

    const safeName = safeYamlFileName(fileName);
    const parsed = parseContentFile(yaml.load(content));
    const destinationDir = path.join(getContentBooksRoot(), parsed.file.book);
    const destinationPath = path.join(destinationDir, safeName);

    await fs.mkdir(destinationDir, { recursive: true });
    await fs.writeFile(destinationPath, content, "utf8");

    const usecase = new ImportVocabUseCase({ repos });
    return usecase.importFile(destinationPath);
  } catch (err) {
    return failedImportResult(fileName, start, formatError(err));
  }
}

function safeYamlFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext !== ".yaml" && ext !== ".yml") {
    throw new Error("Only .yaml and .yml files can be imported");
  }
  const stem = path
    .basename(fileName, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${stem || "vocab-import"}${ext}`;
}

function getContentBooksRoot(): string {
  return getImportedContentBooksRoot();
}

function failedImportResult(
  filePath: string,
  startedAt: number,
  message: string,
): ImportFileResult {
  return {
    filePath,
    fileHash: "",
    status: "failed",
    durationMs: Date.now() - startedAt,
    stats: { inserted: 0, updated: 0, skipped: 0, failed: 1 },
    items: [],
    errors: [{ message }],
  };
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
