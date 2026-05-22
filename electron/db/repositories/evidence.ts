import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import {
  type PracticeMode,
  type SessionEvidenceEventKind,
  type SessionEvidenceSeverity,
  practiceSessions,
  sessionEvidenceEvents,
  students,
} from "../../../src/data/schema";
import type { SessionEvidenceEvent, Student } from "../../../src/data/types";
import {
  type SessionEvidenceMetrics,
  summarizeSessionEvidence,
} from "../../../src/modules/evidence";
import type { AppDatabase } from "../client";

export interface RecordEvidenceEventInput {
  studentId: number;
  sessionId: number;
  kind: SessionEvidenceEventKind;
  severity?: SessionEvidenceSeverity;
  durationMs?: number | null;
  payload?: Record<string, unknown> | null;
  occurredAt?: Date;
}

export interface SessionEvidenceSummaryRow {
  sessionId: number;
  studentId: number;
  mode: PracticeMode;
  startedAt: Date;
  endedAt: Date | null;
  eventCount: number;
  lastEventAt: Date | null;
  metrics: SessionEvidenceMetrics;
}

export interface SessionEvidenceSnapshotRow {
  id: number;
  occurredAt: Date;
  fileName: string | null;
  mimeType: string | null;
  bytes: number | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  included?: boolean;
  snapshotDataUrl?: string | null;
}

export interface TutorEvidenceOverviewRow {
  student: Student;
  latestSessionAt: Date | null;
  sessionCount: number;
  avgAttentionScore: number | null;
  totalReviewFlags: number;
  focusLossCount: number;
  cameraSnapshotCount: number;
  pronunciationAssessmentCount: number;
  pronunciationAverageScore: number | null;
  pronunciationFlagCount: number;
}

export interface StudentEvidenceOverview {
  studentId: number;
  sessionCount: number;
  avgAttentionScore: number | null;
  totalReviewFlags: number;
  focusLossCount: number;
  cameraSnapshotCount: number;
  pronunciationAssessmentCount: number;
  pronunciationAverageScore: number | null;
  pronunciationFlagCount: number;
  latestSessionAt: Date | null;
  recentSessions: SessionEvidenceSummaryRow[];
}

export interface StudentEvidenceTimeline {
  session: {
    id: number;
    studentId: number;
    mode: PracticeMode;
    startedAt: Date;
    endedAt: Date | null;
  };
  events: SessionEvidenceEvent[];
  metrics: SessionEvidenceMetrics;
  snapshots: SessionEvidenceSnapshotRow[];
}

