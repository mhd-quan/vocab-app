import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { freshDb, seedCurriculum } from "../../helpers";

const T0 = new Date("2026-01-15T12:00:00Z");
const DAY_MS = 86_400_000;

function correct(): GradeOutcome {
  return { correct: true, feedback: "ok", selfGrade: "good", selectedIndex: null };
}
function wrong(): GradeOutcome {
  return { correct: false, feedback: "no", selfGrade: "again", selectedIndex: null };
}

function seedEntries(repos: Repositories, lessonId: number, headwords: string[]) {
  return headwords.map((headword, i) =>
    repos.vocab.upsertEntryWithChildren({
      lessonId,
      sourceId: `e-${headword}-${i}`,
      contentHash: `h-${headword}-${i}`,
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
    }),
  );
}

describe("ProgressRepository — weakItems", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });
  afterEach(() => {
    closeDatabase(db);
  });

  it("returns [] when no entries meet the minAttempts threshold", () => {
    const { lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["alpha"]);
    if (!seeded) throw new Error("seed mismatch");
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: wrong(),
      now: T0,
    });
    expect(repos.rewards.listUnlocked(student.id)).toEqual([]);
    expect(repos.progress.weakItems({ studentId: student.id, minAttempts: 3 })).toEqual([]);
  });

  it("orders by accuracy ascending, ties broken by lastSeen desc", () => {
    const { lesson } = seedCurriculum(db);
    const [a, b, c] = seedEntries(repos, lesson.id, ["alpha", "beta", "gamma"]);
    if (!a || !b || !c) throw new Error("seed mismatch");
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

    // alpha: 1 correct / 2 wrong  → 33%
    // beta:  3 correct / 0 wrong  → 100%
    // gamma: 0 correct / 3 wrong  → 0%
    for (const outcome of [wrong(), wrong(), correct()]) {
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: a.entryId,
        outcome,
        now: T0,
      });
    }
    for (let i = 0; i < 3; i += 1) {
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: b.entryId,
        outcome: correct(),
        now: T0,
      });
    }
    for (let i = 0; i < 3; i += 1) {
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: c.entryId,
        outcome: wrong(),
        now: T0,
      });
    }

    const weak = repos.progress.weakItems({ studentId: student.id, minAttempts: 3, limit: 10 });
    expect(weak.map((w) => w.headword)).toEqual(["gamma", "alpha", "beta"]);
    expect(weak[0]?.accuracy).toBeCloseTo(0, 3);
    expect(weak[1]?.accuracy).toBeCloseTo(1 / 3, 3);
  });

  it("respects the limit and surfaces lessonId + bookId for deep-linking", () => {
    const { book, lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["alpha"]);
    if (!seeded) throw new Error("seed mismatch");
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    for (let i = 0; i < 3; i += 1) {
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: seeded.entryId,
        outcome: wrong(),
        now: T0,
      });
    }
    const weak = repos.progress.weakItems({ studentId: student.id });
    expect(weak[0]?.lessonId).toBe(lesson.id);
    expect(weak[0]?.bookId).toBe(book.id);
  });
});

describe("ProgressRepository — dailyActivity", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });
  afterEach(() => {
    closeDatabase(db);
  });

  it("returns dense day cells across the requested window", () => {
    const { lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["alpha"]);
    if (!seeded) throw new Error("seed mismatch");
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: T0,
    });
    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: new Date(T0.getTime() + 2 * DAY_MS),
    });
    const cells = repos.progress.dailyActivity({
      studentId: student.id,
      since: new Date(T0.getTime() - 1 * DAY_MS),
      until: new Date(T0.getTime() + 2 * DAY_MS),
    });
    expect(cells).toHaveLength(4);
    expect(cells.map((c) => c.count)).toEqual([0, 1, 0, 1]);
  });

  it("returns [] when until is before since", () => {
    const student = repos.students.create({ name: "Alice" });
    const cells = repos.progress.dailyActivity({
      studentId: student.id,
      since: T0,
      until: new Date(T0.getTime() - DAY_MS),
    });
    expect(cells).toEqual([]);
  });
});

describe("ProgressRepository — recentSessions", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });
  afterEach(() => {
    closeDatabase(db);
  });

  it("returns sessions newest-first with answered/correct totals from the event log", () => {
    const { lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["alpha"]);
    if (!seeded) throw new Error("seed mismatch");
    const student = repos.students.create({ name: "Alice" });
    const olderSession = repos.progress.startSession({ studentId: student.id, mode: "flashcard" });
    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: olderSession.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: T0,
    });
    const newerSession = repos.progress.startSession({
      studentId: student.id,
      mode: "multiple_choice",
    });
    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: newerSession.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: new Date(T0.getTime() + DAY_MS),
    });
    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: newerSession.id,
      entryId: seeded.entryId,
      outcome: wrong(),
      now: new Date(T0.getTime() + DAY_MS + 1000),
    });
    const recent = repos.progress.recentSessions({ studentId: student.id });
    expect(recent).toHaveLength(2);
    expect(recent[0]?.sessionId).toBe(newerSession.id);
    expect(recent[0]?.totalAnswered).toBe(2);
    expect(recent[0]?.totalCorrect).toBe(1);
    expect(recent[1]?.totalAnswered).toBe(1);
    expect(recent[1]?.totalCorrect).toBe(1);
  });

  it("zero-answered sessions still appear with totals = 0", () => {
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    const recent = repos.progress.recentSessions({ studentId: student.id });
    expect(recent).toHaveLength(1);
    expect(recent[0]?.sessionId).toBe(session.id);
    expect(recent[0]?.totalAnswered).toBe(0);
    expect(recent[0]?.totalCorrect).toBe(0);
  });

  it("respects the limit", () => {
    const student = repos.students.create({ name: "Alice" });
    for (let i = 0; i < 5; i += 1) {
      repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    }
    expect(repos.progress.recentSessions({ studentId: student.id, limit: 3 })).toHaveLength(3);
  });
});

describe("ProgressRepository — tutorOverview", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });
  afterEach(() => {
    closeDatabase(db);
  });

  it("returns one row per active student, archived ones excluded", () => {
    const alice = repos.students.create({ name: "Alice" });
    const bob = repos.students.create({ name: "Bob" });
    const carol = repos.students.create({ name: "Carol" });
    repos.students.archive(carol.id);

    const rows = repos.progress.tutorOverview({ now: T0 });
    expect(rows.map((r) => r.student.id)).toEqual([alice.id, bob.id]);
    for (const r of rows) {
      expect(r.totalSeen).toBe(0);
      expect(r.accuracy).toBe(0);
      expect(r.lastPracticedAt).toBeNull();
    }
  });

  it("rolls up totals + accuracy + lastPracticedAt per student", () => {
    const { lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["alpha"]);
    if (!seeded) throw new Error("seed mismatch");
    const alice = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: alice.id, mode: "mixed" });
    repos.progress.recordAnswer({
      studentId: alice.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: T0,
    });
    repos.progress.recordAnswer({
      studentId: alice.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: wrong(),
      now: new Date(T0.getTime() + 60_000),
    });

    const rows = repos.progress.tutorOverview({ now: new Date(T0.getTime() + 5 * DAY_MS) });
    const aliceRow = rows.find((r) => r.student.id === alice.id);
    expect(aliceRow?.totalSeen).toBe(1);
    expect(aliceRow?.accuracy).toBeCloseTo(0.5, 3);
    expect(aliceRow?.lastPracticedAt?.getTime()).toBe(T0.getTime() + 60_000);
  });
});
