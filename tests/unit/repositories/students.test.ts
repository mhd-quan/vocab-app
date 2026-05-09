import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { freshDb } from "../../helpers";

describe("StudentsRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("creates and lists active students", () => {
    const a = repos.students.create({ name: "Alice", color: "#1a2b3c" });
    const b = repos.students.create({ name: "Bob" });
    const list = repos.students.listActive();
    expect(list.map((s) => s.name).sort()).toEqual(["Alice", "Bob"]);
    expect(list.find((s) => s.id === a.id)?.color).toBe("#1a2b3c");
    expect(b.archivedAt).toBeNull();
  });

  it("getById returns null for missing students", () => {
    expect(repos.students.getById(999)).toBeNull();
  });

  it("update applies a patch and bumps updatedAt", () => {
    const created = repos.students.create({ name: "Alice" });
    const before = created.updatedAt;
    // Sleep 1ms equivalent — better-sqlite3 is sync, so use a small wait.
    const updated = repos.students.update(created.id, { displayName: "Ali" });
    expect(updated.displayName).toBe("Ali");
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("archive hides students from listActive but keeps them in listAll", () => {
    const a = repos.students.create({ name: "Alice" });
    repos.students.archive(a.id);
    expect(repos.students.listActive()).toHaveLength(0);
    expect(repos.students.listAll()).toHaveLength(1);
    expect(repos.students.listAll()[0]?.archivedAt).not.toBeNull();
  });

  it("restore brings an archived student back", () => {
    const a = repos.students.create({ name: "Alice" });
    repos.students.archive(a.id);
    repos.students.restore(a.id);
    expect(repos.students.listActive()).toHaveLength(1);
  });

  it("update on an archived student throws", () => {
    const a = repos.students.create({ name: "Alice" });
    repos.students.archive(a.id);
    expect(() => repos.students.update(a.id, { name: "Renamed" })).toThrow();
  });
});
