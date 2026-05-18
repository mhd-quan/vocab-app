import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { type HeatmapCell, bucketByDay } from "@/modules/analytics";
import { type AchievementDefinition, getAchievement } from "@/modules/rewards";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Heatmap } from "@/ui/components/Heatmap";
import { PageHeader } from "@/ui/components/PageHeader";
import { AchievementIcon } from "@/ui/components/rewards";
import { TutorMetricCard, TutorPanel, TutorSelectField } from "@/ui/tutor/components/Material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const HEATMAP_DAYS = 90;

/**
 * Per-student analytics drill-down. Every panel reads its own narrow
 * IPC slice — `tutor_overview` already gives the table on Dashboard
 * the rolled-up totals, so we don't reuse it here. That keeps each
 * query's invalidation surface minimal and the page resilient if any
 * one panel fails.
 */
export function TutorStudentDetail() {
  const { studentId } = useParams({ from: "/tutor/students/$studentId" });
  const id = Number(studentId);

  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(id),
    queryFn: () => api.students.getById({ id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const queryClient = useQueryClient();

  const summaryQ = useQuery({
    queryKey: queryKeys.progress.summary(id),
    queryFn: () => api.progress.studentSummary({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const streakQ = useQuery({
    queryKey: queryKeys.rewards.streak(id),
    queryFn: () => api.rewards.streak({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const unlockedQ = useQuery({
    queryKey: queryKeys.rewards.listUnlocked(id),
    queryFn: () => api.rewards.listUnlocked({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const weakQ = useQuery({
    queryKey: queryKeys.progress.weakItems(id),
    queryFn: () => api.progress.weakItems({ studentId: id, minAttempts: 3, limit: 10 }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const recentQ = useQuery({
    queryKey: queryKeys.progress.recentSessions(id),
    queryFn: () => api.progress.recentSessions({ studentId: id, limit: 10 }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const unitReportQ = useQuery({
    queryKey: queryKeys.progress.unitReport(id),
    queryFn: () => api.progress.unitReport({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const evidenceQ = useQuery({
    queryKey: queryKeys.evidence.studentOverview(id),
    queryFn: () => api.evidence.studentOverview({ studentId: id, limit: 8 }),
    enabled: Number.isFinite(id) && id > 0,
  });

  // Daily-activity is fetched once per (studentId, days) pair. The cells
  // we hand to Heatmap are derived locally so the same IPC payload also
  // feeds any future widget (sparklines, weekly totals).
  const activityQ = useQuery({
    queryKey: queryKeys.progress.dailyActivity(id, HEATMAP_DAYS),
    queryFn: () => {
      const now = new Date();
      const since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      since.setDate(since.getDate() - (HEATMAP_DAYS - 1));
      return api.progress.dailyActivity({
        studentId: id,
        sinceIso: since.toISOString(),
        untilIso: now.toISOString(),
      });
    },
    enabled: Number.isFinite(id) && id > 0,
  });

  const heatmapCells = useMemo<HeatmapCell[]>(() => {
    if (!activityQ.data) return [];
    // Re-derive from raw timestamps so we get the intensity scaling
    // for free; we expand each day's count into N timestamps so
    // bucketByDay can do a single pass.
    const timestamps: Date[] = [];
    for (const cell of activityQ.data) {
      for (let i = 0; i < cell.count; i += 1) timestamps.push(cell.bucketStart);
    }
    return bucketByDay({ eventTimestamps: timestamps, now: new Date(), days: HEATMAP_DAYS });
  }, [activityQ.data]);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="px-8 py-10">
        <p className="text-sm text-danger">Invalid student id.</p>
        <Link to="/tutor/students" className="mt-2 inline-block text-xs text-muted hover:text-app">
          ← Back to students
        </Link>
      </div>
    );
  }

  const student = studentQ.data;
  const summary = summaryQ.data;
  const streak = streakQ.data;
  const accuracyPct =
    summary && summary.totalCorrect + summary.totalWrong > 0
      ? Math.round(summary.accuracy * 100)
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Student"
        title={
          student?.displayName ?? student?.name ?? (studentQ.isLoading ? "Loading…" : "Unknown")
        }
        subtitle="Per-student analytics: practice activity, weak words, recent sessions, achievements."
        actions={
          <Link to="/tutor/students" className="text-xs text-muted hover:text-app">
            All students
          </Link>
        }
      />

      <div className="flex flex-col gap-6 px-8 py-6">
        <section className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <TutorPanel className="flex items-center gap-4 p-6">
            <Avatar
              name={student?.displayName ?? student?.name ?? "?"}
              avatarSeed={student?.avatarSeed ?? null}
              color={student?.color ?? null}
              size="lg"
            />
            <div>
              <p className="text-xs font-semibold uppercase text-focus">Profile</p>
              <p className="mt-1 text-sm text-muted">
                {streak?.practicedToday ? "Practised today" : "Ready for practice"}
              </p>
            </div>
          </TutorPanel>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Seen" value={summary?.totalSeen ?? 0} tone="xp" />
            <Stat label="Due" value={summary?.totalDue ?? 0} tone="warning" />
            <Stat
              label="Accuracy"
              value={accuracyPct === null ? "—" : `${accuracyPct}%`}
              tone={accuracyPct !== null && accuracyPct >= 80 ? "success" : "accent"}
            />
            <Stat
              label="Streak"
              value={streak?.currentStreak ? `${streak.currentStreak}d` : "—"}
              tone={streak?.currentStreak ? "mastery" : "neutral"}
            />
          </dl>
        </section>

        <AssignmentsPanel studentId={id} queryClient={queryClient} />

        <Heatmap
          cells={heatmapCells}
          title="Practice activity"
          caption={`Last ${HEATMAP_DAYS} days`}
        />

        <UnitReportPanel
          studentId={id}
          rows={unitReportQ.data ?? []}
          loading={unitReportQ.isLoading}
        />

        <EvidencePanel
          studentId={id}
          overview={evidenceQ.data ?? null}
          loading={evidenceQ.isLoading}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WeakWordsPanel rows={weakQ.data ?? []} loading={weakQ.isLoading} />
          <RecentSessionsPanel rows={recentQ.data ?? []} loading={recentQ.isLoading} />
        </div>

        <AchievementsPanel
          ids={(unlockedQ.data ?? []).map((u) => u.achievementId)}
          loading={unlockedQ.isLoading}
        />
      </div>
    </>
  );
}

function AssignmentsPanel({
  studentId,
  queryClient,
}: {
  studentId: number;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [bookId, setBookId] = useState<number | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<number>>(() => new Set());

  const booksQ = useQuery({
    queryKey: queryKeys.curriculum.books(),
    queryFn: () => api.curriculum.listBooks(),
  });
  const books = booksQ.data ?? [];

  useEffect(() => {
    if (bookId === null && books.length > 0) setBookId(books[0]?.id ?? null);
  }, [bookId, books]);

  const unitsQ = useQuery({
    queryKey: bookId ? queryKeys.curriculum.units(bookId) : ["curriculum", "units", "none"],
    queryFn: () => api.curriculum.listUnitsByBook({ bookId: bookId ?? 0 }),
    enabled: bookId !== null,
  });

  const assignedQ = useQuery({
    queryKey:
      bookId !== null
        ? queryKeys.students.assignedUnitIds(studentId, bookId)
        : queryKeys.students.assignedUnitIds(studentId),
    queryFn: () => api.students.listAssignedUnitIds({ studentId, bookId: bookId ?? undefined }),
    enabled: Number.isFinite(studentId) && studentId > 0 && bookId !== null,
  });

  useEffect(() => {
    if (assignedQ.data) setSelectedUnitIds(new Set(assignedQ.data));
  }, [assignedQ.data]);

  const saveAssignments = useMutation({
    mutationFn: () =>
      api.students.replaceUnitAssignments({
        studentId,
        bookId: bookId ?? 0,
        unitIds: [...selectedUnitIds],
      }),
    onSuccess: async () => {
      if (bookId === null) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.students.assignedBooks(studentId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.students.assignedUnits(studentId, bookId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.students.assignedUnitIds(studentId, bookId),
        }),
      ]);
    },
  });

  const units = unitsQ.data ?? [];

  const toggle = (unitId: number) => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  return (
    <Panel title="Assignments" caption="Control what the student can see" tone="mastery">
      {booksQ.isLoading ? (
        <p className="text-xs text-muted">Loading books…</p>
      ) : books.length === 0 ? (
        <EmptyState
          title="No books imported"
          body="Import at least one book before assigning units to students."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TutorSelectField
              label="Book"
              value={String(bookId ?? "")}
              options={books.map((book) => ({ value: String(book.id), label: book.title }))}
              onChange={(value) => setBookId(Number(value))}
              containerClassName="sm:min-w-72"
            />
            <Button
              onClick={() => saveAssignments.mutate()}
              disabled={bookId === null || saveAssignments.isPending}
            >
              {saveAssignments.isPending ? "Saving…" : "Save assignments"}
            </Button>
          </div>

          {unitsQ.isLoading || assignedQ.isLoading ? (
            <p className="text-xs text-muted">Loading units…</p>
          ) : units.length === 0 ? (
            <p className="text-xs text-muted-2">This book has no imported units yet.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {units.map((unit) => {
                const checked = selectedUnitIds.has(unit.id);
                return (
                  <li key={unit.id}>
                    <label
                      className={cn(
                        "flex min-h-24 cursor-pointer flex-col gap-2 rounded-2xl border p-3 transition",
                        checked
                          ? "border-mastery/50 bg-mastery/10 shadow-[var(--md-sys-elevation-1)]"
                          : "border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] hover:border-border-strong hover:bg-[color:var(--md-sys-color-surface-container-high)]",
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(unit.id)}
                            className="h-4 w-4 accent-[rgb(var(--color-mastery))]"
                          />
                          <span className="font-mono text-[11px] text-muted-2">{unit.code}</span>
                        </span>
                        <Badge tone={checked ? "mastery" : "muted"} uppercase>
                          {checked ? "Assigned" : "Locked"}
                        </Badge>
                      </span>
                      <span className="line-clamp-2 text-sm font-medium text-app">
                        {unit.title}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {saveAssignments.isSuccess ? (
            <p className="text-xs text-success">Assignments saved.</p>
          ) : null}
          {saveAssignments.isError ? (
            <p
              role="alert"
              className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-5 text-danger"
            >
              {formatAssignmentSaveError(saveAssignments.error)}
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

function formatAssignmentSaveError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("No handler registered") &&
    message.includes("students.replaceUnitAssignments")
  ) {
    return "Assignment saving is unavailable in this running app process. Restart the app once so the latest tutor handlers load, then try again.";
  }
  return message || "Could not save assignments.";
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "accent" | "success" | "warning" | "xp" | "mastery";
}) {
  return (
    <TutorMetricCard
      label={label}
      value={value}
      tone={
        tone === "mastery"
          ? "tertiary"
          : tone === "warning"
            ? "warning"
            : tone === "success"
              ? "success"
              : "primary"
      }
      className="min-h-28 p-4"
    />
  );
}

function UnitReportPanel({
  studentId,
  rows,
  loading,
}: {
  studentId: number;
  rows: Array<{
    unitId: number;
    unitCode: string;
    unitTitle: string;
    bookTitle: string;
    sessionCount: number;
    totalAnswered: number;
    totalCorrect: number;
    accuracy: number;
    avgResponseMs: number | null;
    lastPracticedAt: Date | null;
  }>;
  loading: boolean;
}) {
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedUnitId !== null) return;
    if (rows[0]) setSelectedUnitId(rows[0].unitId);
  }, [rows, selectedUnitId]);

  const selectedUnit = rows.find((row) => row.unitId === selectedUnitId) ?? null;
  const unitSessionsQ = useQuery({
    queryKey:
      selectedUnitId === null
        ? ["progress", "unitSessions", studentId, "none"]
        : queryKeys.progress.unitSessions(studentId, selectedUnitId),
    queryFn: () => api.progress.unitSessions({ studentId, unitId: selectedUnitId ?? 0, limit: 20 }),
    enabled: selectedUnitId !== null,
  });

  return (
    <Panel title="Unit report" caption="Select a unit to inspect its learning sessions.">
      {loading ? (
        <p className="text-xs text-muted">Loading units…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No unit attempts yet"
          body="Unit rows appear after the student answers vocabulary or grammar items."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-2xl border border-border-subtle">
            <table className="w-full text-left text-xs">
              <thead className="bg-[color:var(--md-sys-color-surface-container-low)] uppercase text-muted-2">
                <tr>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Sessions</th>
                  <th className="px-3 py-2 font-medium">Accuracy</th>
                  <th className="px-3 py-2 font-medium">Avg time</th>
                  <th className="px-3 py-2 font-medium">Last</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.unitId}
                    className={cn(
                      "border-t border-border-subtle transition-colors",
                      selectedUnitId === row.unitId
                        ? "bg-accent/10"
                        : "hover:bg-[color:var(--md-sys-color-surface-container-low)]",
                    )}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedUnitId(row.unitId)}
                        className="flex flex-col text-left"
                      >
                        <span className="font-medium text-app">
                          {row.unitCode}: {row.unitTitle}
                        </span>
                        <span className="text-[10px] text-muted-2">{row.bookTitle}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-muted">{row.sessionCount}</td>
                    <td className="px-3 py-2">
                      <Badge tone={accuracyTone(row.accuracy)} uppercase>
                        {Math.round(row.accuracy * 100)}%
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-muted">
                      {row.avgResponseMs === null ? "—" : formatMs(row.avgResponseMs)}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {row.lastPracticedAt ? formatDate(row.lastPracticedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] p-4">
            {selectedUnit ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="focus" uppercase>
                    {selectedUnit.unitCode}
                  </Badge>
                  <Badge tone={accuracyTone(selectedUnit.accuracy)} uppercase>
                    {Math.round(selectedUnit.accuracy * 100)}%
                  </Badge>
                </div>
                <h3 className="mt-3 text-base font-semibold text-app">{selectedUnit.unitTitle}</h3>
                <dl className="mt-4 grid grid-cols-3 gap-2">
                  <EvidenceMiniStat label="Answered" value={selectedUnit.totalAnswered} />
                  <EvidenceMiniStat label="Correct" value={selectedUnit.totalCorrect} />
                  <EvidenceMiniStat
                    label="Avg response"
                    value={
                      selectedUnit.avgResponseMs === null
                        ? "—"
                        : formatMs(selectedUnit.avgResponseMs)
                    }
                  />
                </dl>
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase text-muted-2">
                    Unit sessions
                  </p>
                  {unitSessionsQ.isLoading ? (
                    <p className="text-xs text-muted">Loading sessions…</p>
                  ) : (unitSessionsQ.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-2">No sessions found for this unit.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {(unitSessionsQ.data ?? []).map((session) => (
                        <li
                          key={session.sessionId}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-0 px-3 py-2 text-xs"
                        >
                          <span className="flex items-center gap-2">
                            <Badge tone="muted" uppercase>
                              {session.mode}
                            </Badge>
                            <span className="text-muted">{formatDate(session.startedAt)}</span>
                          </span>
                          <span className="font-mono text-muted">
                            {session.totalCorrect}/{session.totalAnswered}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </Panel>
  );
}

function EvidencePanel({
  studentId,
  overview,
  loading,
}: {
  studentId: number;
  overview: {
    sessionCount: number;
    avgAttentionScore: number | null;
    totalReviewFlags: number;
    focusLossCount: number;
    cameraSnapshotCount: number;
    recentSessions: Array<{
      sessionId: number;
      mode: string;
      startedAt: Date;
      eventCount: number;
      metrics: {
        attentionScore: number;
        answerCount: number;
        avgResponseMs: number | null;
        focusLossCount: number;
        focusLossMs: number;
        cameraSnapshotCount: number;
        reviewFlagCount: number;
      };
    }>;
  } | null;
  loading: boolean;
}) {
  const [includeSnapshots, setIncludeSnapshots] = useState(true);
  const [passphrase, setPassphrase] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedSessionId !== null) return;
    const first = overview?.recentSessions[0];
    if (first) setSelectedSessionId(first.sessionId);
  }, [overview?.recentSessions, selectedSessionId]);

  const exportReport = useMutation({
    mutationFn: () =>
      api.evidence.exportStudentReport({
        studentId,
        includeSnapshots,
        passphrase: passphrase.trim() || undefined,
      }),
  });

  return (
    <Panel
      title="Session evidence"
      caption="Timing, focus breaks, consented camera check-ins, and encrypted report export"
    >
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : !overview || overview.sessionCount === 0 ? (
        <EmptyState
          title="No evidence logs yet"
          body="Student sessions will appear here after the learner starts a practice round."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid gap-3 sm:grid-cols-4">
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
            <EvidenceStat
              label="Camera checks"
              value={overview.cameraSnapshotCount}
              tone="success"
            />
          </dl>

          <ul className="grid gap-2 lg:grid-cols-2">
            {overview.recentSessions.map((session) => (
              <li key={session.sessionId}>
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(session.sessionId)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-colors",
                    selectedSessionId === session.sessionId
                      ? "border-accent/50 bg-accent/10"
                      : "border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] hover:border-border-strong",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Badge tone="muted" uppercase>
                        {session.mode}
                      </Badge>
                      <span className="text-xs text-muted">{formatDate(session.startedAt)}</span>
                    </span>
                    <Badge tone={attentionScoreTone(session.metrics.attentionScore)} uppercase>
                      {session.metrics.attentionScore}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <EvidenceMiniStat
                      label="Avg response"
                      value={
                        session.metrics.avgResponseMs === null
                          ? "—"
                          : formatMs(session.metrics.avgResponseMs)
                      }
                    />
                    <EvidenceMiniStat
                      label="Focus"
                      value={`${session.metrics.focusLossCount} / ${formatMs(
                        session.metrics.focusLossMs,
                      )}`}
                    />
                    <EvidenceMiniStat label="Camera" value={session.metrics.cameraSnapshotCount} />
                  </dl>
                </button>
              </li>
            ))}
          </ul>

          {selectedSessionId !== null ? <SessionDetailPanel sessionId={selectedSessionId} /> : null}

          <div className="rounded-2xl border border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="flex flex-col gap-1 text-xs text-muted">
                <span className="font-semibold uppercase text-muted-2">Report passphrase</span>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.currentTarget.value)}
                  placeholder="Optional AES export key"
                  className="h-10 rounded-xl border border-border-subtle bg-surface-0 px-3 text-sm text-app outline-none focus:border-accent"
                />
              </label>
              <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-0 px-3 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={includeSnapshots}
                  onChange={(event) => setIncludeSnapshots(event.currentTarget.checked)}
                  className="h-4 w-4 accent-[rgb(var(--color-accent))]"
                />
                Include camera snapshots
              </label>
              <Button onClick={() => exportReport.mutate()} disabled={exportReport.isPending}>
                {exportReport.isPending ? "Exporting…" : "Export report"}
              </Button>
            </div>
            {exportReport.data && !exportReport.data.canceled ? (
              <p className="mt-2 text-xs text-success">
                Report exported{exportReport.data.encrypted ? " encrypted" : ""}.
              </p>
            ) : null}
            {exportReport.isError ? (
              <p className="mt-2 text-xs text-danger">
                {exportReport.error instanceof Error
                  ? exportReport.error.message
                  : "Could not export report."}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </Panel>
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
    <div className="rounded-2xl border border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] p-3">
      <p className="text-[10px] font-semibold uppercase text-muted-2">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl", evidenceToneClass(tone))}>{value}</p>
    </div>
  );
}

function EvidenceMiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-muted-2">{label}</dt>
      <dd className="mt-1 font-mono text-xs text-app">{value}</dd>
    </div>
  );
}

function SessionDetailPanel({ sessionId }: { sessionId: number }) {
  const timelineQ = useQuery({
    queryKey: queryKeys.evidence.sessionTimeline(sessionId, true),
    queryFn: () => api.evidence.sessionTimeline({ sessionId, includeSnapshots: true }),
  });
  const reportQ = useQuery({
    queryKey: queryKeys.progress.sessionReport(sessionId),
    queryFn: () => api.progress.sessionReport({ sessionId }),
  });

  const timeline = timelineQ.data;
  const report = reportQ.data;
  const metrics = timeline?.metrics;

  if (timelineQ.isLoading || reportQ.isLoading) {
    return <p className="text-xs text-muted">Loading session detail…</p>;
  }

  if (!timeline && !report) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] p-4 text-xs text-muted">
        Session detail is unavailable.
      </div>
    );
  }

  const session = timeline?.session ?? report?.session;
  if (!session) return null;
  const endedAt = session.endedAt ?? timeline?.events.at(-1)?.occurredAt ?? session.startedAt;
  const accuracy = report?.accuracy ?? null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="muted" uppercase>
              Session {session.id}
            </Badge>
            {metrics ? (
              <Badge tone={attentionScoreTone(metrics.attentionScore)} uppercase>
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
        <Badge tone={accuracy === null ? "muted" : accuracyTone(accuracy)} uppercase>
          {accuracy === null ? "No answers" : `${Math.round(accuracy * 100)}%`}
        </Badge>
      </header>

      <dl className="mt-4 grid gap-3 sm:grid-cols-4">
        <EvidenceStat label="Answered" value={report?.totalAnswered ?? 0} tone="accent" />
        <EvidenceStat label="Correct" value={report?.totalCorrect ?? 0} tone="success" />
        <EvidenceStat
          label="Avg response"
          value={
            report?.avgResponseMs === null || report?.avgResponseMs === undefined
              ? "—"
              : formatMs(report.avgResponseMs)
          }
          tone="accent"
        />
        <EvidenceStat
          label="Review flags"
          value={metrics?.reviewFlagCount ?? 0}
          tone={(metrics?.reviewFlagCount ?? 0) > 0 ? "warning" : "success"}
        />
      </dl>

      {metrics ? (
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
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
      ) : null}

      {report?.units.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {report.units.map((unit) => (
            <Badge key={unit.unitId} tone={accuracyTone(unit.accuracy)} uppercase>
              {unit.unitCode} {Math.round(unit.accuracy * 100)}%
            </Badge>
          ))}
        </div>
      ) : null}

      <SnapshotTable snapshots={timeline?.snapshots ?? []} />
    </section>
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
  if (snapshots.length === 0) {
    return <p className="mt-4 text-xs text-muted-2">No camera snapshots for this session.</p>;
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-border-subtle">
      <table className="w-full text-left text-xs">
        <thead className="bg-[color:var(--md-sys-color-surface-container)] uppercase text-muted-2">
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
                  <img
                    src={snapshot.snapshotDataUrl}
                    alt=""
                    className="h-16 w-24 rounded-lg border border-border-subtle object-cover"
                  />
                ) : (
                  <span className="text-muted-2">{snapshot.fileName ?? "stored"}</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted">{formatDate(snapshot.occurredAt)}</td>
              <td className="px-3 py-2 font-mono text-muted">
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
  );
}

function WeakWordsPanel({
  rows,
  loading,
}: {
  rows: Array<{
    entryId: number;
    headword: string;
    pos: string;
    accuracy: number;
    totalCorrect: number;
    totalWrong: number;
    bookId: number;
  }>;
  loading: boolean;
}) {
  return (
    <Panel title="Weak words" caption="Lowest accuracy first · ≥ 3 attempts">
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No weak spots yet"
          body="Once a student answers a few words at least three times, the trickiest ones surface here."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.entryId}>
              <Link
                to="/tutor/content"
                search={{ entry: row.entryId, book: row.bookId }}
                className="flex items-center justify-between rounded-2xl border border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] px-3 py-2.5 text-sm transition-colors hover:border-accent/50 hover:bg-[color:var(--md-sys-color-surface-container-high)]"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-medium text-app">{row.headword}</span>
                  <span className="font-mono text-[10px] text-muted-2">{row.pos}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Badge tone="warning" uppercase>
                    {Math.round(row.accuracy * 100)}%
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-2">
                    {row.totalCorrect}/{row.totalCorrect + row.totalWrong}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecentSessionsPanel({
  rows,
  loading,
}: {
  rows: Array<{
    sessionId: number;
    mode: string;
    startedAt: Date;
    endedAt: Date | null;
    totalAnswered: number;
    totalCorrect: number;
  }>;
  loading: boolean;
}) {
  return (
    <Panel title="Recent sessions" caption="Last 10">
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          body="Student practice sessions show up here once the learner picks a lesson."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => {
            const accuracy =
              row.totalAnswered === 0
                ? null
                : Math.round((row.totalCorrect / row.totalAnswered) * 100);
            return (
              <li
                key={row.sessionId}
                className="flex items-center justify-between rounded-2xl border border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] px-3 py-2.5 text-sm"
              >
                <span className="flex items-baseline gap-2">
                  <Badge tone="muted" uppercase>
                    {row.mode}
                  </Badge>
                  <span className="text-xs text-muted">{formatDate(row.startedAt)}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-mono text-[10px] text-muted-2">
                    {row.totalCorrect}/{row.totalAnswered}
                  </span>
                  {accuracy !== null ? (
                    <Badge
                      tone={accuracy >= 80 ? "success" : accuracy >= 50 ? "accent" : "warning"}
                      uppercase
                    >
                      {accuracy}%
                    </Badge>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function AchievementsPanel({ ids, loading }: { ids: string[]; loading: boolean }) {
  const defs = ids
    .map((id) => getAchievement(id))
    .filter((d): d is AchievementDefinition => d !== null);
  return (
    <Panel title="Achievements" caption={`${defs.length} unlocked`} tone="mastery">
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : defs.length === 0 ? (
        <p className="text-xs text-muted-2">
          Nothing unlocked yet — encourage a session in student mode.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {defs.map((def) => (
            <li
              key={def.id}
              className="flex items-center gap-2 rounded-full border border-mastery/40 bg-mastery/10 px-3 py-1.5 text-xs text-mastery"
              title={def.description}
            >
              <AchievementIcon icon={def.icon} className="h-4 w-4" />
              <span className="font-medium text-app">{def.title}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Panel({
  title,
  caption,
  tone = "neutral",
  children,
}: {
  title: string;
  caption?: string;
  tone?: "neutral" | "mastery";
  children: React.ReactNode;
}) {
  return (
    <TutorPanel
      title={title}
      description={caption}
      className={tone === "mastery" ? "border-mastery/30 bg-mastery/10" : undefined}
    >
      {children}
    </TutorPanel>
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
