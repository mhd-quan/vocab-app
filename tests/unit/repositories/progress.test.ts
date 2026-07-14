import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { itemProgress, lessons, units } from "../../../src/data/schema";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { first, freshDb, seedCurriculum } from "../../helpers";

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

function insertProgress(
  db: AppDatabase,
  input: {
    studentId: number;
    contentItemId: number;
    state: "new" | "learning" | "short_term" | "long_term";
    nextDueAt: Date | null;
    track?: "curated" | "personal";
  },
) {
  db.insert(itemProgress)
    .values({
      studentId: input.studentId,
      contentItemId: input.contentItemId,
      track: input.track ?? "curated",
      state: input.state,
      nextDueAt: input.nextDueAt,
    })
    .run();
}

function expectAssignedProgressInvariants(row: {
  totalCount: number;
  introducedCount: number;
  newCount: number;
  learningCount: number;
  secureCount: number;
  dueCount: number;
  currentCount: number;
  dueLearningCount: number;
  dueSecureCount: number;
  learningCurrentCount: number;
  secureCurrentCount: number;
}) {
  expect(row.newCount + row.introducedCount).toBe(row.totalCount);
  expect(row.learningCount + row.secureCount).toBe(row.introducedCount);
  expect(row.dueCount + row.currentCount).toBe(row.introducedCount);
  expect(row.dueLearningCount + row.dueSecureCount).toBe(row.dueCount);
  expect(row.learningCurrentCount + row.secureCurrentCount).toBe(row.currentCount);
  expect(row.dueLearningCount + row.learningCurrentCount).toBe(row.learningCount);
  expect(row.dueSecureCount + row.secureCurrentCount).toBe(row.secureCount);
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

  describe("assignedUnitProgress", () => {
    it("batches vocab + grammar into truthful mastery and due/current dimensions", () => {
      const { book, unit, lesson: vocabLesson } = seedCurriculum(db);
      const grammarLesson = first(
        db
          .insert(lessons)
          .values({
            unitId: unit.id,
            ordinal: 2,
            kind: "grammar",
            title: "Grammar",
            slug: "grammar",
          })
          .returning()
          .all(),
      );
      const [, explicitNew, learningDue, shortTermCurrent, secureDue] = seedEntries(
        repos,
        vocabLesson.id,
        ["unseen", "explicit-new", "learning-due", "short-current", "secure-due"],
      );
      if (!explicitNew || !learningDue || !shortTermCurrent || !secureDue) {
        throw new Error("seed mismatch");
      }
      const grammar = repos.grammar.upsertTopic({
        lessonId: grammarLesson.id,
        sourceId: "present-simple",
        slug: "present-simple",
        title: "Present simple",
        contentHash: "grammar-hash",
      });
      const student = repos.students.create({ name: "Alice" });
      repos.students.replaceUnitAssignments({
        studentId: student.id,
        bookId: book.id,
        unitIds: [unit.id],
      });

      const contentIdFor = (entryId: number) => {
        const item = repos.progress.contentItemForEntry(entryId);
        if (!item) throw new Error(`missing content item for ${entryId}`);
        return item.id;
      };
      const grammarItem = repos.progress.contentItemForGrammarTopic(grammar.topicId);
      if (!grammarItem) throw new Error("missing grammar content item");

      insertProgress(db, {
        studentId: student.id,
        contentItemId: contentIdFor(explicitNew.entryId),
        state: "new",
        nextDueAt: null,
      });
      insertProgress(db, {
        studentId: student.id,
        contentItemId: contentIdFor(learningDue.entryId),
        state: "learning",
        nextDueAt: new Date(T0.getTime() - 2 * DAY_MS),
      });
      insertProgress(db, {
        studentId: student.id,
        contentItemId: contentIdFor(shortTermCurrent.entryId),
        state: "short_term",
        nextDueAt: new Date(T0.getTime() + DAY_MS),
      });
      insertProgress(db, {
        studentId: student.id,
        contentItemId: contentIdFor(secureDue.entryId),
        state: "long_term",
        nextDueAt: T0,
      });
      insertProgress(db, {
        studentId: student.id,
        contentItemId: grammarItem.id,
        state: "long_term",
        nextDueAt: new Date(T0.getTime() + 30 * DAY_MS),
      });

      const [row] = repos.progress.assignedUnitProgress({ studentId: student.id, now: T0 });
      expect(row).toMatchObject({
        bookId: book.id,
        unitId: unit.id,
        totalCount: 6,
        introducedCount: 4,
        newCount: 2,
        learningCount: 2,
        secureCount: 2,
        dueCount: 2,
        currentCount: 2,
        dueLearningCount: 1,
        dueSecureCount: 1,
        learningCurrentCount: 1,
        secureCurrentCount: 1,
      });
      expect(row?.oldestDueAt?.getTime()).toBe(T0.getTime() - 2 * DAY_MS);
      expect(row?.lessons).toHaveLength(2);
      if (!row) throw new Error("assigned unit progress missing");
      expectAssignedProgressInvariants(row);
      row.lessons.forEach(expectAssignedProgressInvariants);

      const vocab = row.lessons.find((lesson) => lesson.lessonId === vocabLesson.id);
      const grammarRow = row.lessons.find((lesson) => lesson.lessonId === grammarLesson.id);
      expect(vocab).toMatchObject({
        totalCount: 5,
        introducedCount: 3,
        newCount: 2,
        learningCount: 2,
        secureCount: 1,
        dueCount: 2,
        currentCount: 1,
      });
      expect(grammarRow).toMatchObject({
        totalCount: 1,
        introducedCount: 1,
        newCount: 0,
        learningCount: 0,
        secureCount: 1,
        dueCount: 0,
        currentCount: 1,
      });
    });

    it("returns assigned lessons with zero content as an all-zero row", () => {
      const { book, unit, lesson } = seedCurriculum(db);
      const student = repos.students.create({ name: "Alice" });
      repos.students.replaceUnitAssignments({
        studentId: student.id,
        bookId: book.id,
        unitIds: [unit.id],
      });

      const rows = repos.progress.assignedUnitProgress({ studentId: student.id, now: T0 });
      expect(rows).toEqual([
        {
          bookId: book.id,
          unitId: unit.id,
          totalCount: 0,
          introducedCount: 0,
          newCount: 0,
          learningCount: 0,
          secureCount: 0,
          dueCount: 0,
          currentCount: 0,
          dueLearningCount: 0,
          dueSecureCount: 0,
          learningCurrentCount: 0,
          secureCurrentCount: 0,
          oldestDueAt: null,
          lessons: [
            {
              lessonId: lesson.id,
              totalCount: 0,
              introducedCount: 0,
              newCount: 0,
              learningCount: 0,
              secureCount: 0,
              dueCount: 0,
              currentCount: 0,
              dueLearningCount: 0,
              dueSecureCount: 0,
              learningCurrentCount: 0,
              secureCurrentCount: 0,
              oldestDueAt: null,
            },
          ],
        },
      ]);
    });

    it("moves a future learning item to due at the inclusive cutoff", () => {
      const { book, unit, lesson } = seedCurriculum(db);
      const [entry] = seedEntries(repos, lesson.id, ["scheduled"]);
      if (!entry) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      repos.students.replaceUnitAssignments({
        studentId: student.id,
        bookId: book.id,
        unitIds: [unit.id],
      });
      const item = repos.progress.contentItemForEntry(entry.entryId);
      if (!item) throw new Error("missing content item");
      const dueAt = new Date(T0.getTime() + DAY_MS);
      insertProgress(db, {
        studentId: student.id,
        contentItemId: item.id,
        state: "learning",
        nextDueAt: dueAt,
      });

      const before = repos.progress.assignedUnitProgress({ studentId: student.id, now: T0 })[0];
      expect(before).toMatchObject({
        learningCount: 1,
        dueCount: 0,
        currentCount: 1,
        dueLearningCount: 0,
        learningCurrentCount: 1,
        oldestDueAt: null,
      });

      const atCutoff = repos.progress.assignedUnitProgress({
        studentId: student.id,
        now: dueAt,
      })[0];
      expect(atCutoff).toMatchObject({
        learningCount: 1,
        dueCount: 1,
        currentCount: 0,
        dueLearningCount: 1,
        learningCurrentCount: 0,
      });
      expect(atCutoff?.oldestDueAt?.getTime()).toBe(dueAt.getTime());
    });

    it("treats an introduced item without a schedule timestamp as due now", () => {
      const { book, unit, lesson } = seedCurriculum(db);
      const [entry] = seedEntries(repos, lesson.id, ["unscheduled"]);
      if (!entry) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      repos.students.replaceUnitAssignments({
        studentId: student.id,
        bookId: book.id,
        unitIds: [unit.id],
      });
      const item = repos.progress.contentItemForEntry(entry.entryId);
      if (!item) throw new Error("missing content item");
      insertProgress(db, {
        studentId: student.id,
        contentItemId: item.id,
        state: "short_term",
        nextDueAt: null,
      });

      const [row] = repos.progress.assignedUnitProgress({ studentId: student.id, now: T0 });
      expect(row).toMatchObject({
        introducedCount: 1,
        learningCount: 1,
        dueCount: 1,
        currentCount: 0,
        dueLearningCount: 1,
        learningCurrentCount: 0,
        oldestDueAt: null,
      });
      if (!row) throw new Error("assigned unit progress missing");
      expectAssignedProgressInvariants(row);
    });

    it("keeps status partitions complete when an imported snapshot has an unknown state", () => {
      const { book, unit, lesson } = seedCurriculum(db);
      const [entry] = seedEntries(repos, lesson.id, ["future-state"]);
      if (!entry) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      repos.students.replaceUnitAssignments({
        studentId: student.id,
        bookId: book.id,
        unitIds: [unit.id],
      });
      const item = repos.progress.contentItemForEntry(entry.entryId);
      if (!item) throw new Error("missing content item");

      db.insert(itemProgress)
        .values({
          studentId: student.id,
          contentItemId: item.id,
          track: "curated",
          // Report imports can contain a forward-version string before the
          // importer knows its semantics. The status UI must still partition
          // every item instead of rendering an underfilled composition.
          state: "future_state" as "new",
          nextDueAt: T0,
        })
        .run();

      const [row] = repos.progress.assignedUnitProgress({ studentId: student.id, now: T0 });
      expect(row).toMatchObject({
        totalCount: 1,
        introducedCount: 0,
        newCount: 1,
        learningCount: 0,
        secureCount: 0,
        dueCount: 0,
        currentCount: 0,
      });
      if (!row) throw new Error("assigned unit progress missing");
      expectAssignedProgressInvariants(row);
    });

    it("returns assigned units only and ignores personal-track snapshots", () => {
      const { book, unit: assignedUnit, lesson: assignedLesson } = seedCurriculum(db);
      const unassignedUnit = first(
        db
          .insert(units)
          .values({ bookId: book.id, ordinal: 2, code: "U02", title: "Unit 2" })
          .returning()
          .all(),
      );
      const unassignedLesson = first(
        db
          .insert(lessons)
          .values({
            unitId: unassignedUnit.id,
            ordinal: 1,
            kind: "vocabulary",
            title: "Outside",
            slug: "outside",
          })
          .returning()
          .all(),
      );
      const [assignedEntry] = seedEntries(repos, assignedLesson.id, ["assigned"]);
      const [outsideEntry] = seedEntries(repos, unassignedLesson.id, ["outside"]);
      if (!assignedEntry || !outsideEntry) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      const otherStudent = repos.students.create({ name: "Bob" });
      repos.students.replaceUnitAssignments({
        studentId: student.id,
        bookId: book.id,
        unitIds: [assignedUnit.id],
      });
      const assignedItem = repos.progress.contentItemForEntry(assignedEntry.entryId);
      const outsideItem = repos.progress.contentItemForEntry(outsideEntry.entryId);
      if (!assignedItem || !outsideItem) throw new Error("missing content item");
      insertProgress(db, {
        studentId: student.id,
        contentItemId: assignedItem.id,
        track: "personal",
        state: "long_term",
        nextDueAt: T0,
      });
      insertProgress(db, {
        studentId: student.id,
        contentItemId: outsideItem.id,
        state: "long_term",
        nextDueAt: T0,
      });
      insertProgress(db, {
        studentId: otherStudent.id,
        contentItemId: assignedItem.id,
        state: "long_term",
        nextDueAt: T0,
      });

      const rows = repos.progress.assignedUnitProgress({ studentId: student.id, now: T0 });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        bookId: book.id,
        unitId: assignedUnit.id,
        totalCount: 1,
        introducedCount: 0,
        newCount: 1,
        learningCount: 0,
        secureCount: 0,
        dueCount: 0,
      });
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

  describe("learning reports", () => {
    it("aggregates unit rows and drills into unit sessions", () => {
      const { lesson: unitOneLesson } = seedCurriculum(db);
      const { lesson: unitTwoLesson } = seedCurriculum(db, { bookCode: "destination-b2" });
      const [alpha, beta] = seedEntries(repos, unitOneLesson.id, ["alpha", "beta"]);
      const [gamma] = seedEntries(repos, unitTwoLesson.id, ["gamma"]);
      if (!alpha || !beta || !gamma) throw new Error("seed mismatch");
      const student = repos.students.create({ name: "Alice" });
      const firstSession = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
      const secondSession = repos.progress.startSession({ studentId: student.id, mode: "review" });

      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: firstSession.id,
        entryId: alpha.entryId,
        outcome: correct(),
        responseMs: 1_000,
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: firstSession.id,
        entryId: beta.entryId,
        outcome: wrong(),
        responseMs: 3_000,
        now: new Date(T0.getTime() + 1_000),
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: secondSession.id,
        entryId: gamma.entryId,
        outcome: correct(),
        responseMs: 5_000,
        now: new Date(T0.getTime() + 2_000),
      });

      const units = repos.progress.unitReport({ studentId: student.id });
      expect(units).toHaveLength(2);
      const unitOne = units.find((row) => row.unitId === unitOneLesson.unitId);
      expect(unitOne).toMatchObject({
        sessionCount: 1,
        totalAnswered: 2,
        totalCorrect: 1,
        totalWrong: 1,
        avgResponseMs: 2_000,
      });
      expect(unitOne?.accuracy).toBeCloseTo(0.5, 3);

      const sessions = repos.progress.unitSessions({
        studentId: student.id,
        unitId: unitOne?.unitId ?? -1,
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        sessionId: firstSession.id,
        totalAnswered: 2,
        totalCorrect: 1,
        avgResponseMs: 2_000,
      });
    });

    it("builds a session report with timeframe, unit breakdown, answers, and response time", () => {
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
        responseMs: 1_200,
        now: T0,
      });
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: beta.entryId,
        outcome: wrong(),
        responseMs: 2_400,
        now: new Date(T0.getTime() + 5_000),
      });
      repos.progress.endSession({ sessionId: session.id, summary: { totalAnswered: 2 } });

      const report = repos.progress.sessionReport({ sessionId: session.id });
      expect(report).not.toBeNull();
      expect(report?.totalAnswered).toBe(2);
      expect(report?.totalCorrect).toBe(1);
      expect(report?.accuracy).toBeCloseTo(0.5, 3);
      expect(report?.avgResponseMs).toBe(1_800);
      expect(report?.units).toHaveLength(1);
      expect(report?.units[0]?.totalAnswered).toBe(2);
      expect(report?.answers.map((answer) => [answer.itemLabel, answer.correct])).toEqual([
        ["alpha", true],
        ["beta", false],
      ]);
      expect(report?.session.startedAt).toBeInstanceOf(Date);
      expect(report?.session.endedAt).toBeInstanceOf(Date);
    });
  });
});
