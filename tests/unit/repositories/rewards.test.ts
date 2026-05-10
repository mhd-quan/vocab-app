import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { freshDb, seedCurriculum } from "../../helpers";

const T0 = new Date("2026-01-01T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

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
      sourceId: `e-${i}`,
      contentHash: `h-${i}`,
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

describe("RewardsRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  describe("listUnlocked", () => {
    it("returns an empty list for a student who's never practised", () => {
      const student = repos.students.create({ name: "Alice" });
      expect(repos.rewards.listUnlocked(student.id)).toEqual([]);
    });

    it("surfaces achievements unlocked via recordAnswer, newest first", () => {
      const { lesson } = seedCurriculum(db);
      const [seeded] = seedEntries(repos, lesson.id, ["relative"]);
      if (!seeded) throw new Error("entry not seeded");
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: seeded.entryId,
        outcome: correct(),
        now: T0,
        currentSessionRun: 1,
      });

      const unlocked = repos.rewards.listUnlocked(student.id);
      expect(unlocked.map((u) => u.achievementId)).toContain("first_answer");
    });
  });

  describe("streak", () => {
    it("computes a daily streak across recorded events", () => {
      const { lesson } = seedCurriculum(db);
      const [seeded] = seedEntries(repos, lesson.id, ["relative"]);
      if (!seeded) throw new Error("entry not seeded");
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

      // Practise 3 days in a row.
      for (let day = 0; day < 3; day += 1) {
        repos.progress.recordAnswer({
          studentId: student.id,
          sessionId: session.id,
          entryId: seeded.entryId,
          outcome: correct(),
          now: new Date(T0.getTime() + day * DAY_MS),
          currentSessionRun: 1,
        });
      }

      const streak = repos.rewards.streak({
        studentId: student.id,
        now: new Date(T0.getTime() + 2 * DAY_MS + 6 * 60 * 60 * 1000),
      });
      expect(streak.currentStreak).toBe(3);
      expect(streak.longestStreak).toBe(3);
    });
  });

  describe("evaluate", () => {
    it("is idempotent — running twice does not duplicate rows", () => {
      const { lesson } = seedCurriculum(db);
      const [seeded] = seedEntries(repos, lesson.id, ["relative"]);
      if (!seeded) throw new Error("entry not seeded");
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: seeded.entryId,
        outcome: correct(),
        now: T0,
        currentSessionRun: 1,
      });

      const first = repos.rewards.evaluate({ studentId: student.id, now: T0 });
      const second = repos.rewards.evaluate({ studentId: student.id, now: T0 });
      expect(first).toEqual([]); // recordAnswer already persisted them
      expect(second).toEqual([]);
      expect(repos.rewards.listUnlocked(student.id)).toHaveLength(1);
    });
  });
});

describe("recordAnswer — achievement integration", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("returns first_answer on the very first correct answer", () => {
    const { lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["relative"]);
    if (!seeded) throw new Error("entry not seeded");
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

    const result = repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: T0,
      currentSessionRun: 1,
    });
    expect(result.unlockedAchievements.map((a) => a.achievementId)).toEqual(["first_answer"]);
  });

  it("does not fire achievements on a wrong answer", () => {
    const { lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["relative"]);
    if (!seeded) throw new Error("entry not seeded");
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

    const result = repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: wrong(),
      now: T0,
      currentSessionRun: 0,
    });
    expect(result.unlockedAchievements).toEqual([]);
  });

  it("does not re-unlock the same achievement twice", () => {
    const { lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["relative"]);
    if (!seeded) throw new Error("entry not seeded");
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

    const first = repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: T0,
      currentSessionRun: 1,
    });
    const second = repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: new Date(T0.getTime() + 1000),
      currentSessionRun: 2,
    });
    expect(first.unlockedAchievements.map((a) => a.achievementId)).toContain("first_answer");
    expect(second.unlockedAchievements.map((a) => a.achievementId)).not.toContain("first_answer");
  });

  it("fires streak_5 when the in-session run reaches 5", () => {
    const { lesson } = seedCurriculum(db);
    const seeded = seedEntries(repos, lesson.id, ["a", "b", "c", "d", "e"]);
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

    let lastResult: ReturnType<typeof repos.progress.recordAnswer> | null = null;
    for (let i = 0; i < seeded.length; i += 1) {
      const entry = seeded[i];
      if (!entry) throw new Error("seed mismatch");
      lastResult = repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: entry.entryId,
        outcome: correct(),
        now: new Date(T0.getTime() + i * 1000),
        currentSessionRun: i + 1,
      });
    }
    if (!lastResult) throw new Error("no result captured");
    expect(lastResult.unlockedAchievements.map((a) => a.achievementId)).toContain("streak_5");
  });

  it("fires daily_3 once a 3-day streak is reached", () => {
    const { lesson } = seedCurriculum(db);
    const [seeded] = seedEntries(repos, lesson.id, ["relative"]);
    if (!seeded) throw new Error("seed mismatch");
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: new Date(2026, 0, 1, 12),
      currentSessionRun: 1,
    });
    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: new Date(2026, 0, 2, 12),
      currentSessionRun: 1,
    });
    const day3 = repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: seeded.entryId,
      outcome: correct(),
      now: new Date(2026, 0, 3, 12),
      currentSessionRun: 1,
    });
    expect(day3.unlockedAchievements.map((a) => a.achievementId)).toContain("daily_3");
  });
});
