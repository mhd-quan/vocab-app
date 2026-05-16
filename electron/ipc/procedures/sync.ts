import fs from "node:fs/promises";
import path from "node:path";
import { type OpenDialogOptions, app, dialog } from "electron";
import { z } from "zod";
import type {
  StudentLogExportSummary,
  StudentLogImportSummary,
  StudentLogPackage,
} from "../../../src/application/sync/studentLog";
import { defineProcedure } from "../procedure";

const MAX_SYNC_LOG_BYTES = 20 * 1024 * 1024;

const exportInput = z.object({
  studentId: z.number().int().positive(),
});

export const syncProcedures = [
  defineProcedure({
    name: "sync.exportStudentLog",
    input: exportInput,
    handler: async ({ studentId }, ctx) => {
      const pkg = ctx.repos.sync.exportStudentLog({ studentId, platform: process.platform });
      const summary = exportSummary(pkg);
      const parent = ctx.getMainWindow?.();
      const result = parent
        ? await dialog.showSaveDialog(parent, saveOptions(summary.fileName))
        : await dialog.showSaveDialog(saveOptions(summary.fileName));

      if (result.canceled || !result.filePath) {
        return { canceled: true, filePath: null, summary };
      }

      await fs.writeFile(result.filePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
      return { canceled: false, filePath: result.filePath, summary };
    },
  }),
  defineProcedure({
    name: "sync.importStudentLog",
    input: z.void(),
    handler: async (_input, ctx) => {
      const options: OpenDialogOptions = {
        title: "Import student log",
        properties: ["openFile"],
        filters: [{ name: "Lexicon Lab student logs", extensions: ["json"] }],
      };
      const parent = ctx.getMainWindow?.();
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);

      if (result.canceled || !result.filePaths[0]) {
        return { canceled: true, filePath: null, summary: null };
      }

      const filePath = result.filePaths[0];
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_SYNC_LOG_BYTES) {
        throw new Error("Student log must be 20MB or smaller.");
      }

      const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
      const summary: StudentLogImportSummary = ctx.repos.sync.importStudentLog(raw);
      return { canceled: false, filePath, summary };
    },
  }),
];

function saveOptions(fileName: string) {
  return {
    title: "Export student log",
    defaultPath: path.join(app.getPath("documents"), fileName),
    filters: [{ name: "Lexicon Lab student logs", extensions: ["json"] }],
  };
}

function exportSummary(pkg: StudentLogPackage): StudentLogExportSummary {
  return {
    packageId: pkg.packageId,
    studentName: pkg.student.displayName ?? pkg.student.name,
    fileName: `lexicon-lab-${safeFilePart(pkg.student.displayName ?? pkg.student.name)}-${pkg.exportedAt.slice(0, 10)}.json`,
    exportedAt: pkg.exportedAt,
    sessions: pkg.progress.sessions.length,
    events: pkg.progress.events.length,
    progressItems: pkg.progress.itemProgress.length,
    dictionaryItems: pkg.dictionaryLearning.items.length,
  };
}

function safeFilePart(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "student";
}
