import type { SessionEvidenceEventKind } from "@/data/schema";

export type EvidenceAttentionBand = "steady" | "review" | "intervention";

export interface EvidenceEventLike {
  kind: SessionEvidenceEventKind;
  durationMs: number | null;
  payload: Record<string, unknown> | null;
}

export interface SessionEvidenceMetrics {
  answerCount: number;
  avgResponseMs: number | null;
  slowResponseCount: number;
  rapidResponseCount: number;
  focusLossCount: number;
  focusLossMs: number;
  guardrailCount: number;
  cameraSnapshotCount: number;
  cameraUnavailableCount: number;
  cameraConsentGranted: boolean;
  cameraConsentDeclined: boolean;
  attentionScore: number;
  attentionBand: EvidenceAttentionBand;
  reviewFlagCount: number;
}

const SLOW_RESPONSE_MS = 60_000;
const RAPID_RESPONSE_MS = 900;

export function summarizeSessionEvidence(
  events: ReadonlyArray<EvidenceEventLike>,
): SessionEvidenceMetrics {
  let answerCount = 0;
  let responseTotalMs = 0;
  let slowResponseCount = 0;
  let rapidResponseCount = 0;
  let focusLossCount = 0;
  let focusLossMs = 0;
  let guardrailCount = 0;
  let cameraSnapshotCount = 0;
  let cameraUnavailableCount = 0;
  let cameraConsentGranted = false;
  let cameraConsentDeclined = false;

  for (const event of events) {
    if (event.kind === "answer_submitted") {
      const responseMs = numericPayload(event.payload, "responseMs");
      if (responseMs !== null) {
        answerCount += 1;
        responseTotalMs += responseMs;
        if (responseMs >= SLOW_RESPONSE_MS) slowResponseCount += 1;
        if (responseMs > 0 && responseMs <= RAPID_RESPONSE_MS) rapidResponseCount += 1;
      }
    } else if (event.kind === "window_focus_returned") {
      focusLossCount += 1;
      focusLossMs += Math.max(0, event.durationMs ?? 0);
    } else if (event.kind === "guardrail_overlay_shown") {
      guardrailCount += 1;
    } else if (event.kind === "camera_snapshot") {
      cameraSnapshotCount += 1;
    } else if (event.kind === "camera_unavailable") {
      cameraUnavailableCount += 1;
    } else if (event.kind === "camera_consent_granted") {
      cameraConsentGranted = true;
    } else if (event.kind === "camera_consent_declined") {
      cameraConsentDeclined = true;
    }
  }

  const avgResponseMs = answerCount === 0 ? null : Math.round(responseTotalMs / answerCount);
  const focusMinutes = focusLossMs / 60_000;
  const reviewFlagCount =
    focusLossCount +
    guardrailCount +
    slowResponseCount +
    rapidResponseCount +
    cameraUnavailableCount;
  const penalty =
    Math.min(35, focusLossCount * 8) +
    Math.min(25, focusMinutes * 5) +
    Math.min(18, slowResponseCount * 3) +
    Math.min(12, rapidResponseCount * 2) +
    Math.min(10, guardrailCount * 4) +
    Math.min(10, cameraUnavailableCount * 5);
  const attentionScore = clampInt(100 - penalty, 0, 100);

  return {
    answerCount,
    avgResponseMs,
    slowResponseCount,
    rapidResponseCount,
    focusLossCount,
    focusLossMs: Math.round(focusLossMs),
    guardrailCount,
    cameraSnapshotCount,
    cameraUnavailableCount,
    cameraConsentGranted,
    cameraConsentDeclined,
    attentionScore,
    attentionBand:
      attentionScore >= 85 ? "steady" : attentionScore >= 65 ? "review" : "intervention",
    reviewFlagCount,
  };
}

function numericPayload(payload: Record<string, unknown> | null, key: string): number | null {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
