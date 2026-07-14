import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { __studentDataExportTest } from "../../../electron/ipc/procedures/evidence";
import type { GradeOutcome } from "../../../src/modules/exercises";
import { freshDb, seedCurriculum } from "../../helpers";

const correctOutcome: GradeOutcome = {
  correct: true,
  feedback: "ok",
  selfGrade: "good",
  selectedIndex: null,
};

describe("student history export", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("exports every session and log beyond the old 100-session limit without a PIN hash", () => {
    const { lesson } = seedCurriculum(db);
    const entry = repos.vocab.upsertEntryWithChildren({
      lessonId: lesson.id,
      sourceId: "history-word-noun",
      contentHash: "history-word-hash",
      headword: "history-word",
      pos: "noun",
      senses: [
        {
          ordinal: 0,
          definitionEn: "history word definition",
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
    const student = repos.students.create({ name: "Export Learner" });
    repos.students.updatePin(student.id, "scrypt$secret-pin-hash");

    for (let index = 0; index < 105; index += 1) {
      const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
      const occurredAt = new Date(Date.UTC(2026, 0, 1, 0, index));
      repos.progress.recordAnswer({
        studentId: student.id,
        sessionId: session.id,
        entryId: entry.entryId,
        outcome: correctOutcome,
        responseMs: 900 + index,
        now: occurredAt,
      });
      repos.evidence.recordEvent({
        studentId: student.id,
        sessionId: session.id,
        kind: "answer_submitted",
        payload: { correct: true, responseMs: 900 + index },
        occurredAt,
      });
      repos.progress.endSession({ sessionId: session.id, summary: { total: 1 } });
    }

    const exported = __studentDataExportTest.buildStudentHistoryExport(
      { db, repos },
      student.id,
      false,
      new Date("2026-07-14T00:00:00.000Z"),
    );

    expect(exported.counts).toEqual({
      sessionCount: 105,
      learningEventCount: 105,
      evidenceEventCount: 105,
    });
    expect(exported.data.sessions).toHaveLength(105);
    expect(exported.payload.progress.recentSessions).toHaveLength(105);
    expect(exported.payload.progress.sessions).toHaveLength(105);
    expect(exported.payload.evidence.overview.recentSessions).toHaveLength(105);
    expect(exported.payload.evidence.sessions).toHaveLength(105);
    expect(exported.payload.student).not.toHaveProperty("pinHash");
    expect(exported.payload.data.student).not.toHaveProperty("pinHash");
    expect(JSON.stringify(exported.payload)).not.toContain("scrypt$secret-pin-hash");
  });
});
