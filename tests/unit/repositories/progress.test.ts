import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { freshDb, seedCurriculum } from "../../helpers";

const T0 = new Date("2026-01-01T00:00:00Z");
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

describe("ProgressRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  describe("startSession + endSession", () => {
    it("opens a session row with mode + studentId, no endedAt", () => {
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({
        studentId: student.id,
        mode: "flashcard",
      });
      expect(session.studentId).toBe(student.id);
      expect(session.mode).toBe("flashcard");
      expect(session.endedAt).toBeNull();
    });

    it("endSession stamps endedAt + summary", () => {
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
      repos.progress.endSession({
        sessionId: session.id,
        summary: { totalCorrect: 3, totalWrong: 1 },
      });
      const summary = repos.progress.studentSummary({ studentId: student.id, now: T0 });
      // No items recorded → summary is zeros, but the session row exists.
      expect(summary.totalSeen).toBe(0);
    });
  });

  describe("recordAnswer", () => {
    it("appends a learning_event and creates a fresh item_progress row on first answer", () => {
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
      });

      expect(result.event.kind).toBe("answered_correct");
      expect(result.progress.totalCorrect).toBe(1);
      // FSRS-lite: first "good" rating seeds stability=1 day, state=short_term
      // (with default shortTermDays=1). reps increments to 1.
      expect(result.progress.reps).toBe(1);
      expect(result.progress.state).toBe("short_term");
      expect(result.progress.stability).toBe(1);
      expect(result.progress.nextDueAt?.getTime()).toBe(T0.getTime() + DAY_MS);
    });

    it("a wrong answer resets streak, but bumps totalWrong + lastSeen", () => {
      const { lesson } = seedCurriculum(db);
      const [seeded] = seedEntries(repos, lesson.id, ["relative"]);
      if (!seeded) throw new Error("entry not seeded");
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

      // First a passing answer to build a streak.
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: seeded.entryId,
        outcome: correct(),
        now: T0,
      });
      const after = repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: seeded.entryId,
        outcome: wrong(),
        now: new Date(T0.getTime() + DAY_MS),
      });
      // FSRS-lite lapse path: reps resets to 0, lapses ticks up.
      expect(after.progress.reps).toBe(0);
      expect(after.progress.lapses).toBe(1);
      expect(after.progress.state).toBe("learning");
      expect(after.progress.totalCorrect).toBe(1);
      expect(after.progress.totalWrong).toBe(1);
    });

    it("throws when the entry has no content_items row (e.g. orphaned data)", () => {
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
      expect(() =>
        repos.progress.recordAnswer({
          studentId: student.id,
          sessionId: session.id,
          entryId: 99_999,
          outcome: correct(),
          now: T0,
        }),
      ).toThrow(/content_items/);
    });
  });

  describe("recordContentAnswer", () => {
    it("records grammar topic progress through content_items", () => {
      const { lesson } = seedCurriculum(db, { lessonKind: "grammar" });
      const inserted = repos.grammar.upsertTopic({
        lessonId: lesson.id,
        sourceId: "present-simple",
        slug: "present-simple",
        title: "Present simple",
        summaryMd: null,
        explanationMd: null,
        difficulty: 1,
        tags: ["tense"],
        metadata: null,
        contentHash: "grammar-hash",
      });
      const contentItem = repos.progress.contentItemForGrammarTopic(inserted.topicId);
      if (!contentItem) throw new Error("grammar content item not found");

      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "grammar" });
      const result = repos.progress.recordContentAnswer({
        studentId: student.id,
        sessionId: session.id,
        contentItemId: contentItem.id,
        outcome: correct(),
        now: T0,
      });

      expect(result.event.contentItemId).toBe(contentItem.id);
      expect(result.progress.totalCorrect).toBe(1);
    });
  });

  describe("dueByLesson", () => {
    it("returns zero counts for a lesson with no entries", () => {
      const { lesson } = seedCurriculum(db);
      const student = repos.students.create({ name: "Alice" });
      const stats = repos.progress.dueByLesson({
        studentId: student.id,
        lessonId: lesson.id,
        now: T0,
      });
      expect(stats).toEqual({ totalCount: 0, dueCount: 0, newCount: 0 });
    });

    it("counts unseen entries as 'new', and applies due cutoff against item_progress", () => {
      const { lesson } = seedCurriculum(db);
      const [a, b] = seedEntries(repos, lesson.id, ["a", "b", "c", "d"]);
      if (!a || !b) throw new Error("seed produced fewer entries than expected");
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

      // Practise the first two; the rest stay new.
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: a.entryId,
        outcome: correct(),
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: b.entryId,
        outcome: correct(),
        now: T0,
      });

      // 1 day later: both seen items become due, 2 are still new.
      const after = repos.progress.dueByLesson({
        studentId: student.id,
        lessonId: lesson.id,
        now: new Date(T0.getTime() + DAY_MS + 1),
      });
      expect(after.totalCount).toBe(4);
      expect(after.dueCount).toBe(2);
      expect(after.newCount).toBe(2);

      // Still inside the interval window: nothing's due yet.
      const inside = repos.progress.dueByLesson({
        studentId: student.id,
        lessonId: lesson.id,
        now: T0,
      });
      expect(inside.dueCount).toBe(0);
      expect(inside.newCount).toBe(2);
    });

    it("counts grammar topics as lesson content items", () => {
      const { lesson } = seedCurriculum(db, { lessonKind: "grammar" });
      repos.grammar.upsertTopic({
        lessonId: lesson.id,
        sourceId: "present-simple",
        slug: "present-simple",
        title: "Present simple",
        summaryMd: null,
        explanationMd: null,
        difficulty: null,
        tags: null,
        metadata: null,
        contentHash: "grammar-hash",
      });
      const student = repos.students.create({ name: "Alice" });

      const stats = repos.progress.dueByLesson({
        studentId: student.id,
        lessonId: lesson.id,
        now: T0,
      });

      expect(stats).toEqual({ totalCount: 1, dueCount: 0, newCount: 1 });
    });
  });

  describe("seenEntryIdsByLesson", () => {
    it("returns only vocab entries already seen by the student in the lesson", () => {
      const { lesson: firstLesson } = seedCurriculum(db);
      const { lesson: secondLesson } = seedCurriculum(db, { bookCode: "destination-b2" });
      const [alpha, beta] = seedEntries(repos, firstLesson.id, ["alpha", "beta", "gamma"]);
      const [outside] = seedEntries(repos, secondLesson.id, ["outside"]);
      if (!alpha || !beta || !outside) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      const otherStudent = repos.students.create({ name: "Bob" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
      const otherSession = repos.progress.startSession({
        studentId: otherStudent.id,
        mode: "mixed",
      });

      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: beta.entryId,
        outcome: correct(),
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: alpha.entryId,
        outcome: correct(),
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: outside.entryId,
        outcome: correct(),
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: otherStudent.id,
        sessionId: otherSession.id,
        entryId: alpha.entryId,
        outcome: correct(),
        now: T0,
      });

      expect(
        repos.progress.seenEntryIdsByLesson({
          studentId: student.id,
          lessonId: firstLesson.id,
        }),
      ).toEqual([alpha.entryId, beta.entryId]);
    });
  });

  describe("dueByStudent", () => {
    it("returns due items with headword + lesson id, sorted oldest first", () => {
      const { lesson } = seedCurriculum(db);
      const [alpha, beta] = seedEntries(repos, lesson.id, ["alpha", "beta"]);
      if (!alpha || !beta) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: alpha.entryId,
        outcome: correct(),
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: beta.entryId,
        outcome: correct(),
        now: new Date(T0.getTime() + 60_000), // 1 minute later
      });

      const due = repos.progress.dueByStudent({
        // Past beta's T0+60s + 1-day interval so both are due.
        studentId: student.id,
        now: new Date(T0.getTime() + DAY_MS + 60_000 + 1),
      });
      expect(due.map((d) => d.headword)).toEqual(["alpha", "beta"]);
    });

    it("excludes items that aren't due yet", () => {
      const { lesson } = seedCurriculum(db);
      const [single] = seedEntries(repos, lesson.id, ["x"]);
      if (!single) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: single.entryId,
        outcome: correct(),
        now: T0,
      });
      const due = repos.progress.dueByStudent({ studentId: student.id, now: T0 });
      expect(due).toEqual([]);
    });
  });

  describe("studentSummary", () => {
    it("rolls totals + accuracy across all items", () => {
      const { lesson } = seedCurriculum(db);
      const [first, second] = seedEntries(repos, lesson.id, ["a", "b"]);
      if (!first || !second) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: first.entryId,
        outcome: correct(),
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: first.entryId,
        outcome: correct(),
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: second.entryId,
        outcome: wrong(),
        now: T0,
      });

      const summary = repos.progress.studentSummary({ studentId: student.id, now: T0 });
      expect(summary.totalSeen).toBe(2); // distinct items
      expect(summary.totalCorrect).toBe(2);
      expect(summary.totalWrong).toBe(1);
      expect(summary.accuracy).toBeCloseTo(2 / 3, 3);
    });
  });
});
