import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { freshDb } from "../../helpers";

describe("ImportsRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("startRun returns a fresh pending row with the supplied source + hash", () => {
    const run = repos.imports.startRun({ sourcePath: "/tmp/a.yaml", contentHash: "h1" });
    expect(run.status).toBe("pending");
    expect(run.sourcePath).toBe("/tmp/a.yaml");
    expect(run.contentHash).toBe("h1");
    expect(run.finishedAt).toBeNull();
  });

  it("finishRun updates status, stats, errorLog, and finishedAt", () => {
    const run = repos.imports.startRun({ sourcePath: "/tmp/a.yaml", contentHash: "h1" });
    repos.imports.finishRun({
      runId: run.id,
      status: "success",
      stats: { inserted: 2, updated: 1, skipped: 0, failed: 0 },
      errorLog: null,
    });
    const after = repos.imports.listRuns(10).find((r) => r.id === run.id);
    expect(after?.status).toBe("success");
    expect(after?.stats).toEqual({ inserted: 2, updated: 1, skipped: 0, failed: 0 });
    expect(after?.finishedAt).not.toBeNull();
  });

  it("listRuns returns most-recent-first and respects the limit", () => {
    for (let i = 0; i < 5; i++) {
      const r = repos.imports.startRun({ sourcePath: `/p/${i}.yaml`, contentHash: `h${i}` });
      repos.imports.finishRun({
        runId: r.id,
        status: "success",
        stats: { inserted: 0, updated: 0, skipped: 0, failed: 0 },
      });
    }
    const all = repos.imports.listRuns();
    expect(all).toHaveLength(5);
    expect(all[0]?.sourcePath).toBe("/p/4.yaml");
    expect(all[4]?.sourcePath).toBe("/p/0.yaml");

    const top2 = repos.imports.listRuns(2);
    expect(top2).toHaveLength(2);
  });

  it("logItem + listItems persist per-run rows in insertion order", () => {
    const run = repos.imports.startRun({ sourcePath: "/tmp/a.yaml", contentHash: "h" });
    repos.imports.logItem({
      runId: run.id,
      sourceId: "a",
      targetTable: "vocab_entries",
      action: "inserted",
    });
    repos.imports.logItem({
      runId: run.id,
      sourceId: "b",
      targetTable: "vocab_entries",
      action: "updated",
    });
    const items = repos.imports.listItems(run.id);
    expect(items.map((i) => i.sourceId)).toEqual(["a", "b"]);
    expect(items.map((i) => i.action)).toEqual(["inserted", "updated"]);
  });

  it("findLatestSuccessful ignores failed/partial runs", () => {
    const a = repos.imports.startRun({ sourcePath: "/p/x.yaml", contentHash: "h1" });
    repos.imports.finishRun({
      runId: a.id,
      status: "failed",
      stats: { inserted: 0, updated: 0, skipped: 0, failed: 1 },
    });
    const b = repos.imports.startRun({ sourcePath: "/p/x.yaml", contentHash: "h2" });
    repos.imports.finishRun({
      runId: b.id,
      status: "success",
      stats: { inserted: 1, updated: 0, skipped: 0, failed: 0 },
    });
    const latest = repos.imports.findLatestSuccessful("/p/x.yaml");
    expect(latest?.id).toBe(b.id);
  });
});
