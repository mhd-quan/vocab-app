import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { allProcedures } from "../../../electron/ipc";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { freshDb, seedCurriculum } from "../../helpers";

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

const correctOutcome: GradeOutcome = {
  correct: true,
  feedback: "ok",
  selfGrade: "good",
  selectedIndex: null,
};

function seedEntry(repos: Repositories, lessonId: number, headword = "relative") {
  return repos.vocab.upsertEntryWithChildren({
    lessonId,
    sourceId: `${headword}-noun`,
    contentHash: "h",
    headword,
    pos: "noun",
    senses: [
      {
        ordinal: 0,
        definitionEn: `${headword} def`,
        definitionVi: null,
        register: null,
        domain: null,
        notesMd: null,
      },
    ],
    examples: [],
    forms: [],
    collocations: [],
    relations: [],
  });
}

describe("progress.* procedures", () => {
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

  it("startSession + recordAnswer + endSession round-trip via IPC handlers", async () => {
    const { lesson } = seedCurriculum(db);
    const seeded = seedEntry(ctx.repos, lesson.id);
    const student = ctx.repos.students.create({ name: "Alice" });

    const session = await call<{ id: number; mode: string }>(
      "progress.startSession",
      { studentId: student.id, mode: "mixed" },
      ctx,
    );
    expect(session.mode).toBe("mixed");

    const recorded = await call<{ progress: { totalCorrect: number } }>(
      "progress.recordAnswer",
      {
        studentId: student.id,
        sessionId: session.id,
        entryId: seeded.entryId,
        outcome: correctOutcome,
        occurredAtIso: "2026-01-01T00:00:00.000Z",
      },
      ctx,
    );
    expect(recorded.progress.totalCorrect).toBe(1);

    await call("progress.endSession", { sessionId: session.id, summary: { total: 1 } }, ctx);
  });

  it("dueByLesson aggregates total / due / new", async () => {
    const { lesson } = seedCurriculum(db);
    const a = seedEntry(ctx.repos, lesson.id, "alpha");
    seedEntry(ctx.repos, lesson.id, "beta");
    seedEntry(ctx.repos, lesson.id, "gamma");
    const student = ctx.repos.students.create({ name: "Alice" });
    const session = ctx.repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    ctx.repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: a.entryId,
      outcome: correctOutcome,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const stats = await call<{ totalCount: number; dueCount: number; newCount: number }>(
      "progress.dueByLesson",
      {
        studentId: student.id,
        lessonId: lesson.id,
        nowIso: "2026-01-02T00:00:01.000Z",
      },
      ctx,
    );
    expect(stats).toEqual({ totalCount: 3, dueCount: 1, newCount: 2 });
  });

  it("dueByStudent returns due items only, ordered oldest first", async () => {
    const { lesson } = seedCurriculum(db);
    const a = seedEntry(ctx.repos, lesson.id, "alpha");
    const b = seedEntry(ctx.repos, lesson.id, "beta");
    const student = ctx.repos.students.create({ name: "Alice" });
    const session = ctx.repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    ctx.repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: a.entryId,
      outcome: correctOutcome,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    ctx.repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: b.entryId,
      outcome: correctOutcome,
      now: new Date("2026-01-01T00:01:00.000Z"),
    });
    const due = await call<Array<{ headword: string }>>(
      "progress.dueByStudent",
      { studentId: student.id, nowIso: "2026-01-02T00:01:01.000Z" },
      ctx,
    );
    expect(due.map((d) => d.headword)).toEqual(["alpha", "beta"]);
  });

  it("studentSummary returns zeros on a fresh student", async () => {
    const student = ctx.repos.students.create({ name: "Alice" });
    const summary = await call<{ totalSeen: number; accuracy: number }>(
      "progress.studentSummary",
      { studentId: student.id },
      ctx,
    );
    expect(summary).toMatchObject({ totalSeen: 0, accuracy: 0 });
  });

  it("Zod rejects malformed input shapes", () => {
    const proc = findProcedure("progress.recordAnswer");
    expect(() =>
      proc.inputSchema.parse({
        studentId: 1,
        sessionId: 1,
        entryId: 1,
        outcome: { correct: "yes", feedback: "", selfGrade: null, selectedIndex: null },
      }),
    ).toThrow();
    expect(() =>
      proc.inputSchema.parse({
        studentId: 1,
        sessionId: 1,
        entryId: -5,
        outcome: { correct: true, feedback: "", selfGrade: null, selectedIndex: null },
      }),
    ).toThrow();
  });
});
