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
  pronunciationRetryRequiredCount: number;
}

interface TutorEvidenceAggregateRow {
  studentId: number;
  latestSessionAtMs: number;
  sessionCount: number;
  avgAttentionScore: number;
  totalReviewFlags: number;
  focusLossCount: number;
  cameraSnapshotCount: number;
  pronunciationAssessmentCount: number;
  pronunciationAverageScore: number | null;
  pronunciationFlagCount: number;
  pronunciationRetryRequiredCount: number;
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
  pronunciationRetryRequiredCount: number;
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
      const recentSessions = recentSessionSummaries({ studentId, limit: Math.max(0, limit) });
      const aggregate = db.$sqlite.prepare(STUDENT_EVIDENCE_OVERVIEW_SQL).get(studentId) as
        | TutorEvidenceAggregateRow
        | undefined;
      return {
        studentId,
        sessionCount: aggregate?.sessionCount ?? 0,
        avgAttentionScore: aggregate?.avgAttentionScore ?? null,
        totalReviewFlags: aggregate?.totalReviewFlags ?? 0,
        focusLossCount: aggregate?.focusLossCount ?? 0,
        cameraSnapshotCount: aggregate?.cameraSnapshotCount ?? 0,
        pronunciationAssessmentCount: aggregate?.pronunciationAssessmentCount ?? 0,
        pronunciationAverageScore: aggregate?.pronunciationAverageScore ?? null,
        pronunciationFlagCount: aggregate?.pronunciationFlagCount ?? 0,
        pronunciationRetryRequiredCount: aggregate?.pronunciationRetryRequiredCount ?? 0,
        latestSessionAt: aggregate ? new Date(aggregate.latestSessionAtMs) : null,
        recentSessions,
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

      // Keep this fan-out bounded to one aggregate row per active student. The
      // previous implementation selected every session and evidence event, then
      // built two unbounded `IN (...)` lists before reducing them in JavaScript.
      // Besides retaining the whole evidence history in memory, that failed once
      // a cohort crossed SQLite's bind-variable limit. This query reproduces the
      // per-session evidence score in SQL, then rolls those sessions up by their
      // active owner without any caller-generated parameter list.
      const aggregateRows = db.$sqlite
        .prepare(TUTOR_EVIDENCE_OVERVIEW_SQL)
        .all() as TutorEvidenceAggregateRow[];
      const aggregates = new Map(aggregateRows.map((row) => [row.studentId, row]));

      return studentRows.map((student) => {
        const row = aggregates.get(student.id);
        return {
          student,
          latestSessionAt: row ? new Date(row.latestSessionAtMs) : null,
          sessionCount: row?.sessionCount ?? 0,
          avgAttentionScore: row?.avgAttentionScore ?? null,
          totalReviewFlags: row?.totalReviewFlags ?? 0,
          focusLossCount: row?.focusLossCount ?? 0,
          cameraSnapshotCount: row?.cameraSnapshotCount ?? 0,
          pronunciationAssessmentCount: row?.pronunciationAssessmentCount ?? 0,
          pronunciationAverageScore: row?.pronunciationAverageScore ?? null,
          pronunciationFlagCount: row?.pronunciationFlagCount ?? 0,
          pronunciationRetryRequiredCount: row?.pronunciationRetryRequiredCount ?? 0,
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

/**
 * SQL equivalent of `summarizeSessionEvidence`, limited to the fields used by
 * evidence overview headlines. Metrics are first calculated per session because
 * attention penalties are capped per session; only then are they aggregated by
 * student. A session counts exactly when it has at least one evidence event.
 */
function evidenceOverviewSql(scopeSql: string): string {
  return `
  WITH session_components AS (
    SELECT
      ps.student_id AS student_id,
      ps.id AS session_id,
      ps.started_at AS started_at,
      SUM(CASE WHEN e.kind = 'window_focus_returned' THEN 1 ELSE 0 END) AS focus_loss_count,
      SUM(
        CASE WHEN e.kind = 'window_focus_returned'
          THEN max(0, coalesce(e.duration_ms, 0)) ELSE 0 END
      ) AS focus_loss_ms,
      SUM(CASE WHEN e.kind = 'document_visible' THEN 1 ELSE 0 END) AS document_hidden_count,
      SUM(
        CASE WHEN e.kind = 'document_visible'
          THEN max(0, coalesce(e.duration_ms, 0)) ELSE 0 END
      ) AS document_hidden_ms,
      SUM(CASE WHEN e.kind = 'guardrail_overlay_shown' THEN 1 ELSE 0 END) AS guardrail_count,
      SUM(CASE WHEN e.kind = 'camera_snapshot' THEN 1 ELSE 0 END) AS camera_snapshot_count,
      SUM(CASE WHEN e.kind = 'camera_unavailable' THEN 1 ELSE 0 END) AS camera_unavailable_count,
      SUM(
        CASE WHEN e.kind = 'answer_submitted'
          AND json_type(e.payload, '$.responseMs') IN ('integer', 'real')
          AND json_extract(e.payload, '$.responseMs') >= 60000
          THEN 1 ELSE 0 END
      ) AS slow_response_count,
      SUM(
        CASE WHEN e.kind = 'answer_submitted'
          AND json_type(e.payload, '$.responseMs') IN ('integer', 'real')
          AND json_extract(e.payload, '$.responseMs') > 0
          AND json_extract(e.payload, '$.responseMs') <= 900
          THEN 1 ELSE 0 END
      ) AS rapid_response_count,
      SUM(
        CASE WHEN e.kind = 'pronunciation_assessment'
          AND json_type(e.payload, '$.overallScore') IN ('integer', 'real')
          THEN 1 ELSE 0 END
      ) AS pronunciation_assessment_count,
      SUM(
        CASE WHEN e.kind = 'pronunciation_assessment'
          AND json_type(e.payload, '$.overallScore') IN ('integer', 'real')
          THEN json_extract(e.payload, '$.overallScore') ELSE 0 END
      ) AS pronunciation_score_total,
      SUM(
        CASE WHEN e.kind = 'pronunciation_assessment'
          AND json_type(e.payload, '$.overallScore') IN ('integer', 'real')
          AND (
            json_type(e.payload, '$.retryRequired') = 'true'
            OR json_extract(e.payload, '$.overallScore') < coalesce(
              CASE WHEN json_type(e.payload, '$.passingScore') IN ('integer', 'real')
                THEN json_extract(e.payload, '$.passingScore') END,
              65
            )
          )
          THEN 1 ELSE 0 END
      ) AS pronunciation_flag_count,
      SUM(
        CASE WHEN e.kind = 'pronunciation_assessment'
          AND json_type(e.payload, '$.overallScore') IN ('integer', 'real')
          AND json_type(e.payload, '$.retryRequired') = 'true'
          THEN 1 ELSE 0 END
      ) AS pronunciation_retry_required_count
    FROM practice_sessions AS ps
    INNER JOIN session_evidence_events AS e ON e.session_id = ps.id
    ${scopeSql}
    GROUP BY ps.student_id, ps.id, ps.started_at
  ),
  session_values AS (
    SELECT
      *,
      focus_loss_count + document_hidden_count + guardrail_count
        + slow_response_count + rapid_response_count + camera_unavailable_count
        + pronunciation_flag_count AS review_flag_count,
      CASE WHEN pronunciation_assessment_count = 0 THEN NULL
        ELSE round(pronunciation_score_total * 1.0 / pronunciation_assessment_count) END
        AS pronunciation_average_score,
      min(35, focus_loss_count * 8)
        + min(25, focus_loss_ms * 5.0 / 60000)
        + min(18, document_hidden_count * 5)
        + min(12, document_hidden_ms * 4.0 / 60000)
        + min(18, slow_response_count * 3)
        + min(12, rapid_response_count * 2)
        + min(10, guardrail_count * 4)
        + min(10, camera_unavailable_count * 5)
        + min(12, pronunciation_flag_count * 3) AS attention_penalty
    FROM session_components
  ),
  session_scores AS (
    SELECT
      *,
      max(0, min(100, round(100 - attention_penalty))) AS attention_score
    FROM session_values
  )
  SELECT
    student_id AS studentId,
    max(started_at) AS latestSessionAtMs,
    count(*) AS sessionCount,
    round(avg(attention_score)) AS avgAttentionScore,
    sum(review_flag_count) AS totalReviewFlags,
    sum(focus_loss_count) AS focusLossCount,
    sum(camera_snapshot_count) AS cameraSnapshotCount,
    sum(pronunciation_assessment_count) AS pronunciationAssessmentCount,
    CASE WHEN sum(pronunciation_assessment_count) = 0 THEN NULL
      ELSE round(
        sum(pronunciation_average_score * pronunciation_assessment_count) * 1.0
          / sum(pronunciation_assessment_count)
      ) END AS pronunciationAverageScore,
    sum(pronunciation_flag_count) AS pronunciationFlagCount,
    sum(pronunciation_retry_required_count) AS pronunciationRetryRequiredCount
  FROM session_scores
  GROUP BY student_id
`;
}

const TUTOR_EVIDENCE_OVERVIEW_SQL = evidenceOverviewSql(`
  INNER JOIN students AS s ON s.id = ps.student_id
  WHERE s.archived_at IS NULL
`);

const STUDENT_EVIDENCE_OVERVIEW_SQL = evidenceOverviewSql(`
  WHERE ps.student_id = ?
`);
