import fs from "node:fs/promises";
import path from "node:path";
import { type OpenDialogOptions, dialog } from "electron";
import yaml from "js-yaml";
import { z } from "zod";
import {
  type ImportFileResult,
  ImportVocabUseCase,
  parseVocabFile,
} from "../../../src/application/import";
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
        const content = await fs.readFile(filePath, "utf8");
        results.push(await importContent(path.basename(filePath), content, ctx.repos));
      }
      return { canceled: false, results };
    },
  }),
];

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
    const parsed = parseVocabFile(yaml.load(content));
    const destinationDir = path.join(getContentBooksRoot(), parsed.book);
    const destinationPath = path.join(destinationDir, safeName);

    await fs.mkdir(destinationDir, { recursive: true });
    await fs.writeFile(destinationPath, content, "utf8");

    const usecase = new ImportVocabUseCase({ repos });
    return usecase.importFile(destinationPath);
  } catch (err) {
    return {
      filePath: fileName,
      fileHash: "",
      status: "failed",
      durationMs: Date.now() - start,
      stats: { inserted: 0, updated: 0, skipped: 0, failed: 1 },
      items: [],
      errors: [{ message: formatError(err) }],
    };
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
  return process.env.VOCAB_CONTENT_ROOT
    ? path.resolve(process.env.VOCAB_CONTENT_ROOT)
    : path.resolve(process.cwd(), "content", "books");
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
