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

  beforeEach(() => {
    const fresh = freshDb();
    db = fresh.db;
    ctx = { repos: fresh.repos };
  });

  afterEach(() => {
    closeDatabase(db);
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
});
