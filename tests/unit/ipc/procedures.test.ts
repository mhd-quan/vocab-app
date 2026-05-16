import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { allProcedures } from "../../../electron/ipc";
import { defineProcedure } from "../../../electron/ipc/procedure";
import {
  authProcedures,
  curriculumProcedures,
  dictionaryLearningProcedures,
  dictionaryProcedures,
  grammarProcedures,
  importsProcedures,
  metaProcedures,
  progressProcedures,
  rewardsProcedures,
  settingsProcedures,
  studentsProcedures,
  syncProcedures,
  vocabProcedures,
} from "../../../electron/ipc/procedures";
import { units } from "../../../src/data/schema";
import { first, freshDb, seedCurriculum } from "../../helpers";

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

describe("IPC procedure registry", () => {
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

  it("has unique channel names across every domain", () => {
    const names = allProcedures.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("aggregates every domain's procedures into allProcedures", () => {
    expect(allProcedures.length).toBe(
      metaProcedures.length +
        authProcedures.length +
        curriculumProcedures.length +
        grammarProcedures.length +
        vocabProcedures.length +
        studentsProcedures.length +
        settingsProcedures.length +
        importsProcedures.length +
        progressProcedures.length +
        rewardsProcedures.length +
        dictionaryProcedures.length +
        dictionaryLearningProcedures.length +
        syncProcedures.length,
    );
  });

  describe("meta", () => {
    it("ping returns 'pong'", async () => {
      expect(await call<string>("meta.ping", undefined, ctx)).toBe("pong");
    });

    it("appInfo returns the expected schema-tables count", async () => {
      const info = await call<{ schemaTablesExpected: number }>("meta.appInfo", undefined, ctx);
      expect(info.schemaTablesExpected).toBe(28);
    });
  });

  describe("input validation", () => {
    it("rejects negative ids", () => {
      const proc = findProcedure("curriculum.getBookById");
      expect(() => proc.inputSchema.parse({ id: -1 })).toThrow();
    });

    it("rejects malformed colors on students.create", () => {
      const proc = findProcedure("students.create");
      expect(() => proc.inputSchema.parse({ name: "Alice", color: "blue" })).toThrow();
    });

    it("accepts valid inputs", () => {
      const proc = findProcedure("students.create");
      expect(() => proc.inputSchema.parse({ name: "Alice", color: "#1a2b3c" })).not.toThrow();
      expect(() =>
        proc.inputSchema.parse({
          name: "Alice",
          avatarSeed: "image:data:image/webp;base64,abc",
        }),
      ).not.toThrow();
    });
  });

  describe("curriculum", () => {
    it("listBooks delegates to the repository", async () => {
      seedCurriculum(db, { bookCode: "destination-b1" });
      seedCurriculum(db, { bookCode: "destination-b2" });
      const books = await call<Array<{ code: string }>>("curriculum.listBooks", undefined, ctx);
      expect(books.map((b) => b.code).sort()).toEqual(["destination-b1", "destination-b2"]);
    });

    it("getBookByCode returns null when missing", async () => {
      const result = await call<unknown | null>(
        "curriculum.getBookByCode",
        { code: "missing" },
        ctx,
      );
      expect(result).toBeNull();
    });
  });

  describe("grammar", () => {
    it("listByLesson delegates to the grammar repository", async () => {
      const { lesson } = seedCurriculum(db, { lessonKind: "grammar" });
      ctx.repos.grammar.upsertTopic({
        lessonId: lesson.id,
        sourceId: "present-simple",
        slug: "present-simple",
        title: "Present simple",
        contentHash: "h1",
      });

      const topics = await call<Array<{ title: string }>>(
        "grammar.listByLesson",
        { lessonId: lesson.id },
        ctx,
      );
      expect(topics.map((topic) => topic.title)).toEqual(["Present simple"]);
    });
  });

  describe("students", () => {
    it("create + listActive round-trips through IPC handlers", async () => {
      const created = await call<{ id: number; name: string }>(
        "students.create",
        { name: "Alice", color: "#1a2b3c" },
        ctx,
      );
      expect(created.name).toBe("Alice");

      const list = await call<Array<{ id: number }>>("students.listActive", undefined, ctx);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(created.id);
    });

    it("archive hides from listActive", async () => {
      const created = await call<{ id: number }>("students.create", { name: "Bob" }, ctx);
      await call("students.archive", { id: created.id }, ctx);
      const list = await call<unknown[]>("students.listActive", undefined, ctx);
      expect(list).toHaveLength(0);
    });

    it("replaces unit assignments through IPC handlers", async () => {
      const { book, unit } = seedCurriculum(db);
      const secondUnit = first(
        db
          .insert(units)
          .values({ bookId: book.id, ordinal: 2, code: "U02", title: "Unit 2" })
          .returning()
          .all(),
      );
      const student = await call<{ id: number }>("students.create", { name: "Alice" }, ctx);

      await call(
        "students.replaceUnitAssignments",
        { studentId: student.id, bookId: book.id, unitIds: [unit.id, secondUnit.id] },
        ctx,
      );

      const assigned = await call<number[]>(
        "students.listAssignedUnitIds",
        { studentId: student.id, bookId: book.id },
        ctx,
      );
      expect(assigned).toEqual([unit.id, secondUnit.id]);
    });
  });

  describe("settings", () => {
    it("get returns null for missing keys (IPC null-coercion)", async () => {
      const result = await call<unknown | null>("settings.get", { key: "missing" }, ctx);
      expect(result).toBeNull();
    });

    it("set + get round-trips", async () => {
      await call("settings.set", { key: "theme", value: "dark" }, ctx);
      expect(await call<string | null>("settings.get", { key: "theme" }, ctx)).toBe("dark");
    });
  });

  describe("rewards", () => {
    it("listUnlocked returns [] for an unknown student", async () => {
      const result = await call<unknown[]>("rewards.listUnlocked", { studentId: 99 }, ctx);
      expect(result).toEqual([]);
    });

    it("streak returns zeroed stats for a student with no events", async () => {
      const student = ctx.repos.students.create({ name: "Alice" });
      const result = await call<{ currentStreak: number; longestStreak: number }>(
        "rewards.streak",
        { studentId: student.id },
        ctx,
      );
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });
  });
});

describe("defineProcedure helper", () => {
  it("preserves the name and validates inputs", () => {
    const proc = defineProcedure({
      name: "test.echo",
      input: z.object({ msg: z.string() }),
      handler: ({ msg }) => msg,
    });
    expect(proc.name).toBe("test.echo");
    expect(() => proc.inputSchema.parse({ msg: 123 })).toThrow();
    expect(proc.inputSchema.parse({ msg: "hi" })).toEqual({ msg: "hi" });
  });
});
