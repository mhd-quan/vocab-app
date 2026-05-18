import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { students } from "./learner";
import { practiceSessions } from "./progress";

export const sessionEvidenceEventKinds = [
  "session_notice_shown",
  "camera_consent_granted",
  "camera_consent_declined",
  "camera_unavailable",
  "camera_snapshot",
  "window_focus_lost",
  "window_focus_returned",
  "document_hidden",
  "document_visible",
  "guardrail_overlay_shown",
  "guardrail_overlay_dismissed",
  "answer_submitted",
] as const;
export type SessionEvidenceEventKind = (typeof sessionEvidenceEventKinds)[number];

export const sessionEvidenceSeverities = ["info", "attention", "integrity", "system"] as const;
export type SessionEvidenceSeverity = (typeof sessionEvidenceSeverities)[number];

/**
 * Append-only session evidence stream. This deliberately sits beside
 * `learning_events`: learning events remain the academic source of truth,
 * while evidence events capture timing, focus and consented camera check-ins.
 */
export const sessionEvidenceEvents = sqliteTable(
  "session_evidence_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SessionEvidenceEventKind>().notNull(),
    severity: text("severity").$type<SessionEvidenceSeverity>().notNull().default("info"),
    durationMs: integer("duration_ms"),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    sessionIdx: index("session_evidence_events_session_idx").on(t.sessionId, t.occurredAt),
    studentOccurredIdx: index("session_evidence_events_student_occurred_idx").on(
      t.studentId,
      t.occurredAt,
    ),
    kindIdx: index("session_evidence_events_kind_idx").on(t.kind),
  }),
);
