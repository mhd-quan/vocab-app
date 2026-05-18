import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { __studentDataImportTest } from "../../../electron/ipc/procedures/evidence";
import {
  dictionaryLearningItems,
  dictionaryLearningReviews,
  dictionarySearchEvents,
  learningEvents,
  practiceSessions,
  sessionEvidenceEvents,
  students,
} from "../../../src/data/schema";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { first, freshDb, seedCurriculum } from "../../helpers";

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

describe("student data report import", () => {
  let sourceDb: AppDatabase;
  let sourceRepos: Repositories;
  let targetDb: AppDatabase;
  let targetRepos: Repositories;

  beforeEach(() => {
    ({ db: sourceDb, repos: sourceRepos } = freshDb());
    ({ db: targetDb, repos: targetRepos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(sourceDb);
    closeDatabase(targetDb);
  });

  it("imports a full student bundle idempotently on repeated imports", () => {
    const sourceLesson = seedCurriculum(sourceDb).lesson;
    const targetLesson = seedCurriculum(targetDb).lesson;
    const sourceEntry = seedEntry(sourceRepos, sourceLesson.id);
    seedEntry(targetRepos, targetLesson.id);
    const sourceStudent = sourceRepos.students.create({ name: "Alice" });
    const sourceSession = sourceRepos.progress.startSession({
      studentId: sourceStudent.id,
      mode: "mixed",
    });

    sourceRepos.progress.recordAnswer({
      studentId: sourceStudent.id,
      sessionId: sourceSession.id,
      entryId: sourceEntry.entryId,
      outcome: correctOutcome,
      now: new Date("2026-01-01T08:00:00.000Z"),
      responseMs: 1200,
    });
    sourceRepos.evidence.recordEvent({
      studentId: sourceStudent.id,
      sessionId: sourceSession.id,
      kind: "answer_submitted",
      payload: { correct: true, responseMs: 1200 },
      occurredAt: new Date("2026-01-01T08:00:01.200Z"),
    });
    sourceRepos.progress.endSession({
      sessionId: sourceSession.id,
      summary: { total: 1 },
    });

    sourceRepos.dictionaryLearning.recordSearch({ studentId: sourceStudent.id, query: "relative" });
    const dictionaryItem = sourceDb
      .insert(dictionaryLearningItems)
      .values({
        studentId: sourceStudent.id,
        dictionaryKey: "relative::noun::1",
        headword: "relative",
        pos: "noun",
        definitionEn: "a member of your family",
        status: "learning",
        stage: "flashcard",
      })
      .returning()
      .get();
    expect(dictionaryItem).toBeTruthy();
    sourceDb
      .insert(dictionaryLearningReviews)
      .values({
        itemId: first([dictionaryItem]).id,
        studentId: sourceStudent.id,
        sessionId: sourceSession.id,
        stageBefore: "flashcard",
        stageAfter: "meaning_choice",
        statusAfter: "learning",
        correct: true,
        answer: "relative",
        expected: "relative",
        createdAt: new Date("2026-01-01T08:00:02.000Z"),
      })
      .run();

    const data = __studentDataImportTest.buildStudentDataExport(
      { db: sourceDb, repos: sourceRepos },
      sourceStudent.id,
      false,
    );
    const report = { data };
    const firstImport = __studentDataImportTest.importStudentDataBundle(
      { db: targetDb, repos: targetRepos },
      report,
    );
    const secondImport = __studentDataImportTest.importStudentDataBundle(
      { db: targetDb, repos: targetRepos },
      report,
    );

    expect(firstImport.sessionsInserted).toBe(1);
    expect(firstImport.learningEventsInserted).toBe(1);
    expect(firstImport.evidenceEventsInserted).toBe(1);
    expect(firstImport.dictionarySearchesInserted).toBe(1);
    expect(secondImport.sessionsUpdated).toBe(1);
    expect(secondImport.learningEventsSkipped).toBe(1);
    expect(secondImport.evidenceEventsSkipped).toBe(1);
    expect(secondImport.dictionarySearchesSkipped).toBe(1);

    const importedStudent = targetDb.select().from(students).all();
    expect(importedStudent).toHaveLength(1);
    const targetStudentId = first(importedStudent).id;
    expect(
      targetDb
        .select()
        .from(practiceSessions)
        .where(eq(practiceSessions.studentId, targetStudentId))
        .all(),
    ).toHaveLength(1);
    expect(
      targetDb
        .select()
        .from(learningEvents)
        .where(eq(learningEvents.studentId, targetStudentId))
        .all(),
    ).toHaveLength(1);
    expect(
      targetDb
        .select()
        .from(sessionEvidenceEvents)
        .where(eq(sessionEvidenceEvents.studentId, targetStudentId))
        .all(),
    ).toHaveLength(1);
    expect(
      targetDb
        .select()
        .from(dictionarySearchEvents)
        .where(eq(dictionarySearchEvents.studentId, targetStudentId))
        .all(),
    ).toHaveLength(1);
    expect(
      targetDb
        .select()
        .from(dictionaryLearningItems)
        .where(eq(dictionaryLearningItems.studentId, targetStudentId))
        .all(),
    ).toHaveLength(1);
    expect(
      targetDb
        .select()
        .from(dictionaryLearningReviews)
        .where(eq(dictionaryLearningReviews.studentId, targetStudentId))
        .all(),
    ).toHaveLength(1);
  });
});
