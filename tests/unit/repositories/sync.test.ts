import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { learningEvents } from "../../../src/data/schema";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { first, freshDb, seedCurriculum } from "../../helpers";

const T0 = new Date("2026-02-03T04:05:06Z");

function correct(): GradeOutcome {
  return { correct: true, feedback: "ok", selfGrade: "good", selectedIndex: null };
}

function seedEntry(repos: Repositories, lessonId: number) {
  return repos.vocab.upsertEntryWithChildren({
    lessonId,
    sourceId: "relative-noun",
    contentHash: "relative-hash",
    headword: "relative",
    pos: "noun",
    senses: [
      {
        ordinal: 0,
        definitionEn: "a member of your family",
        definitionVi: "nguoi than",
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

describe("SyncRepository", () => {
  const opened: AppDatabase[] = [];

  afterEach(() => {
    while (opened.length > 0) {
      const db = opened.pop();
      if (db) closeDatabase(db);
    }
  });

  function fresh() {
    const result = freshDb();
    opened.push(result.db);
    return result;
  }

  it("exports a student log with stable content refs and progress snapshots", () => {
    const { db, repos } = fresh();
    const { lesson } = seedCurriculum(db);
    const entry = seedEntry(repos, lesson.id);
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

    repos.progress.recordAnswer({
      studentId: student.id,
      sessionId: session.id,
      entryId: entry.entryId,
      outcome: correct(),
      now: T0,
    });

    const pkg = repos.sync.exportStudentLog({ studentId: student.id, platform: "test" });

    expect(pkg.format).toBe("lexicon-lab.student-log");
    expect(pkg.student.name).toBe("Alice");
    expect(pkg.progress.sessions).toHaveLength(1);
    expect(pkg.progress.events).toHaveLength(1);
    expect(pkg.progress.itemProgress).toHaveLength(1);
    expect(first(pkg.progress.events).contentRef).toMatchObject({
      bookCode: "destination-b1",
      unitCode: "U01",
      lessonSlug: "lesson-1",
      refTable: "vocab_entries",
      sourceId: "relative-noun",
    });
  });

  it("imports a log idempotently into another local database", () => {
    const source = fresh();
    const sourceCurriculum = seedCurriculum(source.db);
    const sourceEntry = seedEntry(source.repos, sourceCurriculum.lesson.id);
    const sourceStudent = source.repos.students.create({ name: "Alice" });
    const sourceSession = source.repos.progress.startSession({
      studentId: sourceStudent.id,
      mode: "mixed",
    });
    source.repos.progress.recordAnswer({
      studentId: sourceStudent.id,
      sessionId: sourceSession.id,
      entryId: sourceEntry.entryId,
      outcome: correct(),
      now: T0,
    });
    const pkg = source.repos.sync.exportStudentLog({
      studentId: sourceStudent.id,
      platform: "test",
    });

    const target = fresh();
    const targetCurriculum = seedCurriculum(target.db);
    seedEntry(target.repos, targetCurriculum.lesson.id);

    const firstImport = target.repos.sync.importStudentLog(pkg);

    expect(firstImport.createdStudent).toBe(true);
    expect(firstImport.eventsImported).toBe(1);
    expect(firstImport.progressUpserted).toBe(1);
    expect(
      target.repos.progress.studentSummary({
        studentId: firstImport.studentId,
        now: T0,
      }),
    ).toMatchObject({ totalSeen: 1, totalCorrect: 1, totalWrong: 0 });

    const duplicate = target.repos.sync.importStudentLog(pkg);
    const rows = target.db
      .select()
      .from(learningEvents)
      .where(eq(learningEvents.studentId, firstImport.studentId))
      .all();

    expect(duplicate.alreadyImported).toBe(true);
    expect(rows).toHaveLength(1);
  });
});