export function createEvidenceRepository(db: AppDatabase) {
  const sessionSummariesFromRows = (
    sessionRows: Array<{
      id: number;
      studentId: number;
      mode: PracticeMode;
      startedAt: Date;
      endedAt: Date | null;
    }>,
    eventRows: SessionEvidenceEvent[],
  ): SessionEvidenceSummaryRow[] => {
    const bySession = new Map<number, SessionEvidenceEvent[]>();
    for (const event of eventRows) {
      const list = bySession.get(event.sessionId) ?? [];
      list.push(event);
      bySession.set(event.sessionId, list);
    }

    return sessionRows.map((session) => {
      const events = bySession.get(session.id) ?? [];
      const lastEventAt =
        events.length === 0
          ? null
          : events.reduce(
              (latest, event) =>
                latest.getTime() >= event.occurredAt.getTime() ? latest : event.occurredAt,
              events[0]?.occurredAt ?? session.startedAt,
            );
      return {
        sessionId: session.id,
        studentId: session.studentId,
        mode: session.mode,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        eventCount: events.length,
        lastEventAt,
        metrics: summarizeSessionEvidence(events),
      };
    });
  };

  const sessionEvents = (sessionIds: number[]): SessionEvidenceEvent[] => {
    if (sessionIds.length === 0) return [];
    return db
      .select()
      .from(sessionEvidenceEvents)
      .where(inArray(sessionEvidenceEvents.sessionId, sessionIds))
      .orderBy(asc(sessionEvidenceEvents.occurredAt), asc(sessionEvidenceEvents.id))
      .all();
  };

  const snapshotRows = (events: SessionEvidenceEvent[]): SessionEvidenceSnapshotRow[] =>
    events
      .filter((event) => event.kind === "camera_snapshot")
      .map((event) => {
        const payload = event.payload ?? {};
        return {
          id: event.id,
          occurredAt: event.occurredAt,
          fileName: stringPayload(payload, "fileName"),
          mimeType: stringPayload(payload, "mimeType"),
          bytes: numberPayload(payload, "bytes"),
          sha256: stringPayload(payload, "sha256"),
          width: numberPayload(payload, "width"),
          height: numberPayload(payload, "height"),
        };
      });

  const recentSessionSummaries = ({
    studentId,
    limit = 10,
    since,
    until,
  }: {
    studentId: number;
    limit?: number;
    since?: Date;
    until?: Date;
  }): SessionEvidenceSummaryRow[] => {
    const filters = [eq(practiceSessions.studentId, studentId)];
    if (since) filters.push(gte(practiceSessions.startedAt, since));
    if (until) filters.push(lte(practiceSessions.startedAt, until));
    const sessionRows = db
      .select({
        id: practiceSessions.id,
        studentId: practiceSessions.studentId,
        mode: practiceSessions.mode,
        startedAt: practiceSessions.startedAt,
        endedAt: practiceSessions.endedAt,
      })
      .from(practiceSessions)
      .where(and(...filters))
      .orderBy(desc(practiceSessions.startedAt), desc(practiceSessions.id))
      .limit(limit)
      .all();
    return sessionSummariesFromRows(sessionRows, sessionEvents(sessionRows.map((s) => s.id)));
  };

  return {
    recordEvent(input: RecordEvidenceEventInput): SessionEvidenceEvent {
      const row = db
        .insert(sessionEvidenceEvents)
        .values({
          studentId: input.studentId,
          sessionId: input.sessionId,
          kind: input.kind,
          severity: input.severity ?? "info",
          durationMs: input.durationMs ?? null,
          payload: input.payload ?? null,
          occurredAt: input.occurredAt ?? new Date(),
        })
        .returning()
        .get();
      if (!row) throw new Error("Failed to insert session_evidence_event");
      return row;
    },

    recordEvents(inputs: RecordEvidenceEventInput[]): SessionEvidenceEvent[] {
      if (inputs.length === 0) return [];
      return db.transaction((tx) =>
        inputs.map((input) => {
          const row = tx
            .insert(sessionEvidenceEvents)
            .values({
              studentId: input.studentId,
              sessionId: input.sessionId,
              kind: input.kind,
              severity: input.severity ?? "info",
              durationMs: input.durationMs ?? null,
              payload: input.payload ?? null,
              occurredAt: input.occurredAt ?? new Date(),
            })
            .returning()
            .get();
          if (!row) throw new Error("Failed to insert session_evidence_event");
          return row;
        }),
      );
    },

    sessionTimeline({ sessionId }: { sessionId: number }): StudentEvidenceTimeline | null {
      const session = db
        .select({
          id: practiceSessions.id,
          studentId: practiceSessions.studentId,
          mode: practiceSessions.mode,
          startedAt: practiceSessions.startedAt,
          endedAt: practiceSessions.endedAt,
        })
        .from(practiceSessions)
        .where(eq(practiceSessions.id, sessionId))
        .get();
      if (!session) return null;
      const events = sessionEvents([sessionId]);
      return {
        session,
        events,
        metrics: summarizeSessionEvidence(events),
        snapshots: snapshotRows(events),
      };
    },

    recentSessionSummaries,

    studentOverview({
      studentId,
      limit = 10,
    }: {
      studentId: number;
      limit?: number;
    }): StudentEvidenceOverview {
      const sessions = recentSessionSummaries({ studentId, limit: Math.max(limit, 500) });
      const scored = sessions.filter((s) => s.eventCount > 0);
      const avgAttentionScore =
        scored.length === 0
          ? null
          : Math.round(
              scored.reduce((sum, session) => sum + session.metrics.attentionScore, 0) /
                scored.length,
            );
      return {
        studentId,
        sessionCount: scored.length,
        avgAttentionScore,
        totalReviewFlags: scored.reduce((sum, s) => sum + s.metrics.reviewFlagCount, 0),
        focusLossCount: scored.reduce((sum, s) => sum + s.metrics.focusLossCount, 0),
        cameraSnapshotCount: scored.reduce((sum, s) => sum + s.metrics.cameraSnapshotCount, 0),
        pronunciationAssessmentCount: scored.reduce(
          (sum, s) => sum + s.metrics.pronunciationAssessmentCount,
          0,
        ),
        pronunciationAverageScore: pronunciationAverage(scored),
        pronunciationFlagCount: scored.reduce(
          (sum, s) => sum + s.metrics.pronunciationFlagCount,
          0,
        ),
        latestSessionAt: scored[0]?.startedAt ?? null,
        recentSessions: sessions.slice(0, limit),
      };
    },

    tutorOverview(): TutorEvidenceOverviewRow[] {
      const studentRows = db
        .select()
        .from(students)
        .where(isNull(students.archivedAt))
        .orderBy(asc(students.name), asc(students.id))
        .all();
      if (studentRows.length === 0) return [];

      const sessions = db
        .select({
          id: practiceSessions.id,
          studentId: practiceSessions.studentId,
          mode: practiceSessions.mode,
          startedAt: practiceSessions.startedAt,
          endedAt: practiceSessions.endedAt,
        })
        .from(practiceSessions)
        .where(
          inArray(
            practiceSessions.studentId,
            studentRows.map((s) => s.id),
          ),
        )
        .orderBy(desc(practiceSessions.startedAt), desc(practiceSessions.id))
        .all();
      const summaries = sessionSummariesFromRows(
        sessions,
        sessionEvents(sessions.map((s) => s.id)),
      );
      const byStudent = new Map<number, SessionEvidenceSummaryRow[]>();
      for (const summary of summaries) {
        const list = byStudent.get(summary.studentId) ?? [];
        list.push(summary);
        byStudent.set(summary.studentId, list);
      }

      return studentRows.map((student) => {
        const rows = (byStudent.get(student.id) ?? []).filter((row) => row.eventCount > 0);
        const avgAttentionScore =
          rows.length === 0
            ? null
            : Math.round(
                rows.reduce((sum, row) => sum + row.metrics.attentionScore, 0) / rows.length,
              );
        return {
          student,
          latestSessionAt: rows[0]?.startedAt ?? null,
          sessionCount: rows.length,
          avgAttentionScore,
          totalReviewFlags: rows.reduce((sum, row) => sum + row.metrics.reviewFlagCount, 0),
          focusLossCount: rows.reduce((sum, row) => sum + row.metrics.focusLossCount, 0),
          cameraSnapshotCount: rows.reduce((sum, row) => sum + row.metrics.cameraSnapshotCount, 0),
          pronunciationAssessmentCount: rows.reduce(
            (sum, row) => sum + row.metrics.pronunciationAssessmentCount,
            0,
          ),
          pronunciationAverageScore: pronunciationAverage(rows),
          pronunciationFlagCount: rows.reduce(
            (sum, row) => sum + row.metrics.pronunciationFlagCount,
            0,
          ),
        };
      });
    },
  };
}

export type EvidenceRepository = ReturnType<typeof createEvidenceRepository>;

function stringPayload(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberPayload(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pronunciationAverage(rows: SessionEvidenceSummaryRow[]): number | null {
  let scoreTotal = 0;
  let attemptTotal = 0;
  for (const row of rows) {
    const average = row.metrics.pronunciationAverageScore;
    const count = row.metrics.pronunciationAssessmentCount;
    if (typeof average !== "number" || count <= 0) continue;
    scoreTotal += average * count;
    attemptTotal += count;
  }
  if (attemptTotal === 0) return null;
  return Math.round(scoreTotal / attemptTotal);
}
