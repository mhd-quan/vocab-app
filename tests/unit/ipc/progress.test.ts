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

  it("seenEntryIdsByLesson returns seen vocab ids for flashcard-first routing", async () => {
    const { lesson } = seedCurriculum(db);
    const alpha = seedEntry(ctx.repos, lesson.id, "alpha");
    seedEntry(ctx.repos, lesson.id, "beta");
    const student = ctx.repos.students.create({ name: "Alice" });
    const session = ctx.repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    ctx.repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: alpha.entryId,
      outcome: correctOutcome,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    const seen = await call<number[]>(
      "progress.seenEntryIdsByLesson",
      { studentId: student.id, lessonId: lesson.id },
      ctx,
    );
    expect(seen).toEqual([alpha.entryId]);
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

  it("weakItems surfaces only items with at least minAttempts answers", async () => {
    const { lesson, book } = seedCurriculum(db);
    const a = seedEntry(ctx.repos, lesson.id, "alpha");
    const student = ctx.repos.students.create({ name: "Alice" });
    const session = ctx.repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    for (let i = 0; i < 4; i += 1) {
      ctx.repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: a.entryId,
        outcome: { correct: i === 0, feedback: "x", selfGrade: "again", selectedIndex: null },
        now: new Date("2026-01-01T00:00:00.000Z"),
      });
    }
    const weak = await call<Array<{ headword: string; bookId: number; accuracy: number }>>(
      "progress.weakItems",
      { studentId: student.id, minAttempts: 3 },
      ctx,
    );
    expect(weak).toHaveLength(1);
    expect(weak[0]?.bookId).toBe(book.id);
    expect(weak[0]?.accuracy).toBeCloseTo(0.25, 2);
  });

  it("dailyActivity returns dense day cells across the window", async () => {
    const { lesson } = seedCurriculum(db);
    const seeded = seedEntry(ctx.repos, lesson.id);
    const student = ctx.repos.students.create({ name: "Alice" });
    const session = ctx.repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    ctx.repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correctOutcome,
      now: new Date("2026-01-02T08:00:00.000Z"),
    });
    const cells = await call<Array<{ count: number }>>(
      "progress.dailyActivity",
      {
        studentId: student.id,
        sinceIso: "2026-01-01T00:00:00.000Z",
        untilIso: "2026-01-03T23:59:59.000Z",
      },
      ctx,
    );
    expect(cells.length).toBe(3);
    expect(cells.reduce((sum, c) => sum + c.count, 0)).toBe(1);
  });

  it("cohortActivity counts answer events from active students and zero-fills days", async () => {
    const { lesson } = seedCurriculum(db);
    const seeded = seedEntry(ctx.repos, lesson.id);
    const alice = ctx.repos.students.create({ name: "Alice" });
    const archived = ctx.repos.students.create({ name: "Archived" });
    const cara = ctx.repos.students.create({ name: "Cara" });
    const aliceSession = ctx.repos.progress.startSession({ studentId: alice.id, mode: "mixed" });
    const archivedSession = ctx.repos.progress.startSession({
      studentId: archived.id,
      mode: "mixed",
    });
    const caraSession = ctx.repos.progress.startSession({ studentId: cara.id, mode: "mixed" });

    ctx.repos.progress.recordAnswer({
      studentId: alice.id,
      sessionId: aliceSession.id,
      entryId: seeded.entryId,
      outcome: correctOutcome,
      now: new Date(2026, 0, 2, 8),
    });
    ctx.repos.progress.recordAnswer({
      studentId: alice.id,
      sessionId: aliceSession.id,
      entryId: seeded.entryId,
      outcome: { correct: false, feedback: "again", selfGrade: "again", selectedIndex: null },
      now: new Date(2026, 0, 2, 9),
    });
    ctx.repos.progress.recordAnswer({
      studentId: archived.id,
      sessionId: archivedSession.id,
      entryId: seeded.entryId,
      outcome: correctOutcome,
      now: new Date(2026, 0, 2, 10),
    });
    ctx.repos.students.archive(archived.id);
    ctx.repos.progress.recordAnswer({
      studentId: cara.id,
      sessionId: caraSession.id,
      entryId: seeded.entryId,
      outcome: correctOutcome,
      now: new Date(2026, 0, 3, 8),
    });

    const cells = await call<
      Array<{ answerCount: number; correctCount: number; activeStudentCount: number }>
    >(
      "progress.cohortActivity",
      {
        sinceIso: new Date(2026, 0, 1, 0, 0, 0).toISOString(),
        untilIso: new Date(2026, 0, 3, 23, 59, 59).toISOString(),
      },
      ctx,
    );

    expect(cells).toHaveLength(3);
    expect(
      cells.map(({ answerCount, correctCount, activeStudentCount }) => ({
        answerCount,
        correctCount,
        activeStudentCount,
      })),
    ).toEqual([
      { answerCount: 0, correctCount: 0, activeStudentCount: 0 },
      { answerCount: 2, correctCount: 1, activeStudentCount: 1 },
      { answerCount: 1, correctCount: 1, activeStudentCount: 1 },
    ]);
  });

  it("recentSessions returns sessions newest-first with totals", async () => {
    const { lesson } = seedCurriculum(db);
    const seeded = seedEntry(ctx.repos, lesson.id);
    const student = ctx.repos.students.create({ name: "Alice" });
    const session = ctx.repos.progress.startSession({ studentId: student.id, mode: "flashcard" });
    ctx.repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correctOutcome,
      now: new Date("2026-01-02T08:00:00.000Z"),
    });
    const recent = await call<
      Array<{ sessionId: number; totalAnswered: number; totalCorrect: number }>
    >("progress.recentSessions", { studentId: student.id, limit: 5 }, ctx);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.totalAnswered).toBe(1);
    expect(recent[0]?.totalCorrect).toBe(1);
  });

  it("tutorOverview lists active students with rolled-up stats", async () => {
    const alice = ctx.repos.students.create({ name: "Alice" });
    const bob = ctx.repos.students.create({ name: "Bob" });
    ctx.repos.students.archive(bob.id);
    const rows = await call<
      Array<{ student: { id: number }; totalSeen: number; totalAttempts: number }>
    >("progress.tutorOverview", {}, ctx);
    expect(rows.map((r) => r.student.id)).toEqual([alice.id]);
    expect(rows[0]?.totalAttempts).toBe(0);
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
