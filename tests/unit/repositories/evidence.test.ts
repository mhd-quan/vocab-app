import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { practiceSessions, sessionEvidenceEvents } from "../../../src/data/schema";
import { freshDb } from "../../helpers";

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
});
