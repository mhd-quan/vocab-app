import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { allProcedures } from "../../../electron/ipc";
import { freshDb } from "../../helpers";

function findProcedure(name: string) {
  const proc = allProcedures.find((p) => p.name === name);
  if (!proc) throw new Error(`Procedure ${name} not registered`);
  return proc;
}

async function call<T>(name: string, input: unknown, ctx: { repos: Repositories }): Promise<T> {
  const proc = findProcedure(name);
  const parsed = proc.inputSchema.parse(input);
  return (await proc.handler(parsed, ctx)) as T;
}

describe("imports.* procedures", () => {
  let db: AppDatabase;
  let ctx: { repos: Repositories };
  let tmpDir: string;
  let previousContentRoot: string | undefined;

  beforeEach(() => {
    const fresh = freshDb();
    db = fresh.db;
    ctx = { repos: fresh.repos };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-app-ipc-import-"));
    previousContentRoot = process.env.VOCAB_CONTENT_ROOT;
    process.env.VOCAB_CONTENT_ROOT = tmpDir;
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (previousContentRoot === undefined) {
      process.env.VOCAB_CONTENT_ROOT = undefined;
    } else {
      process.env.VOCAB_CONTENT_ROOT = previousContentRoot;
    }
  });

  it("listRuns returns an empty array on a fresh DB", async () => {
    const result = await call<unknown[]>("imports.listRuns", {}, ctx);
    expect(result).toEqual([]);
  });

  it("listRuns returns runs in most-recent-first order", async () => {
    const a = ctx.repos.imports.startRun({ sourcePath: "/a.yaml", contentHash: "1" });
    ctx.repos.imports.finishRun({
      runId: a.id,
      status: "success",
      stats: { inserted: 1 },
    });
    const b = ctx.repos.imports.startRun({ sourcePath: "/b.yaml", contentHash: "2" });
    ctx.repos.imports.finishRun({
      runId: b.id,
      status: "success",
      stats: { inserted: 1 },
    });
    const result = await call<Array<{ id: number }>>("imports.listRuns", {}, ctx);
    expect(result.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it("listRuns enforces the Zod limit cap", () => {
    const proc = findProcedure("imports.listRuns");
    expect(() => proc.inputSchema.parse({ limit: 0 })).toThrow();
    expect(() => proc.inputSchema.parse({ limit: -1 })).toThrow();
    expect(() => proc.inputSchema.parse({ limit: 9999 })).toThrow();
    expect(() => proc.inputSchema.parse({ limit: 1 })).not.toThrow();
  });

  it("listItems returns rows for a specific run", async () => {
    const run = ctx.repos.imports.startRun({ sourcePath: "/a.yaml", contentHash: "1" });
    ctx.repos.imports.logItem({
      runId: run.id,
      sourceId: "x",
      targetTable: "vocab_entries",
      action: "inserted",
    });
    ctx.repos.imports.logItem({
      runId: run.id,
      sourceId: "y",
      targetTable: "vocab_entries",
      action: "skipped",
    });
    const items = await call<Array<{ sourceId: string }>>(
      "imports.listItems",
      { runId: run.id },
      ctx,
    );
    expect(items.map((i) => i.sourceId)).toEqual(["x", "y"]);
  });

  it("listItems rejects non-positive runIds", () => {
    const proc = findProcedure("imports.listItems");
    expect(() => proc.inputSchema.parse({ runId: 0 })).toThrow();
    expect(() => proc.inputSchema.parse({ runId: -5 })).toThrow();
  });

  it("uploadFile copies YAML into the book folder and imports it", async () => {
    const result = await call<{ status: string; stats: { inserted: number } }>(
      "imports.uploadFile",
      {
        fileName: "unit-01-vocab.yml",
        content: `
book: destination-b1
book_title: Destination B1
unit: { ordinal: 1, code: U01, title: Unit 1 }
lesson:
  ordinal: 1
  kind: vocabulary
  title: Lesson 1
  slug: lesson-1
entries:
  - id: sample-noun
    headword: sample
    pos: noun
    senses:
      - definition_en: an example
`,
      },
      ctx,
    );

    expect(result.status).toBe("success");
    expect(result.stats.inserted).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, "destination-b1", "unit-01-vocab.yml"))).toBe(true);
    expect(ctx.repos.curriculum.getBookByCode("destination-b1")?.title).toBe("Destination B1");
  });

  it("uploadFile routes grammar YAML into the grammar importer", async () => {
    const result = await call<{ status: string; stats: { inserted: number } }>(
      "imports.uploadFile",
      {
        fileName: "unit-01-grammar.yml",
        content: `
book: destination-b1
book_title: Destination B1
unit: { ordinal: 1, code: U01, title: Unit 1 }
lesson:
  ordinal: 2
  kind: grammar
  title: Present simple
  slug: present-simple
topics:
  - id: present-simple-routines
    slug: present-simple-routines
    title: Present simple for routines
    difficulty: 1
`,
      },
      ctx,
    );

    expect(result.status).toBe("success");
    expect(result.stats.inserted).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, "destination-b1", "unit-01-grammar.yml"))).toBe(true);
    const book = ctx.repos.curriculum.getBookByCode("destination-b1");
    if (!book) throw new Error("book not found");
    const unit = ctx.repos.curriculum.listUnitsByBook(book.id)[0];
    if (!unit) throw new Error("unit not found");
    const lesson = ctx.repos.curriculum.listLessonsByUnit(unit.id, "grammar")[0];
    if (!lesson) throw new Error("lesson not found");
    expect(ctx.repos.grammar.listByLesson(lesson.id)[0]?.title).toBe("Present simple for routines");
  });
});
