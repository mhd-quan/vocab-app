import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { AppGlyph, type AppGlyphName } from "@/ui/components/AppGlyph";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Modal } from "@/ui/components/Modal";
import { SplitView } from "@/ui/components/SplitView";
import { StudentHistoryImportButton } from "@/ui/components/StudentHistoryImportButton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

function RecordLauncher({
  title,
  detail,
  icon,
  open,
  onOpen,
}: {
  title: string;
  detail: string;
  icon: AppGlyphName;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
      className="ui-focus-ring group flex w-full items-center gap-3 rounded-none px-4 py-3 text-left transition-colors hover:bg-surface-2"
    >
      <AppGlyph name={icon} className="text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-app">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">{detail}</span>
      </span>
      <AppGlyph name="arrowRight" className="text-muted-2 group-hover:text-app" />
    </button>
  );
}

export function EvidenceRecord({ studentId }: { studentId: number }) {
  const [open, setOpen] = useState(false);
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const overviewQ = useQuery({
    queryKey: queryKeys.evidence.studentOverview(studentId),
    queryFn: () => api.evidence.studentOverview({ studentId, limit: 8 }),
    enabled: open && studentId > 0,
  });
  const overview = overviewQ.data ?? null;
  const effectiveSelectedSessionId =
    selectedSessionId !== null &&
    overview?.recentSessions.some((session) => session.sessionId === selectedSessionId)
      ? selectedSessionId
      : (overview?.recentSessions[0]?.sessionId ?? null);

  useEffect(() => {
    setSelectedSessionId((current) => {
      if (
        current !== null &&
        overview?.recentSessions.some((session) => session.sessionId === current)
      ) {
        return current;
      }
      return overview?.recentSessions[0]?.sessionId ?? null;
    });
  }, [overview?.recentSessions]);

  const exportReport = useMutation({
    mutationFn: () =>
      api.evidence.exportStudentReport({
        studentId,
        includeSnapshots,
        passphrase: passphrase.trim() || undefined,
      }),
  });

  const historyTransfer = (
    <section
      className="mt-6 border-t border-border-subtle pt-4"
      aria-labelledby="history-transfer-title"
    >
      <h3 id="history-transfer-title" className="text-sm font-semibold text-app">
        History transfer
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted">
        Export this learner’s complete record or import a compatible history file.
      </p>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        <span className="font-medium text-muted-2">Export passphrase</span>
        <input
          type="password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.currentTarget.value)}
          placeholder="Optional AES export key"
          className="ui-focus-ring h-9 rounded-control border border-border-subtle bg-surface-1 px-3 text-sm text-app outline-none focus:border-accent"
        />
      </label>
      <label className="mt-3 flex min-h-9 items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={includeSnapshots}
          onChange={(event) => setIncludeSnapshots(event.currentTarget.checked)}
          className="h-4 w-4 accent-[rgb(var(--color-accent))]"
        />
        Include camera snapshots
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => exportReport.mutate()} disabled={exportReport.isPending}>
          {exportReport.isPending ? "Exporting…" : "Export history"}
        </Button>
        <StudentHistoryImportButton />
      </div>
      {exportReport.data && !exportReport.data.canceled ? (
        <p role="status" className="mt-2 text-xs text-success">
          Full student data exported{exportReport.data.encrypted ? " encrypted" : ""}.
        </p>
      ) : null}
      {exportReport.isError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {exportReport.error instanceof Error
            ? exportReport.error.message
            : "Could not export report."}
        </p>
      ) : null}
    </section>
  );

  return (
    <>
      <RecordLauncher
        title="Session evidence"
        detail={
          open && overviewQ.isLoading
            ? "Loading session record…"
            : overviewQ.data
              ? overviewQ.data.sessionCount === 0
                ? "No logged sessions"
                : `${overviewQ.data.sessionCount} session${overviewQ.data.sessionCount === 1 ? "" : "s"} · ${overviewQ.data.totalReviewFlags} review flag${overviewQ.data.totalReviewFlags === 1 ? "" : "s"}`
              : "Review sessions, flags, and attachments"
        }
        icon="content"
        open={open}
        onOpen={() => setOpen(true)}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Session evidence"
        description="Select a session on the left; inspect its complete record on the right."
        size="lg"
      >
        {overviewQ.isLoading ? (
          <p role="status" className="py-8 text-center text-sm text-muted">
            Loading session record…
          </p>
        ) : overviewQ.isError ? (
          <div role="alert" className="py-8 text-center">
            <p className="text-sm font-medium text-app">Session evidence is unavailable</p>
            <p className="mt-1 text-xs text-muted">No learner record has been changed.</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => overviewQ.refetch()}
            >
              Retry
            </Button>
            {historyTransfer}
          </div>
        ) : !overview || overview.sessionCount === 0 ? (
          <div>
            <EmptyState
              title="No evidence logs yet"
              body="Student sessions will appear here after the learner starts a practice round."
            />
            {historyTransfer}
          </div>
        ) : (
          <div className="flex h-[min(65vh,42rem)] min-h-[28rem] flex-col gap-3">
            <dl className="grid shrink-0 grid-cols-4 gap-px overflow-hidden rounded-control bg-border-subtle">
              <EvidenceStat
                label="Attention"
                value={overview.avgAttentionScore === null ? "—" : overview.avgAttentionScore}
                tone={
                  overview.avgAttentionScore === null
                    ? "neutral"
                    : attentionScoreTone(overview.avgAttentionScore)
                }
              />
              <EvidenceStat label="Flags" value={overview.totalReviewFlags} tone="warning" />
              <EvidenceStat label="Focus breaks" value={overview.focusLossCount} tone="warning" />
              <EvidenceStat label="Camera" value={overview.cameraSnapshotCount} tone="success" />
            </dl>

            <SplitView
              initialSize={210}
              minSize={180}
              maxSize={250}
              contentMinSize={300}
              label="Resize session index"
              storageKey={`tutor.student.${studentId}.evidence-split`}
              className="min-h-0 flex-1 overflow-hidden rounded-object border border-border-subtle"
            >
              <nav
                aria-label="Session evidence index"
                className="h-full overflow-y-auto bg-surface-2/45"
              >
                {overview.recentSessions.map((session) => (
                  <button
                    key={session.sessionId}
                    type="button"
                    aria-pressed={effectiveSelectedSessionId === session.sessionId}
                    onClick={() => setSelectedSessionId(session.sessionId)}
                    className={cn(
                      "ui-focus-ring w-full border-b border-border-subtle px-3 py-3 text-left transition-colors last:border-b-0",
                      effectiveSelectedSessionId === session.sessionId
                        ? "bg-surface-3/60"
                        : "hover:bg-surface-2",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-app">{session.mode}</span>
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          evidenceToneClass(attentionScoreTone(session.metrics.attentionScore)),
                        )}
                      >
                        {session.metrics.attentionScore}
                      </span>
                    </span>
                    <time
                      dateTime={session.startedAt.toISOString()}
                      className="mt-1 block text-[11px] text-muted"
                    >
                      {formatDate(session.startedAt)}
                    </time>
                    <span className="mt-1.5 block text-[11px] text-muted-2">
                      {session.metrics.answerCount} answers · {session.metrics.reviewFlagCount}{" "}
                      flags
                    </span>
                  </button>
                ))}
              </nav>

              <section aria-label="Selected session detail" className="h-full overflow-y-auto p-5">
                {effectiveSelectedSessionId !== null ? (
                  <SessionDetailPanel
                    key={effectiveSelectedSessionId}
                    sessionId={effectiveSelectedSessionId}
                  />
                ) : (
                  <p className="text-sm text-muted">Select a session to inspect its record.</p>
                )}
                <PronunciationEvidencePanel overview={overview} loading={false} />
                {historyTransfer}
              </section>
            </SplitView>
          </div>
        )}
      </Modal>
    </>
  );
}

