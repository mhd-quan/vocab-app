import { api } from "@/lib/api";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

const CAMERA_INTERVAL_MS = 5 * 60 * 1000;

type CameraState = "idle" | "enabled" | "declined" | "unavailable";

interface FocusGuard {
  durationMs: number;
}

export interface EvidenceAnswerInput {
  exerciseId: string;
  kind: string;
  responseMs: number;
  correct: boolean;
  currentSessionRun: number;
}

export function useSessionEvidence({
  studentId,
  sessionId,
  contextLabel,
}: {
  studentId: number;
  sessionId: number | null;
  contextLabel?: string;
}) {
  const active = sessionId !== null;
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraSnapshotCount, setCameraSnapshotCount] = useState(0);
  const [focusGuard, setFocusGuard] = useState<FocusGuard | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const focusLostAt = useRef<number | null>(null);
  const visibilityLostAt = useRef<number | null>(null);
  const noticeSessionRef = useRef<number | null>(null);
  const sessionKey = sessionId ?? -1;

  const recordEvent = useCallback(
    async (input: {
      kind: Parameters<typeof api.evidence.recordEvent>[0]["kind"];
      severity?: Parameters<typeof api.evidence.recordEvent>[0]["severity"];
      durationMs?: number | null;
      payload?: Record<string, unknown> | null;
    }) => {
      if (!active || sessionId === null) return;
      try {
        await api.evidence.recordEvent({
          studentId,
          sessionId,
          kind: input.kind,
          severity: input.severity,
          durationMs: input.durationMs,
          payload: input.payload,
          occurredAtIso: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[SessionEvidence] recordEvent failed", err);
      }
    },
    [active, sessionId, studentId],
  );

  useEffect(() => {
    if (!active || sessionId === null || noticeSessionRef.current === sessionId) return;
    noticeSessionRef.current = sessionId;
    void recordEvent({
      kind: "session_notice_shown",
      severity: "system",
      payload: {
        contextLabel: contextLabel ?? null,
        appVersion: api.app.version,
        platform: api.app.platform,
        cameraIntervalMs: CAMERA_INTERVAL_MS,
        contentProtection: true,
      },
    });
  }, [active, contextLabel, recordEvent, sessionId]);

  useEffect(() => {
    if (!active) return;

    const markFocusLost = () => {
      if (focusLostAt.current !== null) return;
      focusLostAt.current = Date.now();
      void recordEvent({ kind: "window_focus_lost", severity: "attention" });
    };

    const markFocusReturned = () => {
      if (focusLostAt.current === null) return;
      const durationMs = Date.now() - focusLostAt.current;
      focusLostAt.current = null;
      void recordEvent({
        kind: "window_focus_returned",
        severity: durationMs >= 10_000 ? "integrity" : "attention",
        durationMs,
      });
      setFocusGuard({ durationMs });
      void recordEvent({
        kind: "guardrail_overlay_shown",
        severity: durationMs >= 10_000 ? "integrity" : "attention",
        durationMs,
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        visibilityLostAt.current = Date.now();
        void recordEvent({ kind: "document_hidden", severity: "attention" });
        return;
      }
      if (visibilityLostAt.current === null) return;
      const durationMs = Date.now() - visibilityLostAt.current;
      visibilityLostAt.current = null;
      void recordEvent({ kind: "document_visible", severity: "attention", durationMs });
    };

    window.addEventListener("blur", markFocusLost);
    window.addEventListener("focus", markFocusReturned);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", markFocusLost);
      window.removeEventListener("focus", markFocusReturned);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, recordEvent]);

  const captureSnapshot = useCallback(async () => {
    if (!active || sessionId === null) return;
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(640, video.videoWidth);
    canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);

    try {
      await api.evidence.recordCameraSnapshot({
        studentId,
        sessionId,
        dataUrl,
        capturedAtIso: new Date().toISOString(),
        intervalMs: CAMERA_INTERVAL_MS,
        width: canvas.width,
        height: canvas.height,
      });
      setCameraSnapshotCount((count) => count + 1);
    } catch (err) {
      console.error("[SessionEvidence] camera snapshot failed", err);
      setCameraState("unavailable");
      void recordEvent({
        kind: "camera_unavailable",
        severity: "system",
        payload: { reason: "snapshot_failed" },
      });
    }
  }, [active, recordEvent, sessionId, studentId]);

  const stopCamera = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    videoRef.current = null;
  }, []);

  const enableCamera = useCallback(async () => {
    if (!active || sessionId === null || cameraState === "enabled") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      void recordEvent({
        kind: "camera_unavailable",
        severity: "system",
        payload: { reason: "media_devices_unavailable" },
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
        audio: false,
      });
      stopCamera();
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      streamRef.current = stream;
      videoRef.current = video;
      await video.play();
      setCameraState("enabled");
      void recordEvent({
        kind: "camera_consent_granted",
        severity: "system",
        payload: { intervalMs: CAMERA_INTERVAL_MS, visibleIndicator: true },
      });
      window.setTimeout(() => void captureSnapshot(), 1_500);
      intervalRef.current = window.setInterval(() => void captureSnapshot(), CAMERA_INTERVAL_MS);
    } catch (err) {
      setCameraState("unavailable");
      void recordEvent({
        kind: "camera_unavailable",
        severity: "system",
        payload: {
          reason: err instanceof Error ? err.name : "permission_or_device_error",
        },
      });
    }
  }, [active, cameraState, captureSnapshot, recordEvent, sessionId, stopCamera]);

  const declineCamera = useCallback(() => {
    if (!active) return;
    setCameraState("declined");
    void recordEvent({ kind: "camera_consent_declined", severity: "system" });
  }, [active, recordEvent]);

  const dismissFocusGuard = useCallback(() => {
    const durationMs = focusGuard?.durationMs ?? null;
    setFocusGuard(null);
    void recordEvent({
      kind: "guardrail_overlay_dismissed",
      severity: "attention",
      durationMs,
    });
  }, [focusGuard?.durationMs, recordEvent]);

  const recordAnswerEvidence = useCallback(
    (answer: EvidenceAnswerInput) => {
      void recordEvent({
        kind: "answer_submitted",
        severity: "info",
        durationMs: answer.responseMs,
        payload: {
          exerciseId: answer.exerciseId,
          exerciseKind: answer.kind,
          responseMs: answer.responseMs,
          correct: answer.correct,
          currentSessionRun: answer.currentSessionRun,
        },
      });
    },
    [recordEvent],
  );

  useEffect(() => stopCamera, [stopCamera]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: evidence state must reset when the practice session row changes.
  useEffect(() => {
    setCameraState("idle");
    setCameraSnapshotCount(0);
    setFocusGuard(null);
    stopCamera();
  }, [sessionKey, stopCamera]);

  return {
    active,
    cameraState,
    cameraSnapshotCount,
    focusGuard,
    enableCamera,
    declineCamera,
    dismissFocusGuard,
    recordAnswerEvidence,
  };
}

