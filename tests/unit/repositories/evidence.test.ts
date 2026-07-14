import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { practiceSessions, sessionEvidenceEvents } from "../../../src/data/schema";
import { freshDb } from "../../helpers";

function insertSession(db: AppDatabase, studentId: number, startedAt: Date) {
  const session = db
    .insert(practiceSessions)
    .values({ studentId, mode: "mixed", startedAt })
    .returning()
    .get();
  if (!session) throw new Error("Expected a practice session");
  return session;
}

describe("EvidenceRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("records session evidence separately from academic progress", () => {
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });

    repos.evidence.recordEvents([
      {
        studentId: student.id,
        sessionId: session.id,
        kind: "session_notice_shown",
        severity: "system",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        studentId: student.id,
        sessionId: session.id,
        kind: "answer_submitted",
        durationMs: 42_000,
        payload: { responseMs: 42_000, correct: true },
        occurredAt: new Date("2026-01-01T00:00:42Z"),
      },
      {
        studentId: student.id,
        sessionId: session.id,
        kind: "window_focus_returned",
        severity: "attention",
        durationMs: 12_000,
        occurredAt: new Date("2026-01-01T00:01:00Z"),
      },
      {
        studentId: student.id,
        sessionId: session.id,
        kind: "camera_snapshot",
        payload: { sha256: "abc", visibleIndicator: true },
        occurredAt: new Date("2026-01-01T00:05:00Z"),
      },
      {
        studentId: student.id,
        sessionId: session.id,
        kind: "pronunciation_assessment",
        payload: {
          overallScore: 58,
          phonemeScore: 62,
          passingScore: 70,
          retryRequired: true,
        },
        occurredAt: new Date("2026-01-01T00:06:00Z"),
      },
    ]);

    const overview = repos.evidence.studentOverview({ studentId: student.id });
    expect(overview.sessionCount).toBe(1);
    expect(overview.focusLossCount).toBe(1);
    expect(overview.cameraSnapshotCount).toBe(1);
    expect(overview.pronunciationAssessmentCount).toBe(1);
    expect(overview.pronunciationAverageScore).toBe(58);
    expect(overview.pronunciationFlagCount).toBe(1);
    expect(overview.pronunciationRetryRequiredCount).toBe(1);
    expect(overview.recentSessions[0]?.metrics.avgResponseMs).toBe(42_000);
    expect(overview.recentSessions[0]?.metrics.attentionScore).toBeLessThan(100);
  });

  it("cascades evidence rows when the practice session is removed", () => {
    const student = repos.students.create({ name: "Alice" });
    const session = repos.progress.startSession({ studentId: student.id, mode: "mixed" });
    repos.evidence.recordEvent({
      studentId: student.id,
      sessionId: session.id,
      kind: "answer_submitted",
      payload: { responseMs: 1_000 },
    });

    expect(db.select().from(sessionEvidenceEvents).all()).toHaveLength(1);
    db.delete(practiceSessions).where(eq(practiceSessions.id, session.id)).run();
    expect(db.select().from(sessionEvidenceEvents).all()).toHaveLength(0);
  });

  it("aggregates tutor metrics after applying attention caps and rounding per session", () => {
    const student = repos.students.create({ name: "Alice" });
    const older = insertSession(db, student.id, new Date("2026-01-01T00:00:00.000Z"));
    const newer = insertSession(db, student.id, new Date("2026-01-02T00:00:00.000Z"));

    repos.evidence.recordEvents([
      {
        studentId: student.id,
        sessionId: older.id,
        kind: "window_focus_returned",
        durationMs: 12_000,
      },
      {
        studentId: student.id,
        sessionId: older.id,
        kind: "document_visible",
        durationMs: 15_000,
      },
      {
        studentId: student.id,
        sessionId: older.id,
        kind: "answer_submitted",
        payload: { responseMs: 60_000 },
      },
      {
        studentId: student.id,
        sessionId: older.id,
        kind: "answer_submitted",
        payload: { responseMs: 900 },
      },
      { studentId: student.id, sessionId: older.id, kind: "guardrail_overlay_shown" },
      { studentId: student.id, sessionId: older.id, kind: "camera_unavailable" },
      { studentId: student.id, sessionId: older.id, kind: "camera_snapshot" },
      {
        studentId: student.id,
        sessionId: older.id,
        kind: "pronunciation_assessment",
        payload: { overallScore: 50, passingScore: 65, retryRequired: false },
      },
      {
        studentId: student.id,
        sessionId: older.id,
        kind: "pronunciation_assessment",
        payload: { overallScore: 51, passingScore: 65, retryRequired: false },
      },
      { studentId: student.id, sessionId: newer.id, kind: "session_notice_shown" },
      {
        studentId: student.id,
        sessionId: newer.id,
        kind: "pronunciation_assessment",
        payload: { overallScore: 50, passingScore: 65, retryRequired: true },
      },
    ]);

    const row = repos.evidence.tutorOverview()[0];
    expect(row).toMatchObject({
      student: { id: student.id },
      sessionCount: 2,
      avgAttentionScore: 81,
      totalReviewFlags: 9,
      focusLossCount: 1,
      cameraSnapshotCount: 1,
      pronunciationAssessmentCount: 3,
      // Per-session score rounding is preserved: round((round(50.5) * 2 + 50) / 3).
      pronunciationAverageScore: 51,
      pronunciationFlagCount: 3,
      pronunciationRetryRequiredCount: 1,
    });
    expect(row?.latestSessionAt).toEqual(new Date("2026-01-02T00:00:00.000Z"));
  });

  it("keeps student headline metrics lifetime while limiting only the recent-session index", () => {
    const student = repos.students.create({ name: "Long-running learner" });
    const sessionCount = 505;
    db.$sqlite.exec(`
      WITH digits(d) AS (
        VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9)
      ), numbers(n) AS (
        SELECT ones.d + tens.d * 10 + hundreds.d * 100
        FROM digits AS ones
        CROSS JOIN digits AS tens
        CROSS JOIN digits AS hundreds
      )
      INSERT INTO practice_sessions (student_id, mode, started_at)
      SELECT ${student.id}, 'mixed', n
      FROM numbers
      WHERE n BETWEEN 1 AND ${sessionCount};

      INSERT INTO session_evidence_events
        (student_id, session_id, kind, severity, occurred_at)
      SELECT student_id, id, 'camera_snapshot', 'info', started_at
      FROM practice_sessions
      WHERE student_id = ${student.id};
    `);

    const overview = repos.evidence.studentOverview({ studentId: student.id, limit: 8 });
    expect(overview).toMatchObject({
      studentId: student.id,
      sessionCount,
      cameraSnapshotCount: sessionCount,
      avgAttentionScore: 100,
      totalReviewFlags: 0,
      latestSessionAt: new Date(sessionCount),
    });
    expect(overview.recentSessions).toHaveLength(8);
    expect(overview.recentSessions[0]?.startedAt).toEqual(new Date(sessionCount));
  });

  it("returns zero evidence for active students and excludes archived students", () => {
    const active = repos.students.create({ name: "Active without evidence" });
    const archived = repos.students.create({ name: "Archived with evidence" });
    const archivedSession = repos.progress.startSession({
      studentId: archived.id,
      mode: "mixed",
    });
    repos.evidence.recordEvent({
      studentId: archived.id,
      sessionId: archivedSession.id,
      kind: "window_focus_returned",
      durationMs: 5_000,
    });
    repos.students.archive(archived.id);

    expect(repos.evidence.tutorOverview()).toEqual([
      expect.objectContaining({
        student: expect.objectContaining({ id: active.id }),
        latestSessionAt: null,
        sessionCount: 0,
        avgAttentionScore: null,
        totalReviewFlags: 0,
        focusLossCount: 0,
        cameraSnapshotCount: 0,
        pronunciationAssessmentCount: 0,
        pronunciationAverageScore: null,
        pronunciationFlagCount: 0,
        pronunciationRetryRequiredCount: 0,
      }),
    ]);
  });

  it("supports an active cohort larger than SQLite's bind-variable limit", () => {
    const cohortSize = 32_767;
    const compileOptions = db.$sqlite.pragma("compile_options") as Array<{
      compile_options: string;
    }>;
    const variableOption = compileOptions
      .map((row) => row.compile_options)
      .find((option) => option.startsWith("MAX_VARIABLE_NUMBER="));
    const variableLimit = Number(variableOption?.split("=")[1]);
    expect(cohortSize).toBeGreaterThan(variableLimit);

    db.$sqlite.exec(`
        WITH digits(d) AS (
          VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9)
        ), numbers(n) AS (
          SELECT ones.d + tens.d * 10 + hundreds.d * 100
            + thousands.d * 1000 + ten_thousands.d * 10000
          FROM digits AS ones
          CROSS JOIN digits AS tens
          CROSS JOIN digits AS hundreds
          CROSS JOIN digits AS thousands
          CROSS JOIN digits AS ten_thousands
        )
        INSERT INTO students (name, created_at, updated_at)
        SELECT printf('Scale %05d', n), 0, 0
        FROM numbers
        WHERE n BETWEEN 1 AND ${cohortSize}
      `);

    const rows = repos.evidence.tutorOverview();
    expect(rows).toHaveLength(cohortSize);
    expect(rows[0]).toMatchObject({
      student: { name: "Scale 00001" },
      sessionCount: 0,
      avgAttentionScore: null,
    });
    expect(rows.at(-1)).toMatchObject({ student: { name: "Scale 32767" } });
  }, 15_000);
});