function PronunciationEvidencePanel({
  overview,
  loading,
}: {
  overview: {
    pronunciationAssessmentCount?: number;
    pronunciationAverageScore?: number | null;
    pronunciationFlagCount?: number;
    pronunciationRetryRequiredCount?: number;
    recentSessions: Array<{
      sessionId: number;
      startedAt: Date;
      metrics: {
        pronunciationAssessmentCount?: number;
        pronunciationAverageScore?: number | null;
        pronunciationFlagCount?: number;
        pronunciationRetryRequiredCount?: number;
      };
    }>;
  } | null;
  loading: boolean;
}) {
  const attemptCount = overview?.pronunciationAssessmentCount ?? 0;
  const sessions = (overview?.recentSessions ?? []).filter(
    (session) => (session.metrics.pronunciationAssessmentCount ?? 0) > 0,
  );

  if (loading) {
    return (
      <section
        className="mt-6 border-t border-border-subtle pt-4"
        aria-labelledby="pronunciation-evidence-title"
      >
        <h3 id="pronunciation-evidence-title" className="text-sm font-semibold text-app">
          Pronunciation record
        </h3>
        <p role="status" className="mt-3 text-xs text-muted">
          Loading pronunciation evidence…
        </p>
      </section>
    );
  }

  if (!overview || attemptCount === 0) return null;

  return (
    <section
      className="mt-6 border-t border-border-subtle pt-4"
      aria-labelledby="pronunciation-evidence-title"
    >
      <h3 id="pronunciation-evidence-title" className="text-sm font-semibold text-app">
        Pronunciation record
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted">
        Scores from computer-assisted pronunciation sessions.
      </p>
      <div>
        <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-control bg-border-subtle">
          <EvidenceStat
            label="Avg score"
            value={overview.pronunciationAverageScore ?? "—"}
            tone={
              overview.pronunciationAverageScore === null ||
              overview.pronunciationAverageScore === undefined
                ? "neutral"
                : attentionScoreTone(overview.pronunciationAverageScore)
            }
          />
          <EvidenceStat label="Attempts" value={attemptCount} tone="accent" />
          <EvidenceStat
            label="Retries"
            value={overview.pronunciationRetryRequiredCount ?? overview.pronunciationFlagCount ?? 0}
            tone={
              (overview.pronunciationRetryRequiredCount ?? overview.pronunciationFlagCount ?? 0) > 0
                ? "warning"
                : "success"
            }
          />
        </dl>
        {sessions.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted">Recent pronunciation sessions</h4>
            <ul className="mt-2 divide-y divide-border-subtle">
              {sessions.slice(0, 6).map((session) => (
                <li
                  key={session.sessionId}
                  className="flex items-center justify-between gap-3 py-2 text-xs"
                >
                  <time dateTime={session.startedAt.toISOString()} className="text-muted">
                    {formatDate(session.startedAt)}
                  </time>
                  <span className="text-right tabular-nums text-muted-2">
                    <span className="font-medium text-app">
                      {session.metrics.pronunciationAverageScore ?? "—"}
                    </span>
                    {` · ${session.metrics.pronunciationAssessmentCount ?? 0} attempts`}
                    {(session.metrics.pronunciationRetryRequiredCount ??
                      session.metrics.pronunciationFlagCount ??
                      0) > 0
                      ? ` · ${
                          session.metrics.pronunciationRetryRequiredCount ??
                          session.metrics.pronunciationFlagCount
                        } retries`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EvidenceStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "success" | "warning" | "accent";
}) {
  return (
    <div className="bg-surface-1 px-3 py-2.5">
      <dt className="text-[11px] font-medium text-muted">{label}</dt>
      <dd className={cn("mt-1 text-lg font-semibold tabular-nums", evidenceToneClass(tone))}>
        {value}
      </dd>
    </div>
  );
}

function EvidenceMiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-2">{label}</dt>
      <dd className="mt-1 text-xs tabular-nums text-app">{value}</dd>
    </div>
  );
}

function SessionDetailPanel({ sessionId }: { sessionId: number }) {
  const [loadAttachments, setLoadAttachments] = useState(false);
  const timelineQ = useQuery({
    queryKey: queryKeys.evidence.sessionTimeline(sessionId, false),
    queryFn: () => api.evidence.sessionTimeline({ sessionId, includeSnapshots: false }),
  });
  const attachmentsQ = useQuery({
    queryKey: queryKeys.evidence.sessionTimeline(sessionId, true),
    queryFn: () => api.evidence.sessionTimeline({ sessionId, includeSnapshots: true }),
    enabled: loadAttachments,
  });
  const reportQ = useQuery({
    queryKey: queryKeys.progress.sessionReport(sessionId),
    queryFn: () => api.progress.sessionReport({ sessionId }),
  });

  const timeline = timelineQ.data;
  const report = reportQ.data;
  const metrics = timeline?.metrics;

  if (timelineQ.isLoading && reportQ.isLoading) {
    return <p className="text-xs text-muted">Loading session detail…</p>;
  }

  const session = timeline?.session ?? report?.session;
  if (!session) {
    return (
      <div className="space-y-3">
        <SessionSliceState
          title="Answer report"
          loading={reportQ.isLoading}
          onRetry={() => void reportQ.refetch()}
        />
        <SessionSliceState
          title="Session signals"
          loading={timelineQ.isLoading}
          onRetry={() => void timelineQ.refetch()}
        />
      </div>
    );
  }
  const endedAt = session.endedAt ?? timeline?.events.at(-1)?.occurredAt ?? session.startedAt;

  return (
    <section>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="muted">Session {session.id}</Badge>
            {metrics ? (
              <Badge tone={attentionScoreTone(metrics.attentionScore)}>
                Attention {metrics.attentionScore}
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 text-base font-semibold text-app">
            {formatDate(session.startedAt)} - {formatDate(endedAt)}
          </h3>
          <p className="mt-1 text-xs text-muted">
            Duration {formatMs(Math.max(0, endedAt.getTime() - session.startedAt.getTime()))}
          </p>
        </div>
        {report ? (
          <Badge tone={report.accuracy === null ? "muted" : accuracyTone(report.accuracy)}>
            {report.accuracy === null ? "No answers" : `${Math.round(report.accuracy * 100)}%`}
          </Badge>
        ) : null}
      </header>

      {reportQ.isLoading ? (
        <p role="status" className="mt-4 text-xs text-muted">
          Loading answer report…
        </p>
      ) : report ? (
        <>
          <dl className="grouped-list mt-4 grid sm:grid-cols-3 sm:divide-x sm:divide-border-subtle">
            <EvidenceStat label="Answered" value={report.totalAnswered} tone="accent" />
            <EvidenceStat label="Correct" value={report.totalCorrect} tone="success" />
            <EvidenceStat
              label="Avg response"
              value={report.avgResponseMs === null ? "—" : formatMs(report.avgResponseMs)}
              tone="accent"
            />
          </dl>
          {report.units.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {report.units.map((unit) => (
                <Badge key={unit.unitId} tone={accuracyTone(unit.accuracy)}>
                  {unit.unitCode} {Math.round(unit.accuracy * 100)}%
                </Badge>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <SessionSliceState
          title="Answer report"
          onRetry={() => void reportQ.refetch()}
          className="mt-4"
        />
      )}

      {timelineQ.isLoading ? (
        <p role="status" className="mt-4 text-xs text-muted">
          Loading session signals…
        </p>
      ) : metrics ? (
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-5">
          <EvidenceMiniStat label="Review flags" value={metrics.reviewFlagCount} />
          <EvidenceMiniStat
            label="Focus breaks"
            value={`${metrics.focusLossCount} / ${formatMs(metrics.focusLossMs)}`}
          />
          <EvidenceMiniStat
            label="Hidden"
            value={`${metrics.documentHiddenCount} / ${formatMs(metrics.documentHiddenMs)}`}
          />
          <EvidenceMiniStat label="Guardrails" value={metrics.guardrailCount} />
          <EvidenceMiniStat label="Camera" value={metrics.cameraSnapshotCount} />
        </dl>
      ) : (
        <SessionSliceState
          title="Session signals"
          onRetry={() => void timelineQ.refetch()}
          className="mt-4"
        />
      )}

      {(metrics?.cameraSnapshotCount ?? 0) > 0 ? (
        <section
          className="mt-5 border-t border-border-subtle pt-4"
          aria-labelledby="camera-attachments-title"
        >
          <h4 id="camera-attachments-title" className="text-sm font-semibold text-app">
            Camera attachments
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted">
            Image data stays unloaded until you request it for this session.
          </p>
          {!loadAttachments ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => setLoadAttachments(true)}
            >
              Load camera attachments ({metrics?.cameraSnapshotCount ?? 0})
            </Button>
          ) : attachmentsQ.isFetching ? (
            <p role="status" className="mt-3 text-xs text-muted">
              Loading camera attachments…
            </p>
          ) : attachmentsQ.isError ? (
            <div role="alert" className="mt-3">
              <p className="text-xs text-warning">Camera attachments are unavailable.</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => attachmentsQ.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <SnapshotTable snapshots={attachmentsQ.data?.snapshots ?? []} />
          )}
        </section>
      ) : null}
    </section>
  );
}

function SessionSliceState({
  title,
  loading = false,
  onRetry,
  className,
}: {
  title: string;
  loading?: boolean;
  onRetry: () => void;
  className?: string;
}) {
  if (loading) {
    return (
      <p role="status" className={cn("text-xs text-muted", className)}>
        Loading {title.toLowerCase()}…
      </p>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex items-center justify-between gap-3 rounded-control bg-warning/8 px-3 py-2",
        className,
      )}
    >
      <p className="text-xs text-warning">{title} is unavailable.</p>
      <Button
        size="sm"
        variant="secondary"
        aria-label={`Retry ${title.toLowerCase()}`}
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}

function SnapshotTable({
  snapshots,
}: {
  snapshots: Array<{
    id: number;
    occurredAt: Date;
    fileName: string | null;
    bytes: number | null;
    sha256: string | null;
    width: number | null;
    height: number | null;
    snapshotDataUrl?: string | null;
  }>;
}) {
  const [zoomed, setZoomed] = useState<(typeof snapshots)[number] | null>(null);

  if (snapshots.length === 0) {
    return <p className="mt-4 text-xs text-muted-2">No camera snapshots for this session.</p>;
  }

  return (
    <>
      <div className="grouped-list mt-5 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-2 text-muted-2">
            <tr>
              <th className="px-3 py-2 font-medium">Image</th>
              <th className="px-3 py-2 font-medium">Captured</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="px-3 py-2 font-medium">Hash</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id} className="border-t border-border-subtle">
                <td className="px-3 py-2">
                  {snapshot.snapshotDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setZoomed(snapshot)}
                      aria-label={`Open camera snapshot captured ${formatDate(snapshot.occurredAt)}`}
                      className="ui-focus-ring group relative block rounded-control"
                    >
                      <img
                        src={snapshot.snapshotDataUrl}
                        alt={`Camera snapshot captured ${formatDate(snapshot.occurredAt)}`}
                        className="h-16 w-24 rounded-control border border-border-subtle object-cover"
                      />
                      <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-control bg-slate-950/0 text-[10px] font-semibold text-white opacity-0 transition group-hover:bg-slate-950/45 group-hover:opacity-100">
                        Zoom
                      </span>
                    </button>
                  ) : (
                    <span className="text-muted-2">{snapshot.fileName ?? "stored"}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{formatDate(snapshot.occurredAt)}</td>
                <td className="px-3 py-2 tabular-nums text-muted">
                  {snapshot.width && snapshot.height ? `${snapshot.width}x${snapshot.height}` : "—"}
                  {snapshot.bytes ? ` / ${formatBytes(snapshot.bytes)}` : ""}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-2">
                  {snapshot.sha256 ? snapshot.sha256.slice(0, 12) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={zoomed !== null}
        onClose={() => setZoomed(null)}
        title="Camera snapshot"
        description={
          zoomed
            ? `${formatDate(zoomed.occurredAt)} · ${zoomed.width ?? "?"}x${zoomed.height ?? "?"}`
            : undefined
        }
      >
        {zoomed?.snapshotDataUrl ? (
          <img
            src={zoomed.snapshotDataUrl}
            alt={`Camera snapshot captured ${formatDate(zoomed.occurredAt)}`}
            className="max-h-[70vh] w-full rounded-object border border-border-subtle object-contain"
          />
        ) : null}
      </Modal>
    </>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function attentionScoreTone(score: number): "success" | "accent" | "warning" {
  if (score >= 85) return "success";
  if (score >= 65) return "accent";
  return "warning";
}

function accuracyTone(score: number): "success" | "accent" | "warning" {
  if (score >= 0.8) return "success";
  if (score >= 0.5) return "accent";
  return "warning";
}

function evidenceToneClass(tone: "neutral" | "success" | "warning" | "accent"): string {
  switch (tone) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "accent":
      return "text-accent";
    case "neutral":
      return "text-muted";
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