export type SessionEvidenceMonitor = ReturnType<typeof useSessionEvidence>;

export function SessionEvidenceFrame({
  monitor,
  children,
}: {
  monitor: SessionEvidenceMonitor;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-full w-full min-w-0">
      {monitor.active ? <EvidenceBanner monitor={monitor} /> : null}
      {children}
      {monitor.focusGuard ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-surface-0/80 px-6 backdrop-blur-md">
          <div className="max-w-md rounded-bento border border-warning/35 bg-surface-1 p-6 text-center shadow-lift">
            <Badge tone="warning" uppercase>
              Focus break recorded
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold text-app">Return to the session</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The app was out of focus for {formatDuration(monitor.focusGuard.durationMs)}.
            </p>
            <Button className="mt-5" onClick={monitor.dismissFocusGuard}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceBanner({ monitor }: { monitor: SessionEvidenceMonitor }) {
  return (
    <div className="fixed left-1/2 top-3 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-border-subtle bg-surface-0/95 px-4 py-2 text-xs text-muted shadow-card backdrop-blur">
      <span className="font-semibold text-app">Session evidence</span>
      <span>Timing + focus active</span>
      <CameraStatus monitor={monitor} />
    </div>
  );
}

function CameraStatus({ monitor }: { monitor: SessionEvidenceMonitor }) {
  if (monitor.cameraState === "enabled") {
    return (
      <span className="inline-flex items-center gap-2 text-success">
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
        Camera check-ins {monitor.cameraSnapshotCount}
      </span>
    );
  }

  if (monitor.cameraState === "declined") {
    return <span className="text-muted-2">Camera skipped</span>;
  }

  if (monitor.cameraState === "unavailable") {
    return <span className="text-warning">Camera unavailable</span>;
  }

  return (
    <span className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={monitor.enableCamera}>
        Enable camera
      </Button>
      <Button size="sm" variant="ghost" onClick={monitor.declineCamera}>
        Skip
      </Button>
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return "under 1s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
