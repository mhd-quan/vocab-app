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
import { Modal } from "@/ui/components/Modal";
import { PageHeader } from "@/ui/components/PageHeader";
import { StudentHistoryImportButton } from "@/ui/components/StudentHistoryImportButton";
import { AchievementIcon } from "@/ui/components/rewards";
import { TutorPanel, TutorSelectField } from "@/ui/tutor/components/Material";
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
  const cadence = useMemo(() => computeCadence(activityQ.data ?? []), [activityQ.data]);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm font-medium text-danger">Invalid student id.</p>
        <Link
          to="/tutor/students"
          className="ui-focus-ring mt-3 inline-flex rounded-control text-sm text-accent"
        >
          Return to students
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
        title={
          student?.displayName ?? student?.name ?? (studentQ.isLoading ? "Loading…" : "Unknown")
        }
        subtitle={
          summaryQ.isLoading || streakQ.isLoading
            ? "Loading the learner record…"
            : summaryQ.isError || streakQ.isError
              ? "The current learning summary is temporarily unavailable."
              : describeStudentState(summary, streak?.practicedToday ?? false, accuracyPct)
        }
      />

      <div className="flex max-w-[90rem] flex-col gap-5 px-6 pb-10">
        <section className="object-surface learning-trace overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-4">
            <Avatar
              name={student?.displayName ?? student?.name ?? "?"}
              avatarSeed={student?.avatarSeed ?? null}
              color={student?.color ?? null}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-app">Current study state</p>
              <p className="mt-0.5 text-xs text-muted">
                {streakQ.isLoading
                  ? "Loading today’s activity…"
                  : streakQ.isError
                    ? "Today’s activity is unavailable"
                    : streak?.practicedToday
                      ? "Practised today"
                      : "No practice recorded today"}
              </p>
              {student?.notes ? (
                <p className="mt-1 line-clamp-2 max-w-3xl text-xs text-muted-2">{student.notes}</p>
              ) : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 border-t border-border-subtle sm:grid-cols-4 sm:divide-x sm:divide-border-subtle">
            <SummaryMetric
              label="Seen"
              value={summaryQ.isLoading || summaryQ.isError ? "—" : (summary?.totalSeen ?? 0)}
            />
            <SummaryMetric
              label="Due"
              value={summaryQ.isLoading || summaryQ.isError ? "—" : (summary?.totalDue ?? 0)}
              tone={(summary?.totalDue ?? 0) > 0 ? "warning" : "neutral"}
            />
            <SummaryMetric
              label="Accuracy"
              value={
                summaryQ.isLoading || summaryQ.isError || accuracyPct === null
                  ? "—"
                  : `${accuracyPct}%`
              }
              tone={accuracyPct !== null && accuracyPct >= 80 ? "success" : "neutral"}
            />
            <SummaryMetric
              label="Streak"
              value={
                streakQ.isLoading || streakQ.isError
                  ? "—"
                  : streak?.currentStreak
                    ? `${streak.currentStreak}d`
                    : "0d"
              }
              tone={streak?.currentStreak ? "success" : "neutral"}
            />
          </dl>
        </section>

        {activityQ.isLoading ? (
          <TutorPanel
            title="Practice activity"
            description={`Last ${HEATMAP_DAYS} days`}
            className="p-5"
          >
            <p role="status" className="text-xs text-muted">
              Loading activity…
            </p>
          </TutorPanel>
        ) : activityQ.isError ? (
          <DataUnavailable title="Practice activity" onRetry={() => activityQ.refetch()} />
        ) : (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Heatmap
              cells={heatmapCells}
              title="Practice activity"
              caption={`Last ${HEATMAP_DAYS} days`}
              density="roomy"
            />
            <CadencePanel cadence={cadence} loading={false} />
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {weakQ.isError ? (
            <DataUnavailable title="Weak words" onRetry={() => weakQ.refetch()} />
          ) : (
            <WeakWordsPanel rows={weakQ.data ?? []} loading={weakQ.isLoading} />
          )}
          {recentQ.isError ? (
            <DataUnavailable title="Recent sessions" onRetry={() => recentQ.refetch()} />
          ) : (
            <RecentSessionsPanel rows={recentQ.data ?? []} loading={recentQ.isLoading} />
          )}
        </div>

        {unitReportQ.isError ? (
          <DataUnavailable title="Unit report" onRetry={() => unitReportQ.refetch()} />
        ) : (
          <UnitReportPanel
            studentId={id}
            rows={unitReportQ.data ?? []}
            loading={unitReportQ.isLoading}
          />
        )}

        <AssignmentsPanel studentId={id} queryClient={queryClient} />

        {evidenceQ.isError ? (
          <DataUnavailable title="Session evidence" onRetry={() => evidenceQ.refetch()} />
        ) : (
          <>
            <EvidencePanel
              studentId={id}
              overview={evidenceQ.data ?? null}
              loading={evidenceQ.isLoading}
            />
            <PronunciationEvidencePanel
              overview={evidenceQ.data ?? null}
              loading={evidenceQ.isLoading}
            />
          </>
        )}

        {unlockedQ.isError ? (
          <DataUnavailable title="Achievements" onRetry={() => unlockedQ.refetch()} />
        ) : (
          <AchievementsPanel
            ids={(unlockedQ.data ?? []).map((u) => u.achievementId)}
            loading={unlockedQ.isLoading}
          />
        )}
      </div>
    </>
  );
}

function DataUnavailable({ title, onRetry }: { title: string; onRetry: () => unknown }) {
  return (
    <TutorPanel title={title} className="p-5">
      <div role="alert">
        <p className="text-sm font-medium text-app">Data is temporarily unavailable</p>
        <p className="mt-1 text-xs text-muted">No learner record has been changed.</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </TutorPanel>
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
    <Panel title="Assignments" caption="Choose the units available in this learner's study path.">
      {booksQ.isLoading ? (
        <p className="text-xs text-muted">Loading books…</p>
      ) : booksQ.isError ? (
        <p role="alert" className="text-xs text-warning">
          Books are temporarily unavailable.
        </p>
      ) : books.length === 0 ? (
        <EmptyState
          title="No books imported"
          body="Import at least one book before assigning units to students."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
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
          ) : unitsQ.isError || assignedQ.isError ? (
            <p role="alert" className="text-xs text-warning">
              Unit assignments are temporarily unavailable.
            </p>
          ) : units.length === 0 ? (
            <p className="text-xs text-muted-2">This book has no imported units yet.</p>
          ) : (
            <ul className="grouped-list max-h-80 divide-y divide-border-subtle overflow-y-auto">
              {units.map((unit) => {
                const checked = selectedUnitIds.has(unit.id);
                return (
                  <li key={unit.id}>
                    <label
                      className={cn(
                        "flex min-h-[var(--size-row)] cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                        checked ? "bg-success/8" : "hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(unit.id)}
                        className="h-4 w-4 shrink-0 accent-[rgb(var(--color-accent))]"
                      />
                      <span className="w-12 shrink-0 text-[11px] font-medium tabular-nums text-muted-2">
                        {unit.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-app">
                        {unit.title}
                      </span>
                      <span className={checked ? "text-xs text-success" : "text-xs text-muted-2"}>
                        {checked ? "Assigned" : "Not assigned"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {saveAssignments.isSuccess ? (
            <p role="status" className="text-xs text-success">
              Assignments saved.
            </p>
          ) : null}
          {saveAssignments.isError ? (
            <p
              role="alert"
              className="border-l-2 border-danger bg-danger/8 px-3 py-2 text-xs leading-5 text-danger"
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

function SummaryMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div className="border-t border-border-subtle px-4 py-3 [&:nth-child(-n+2)]:border-t-0 sm:border-t-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums text-app",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

interface CadenceStats {
  thisWeek: number;
  previousWeek: number;
  deltaPct: number | null;
  weeklyAverage: number;
  activeDays: number;
  activeDayAverage: number;
}

function CadencePanel({ cadence, loading }: { cadence: CadenceStats; loading: boolean }) {
  return (
    <TutorPanel
      title="Pace & cadence"
      description="Practice volume from the same activity window."
      className="p-5"
    >
      {loading ? (
        <p className="text-xs text-muted">Loading cadence...</p>
      ) : (
        <dl className="grouped-list divide-y divide-border-subtle">
          <CadenceMetric
            label="This week"
            value={`${cadence.thisWeek} reps`}
            hint={formatDelta(cadence.deltaPct)}
            tone={cadence.deltaPct !== null && cadence.deltaPct < 0 ? "warning" : "success"}
          />
          <CadenceMetric
            label="Weekly pace"
            value={`${cadence.weeklyAverage}/week`}
            hint={`${cadence.activeDays} active days in view`}
            tone="accent"
          />
          <CadenceMetric
            label="Active-day average"
            value={`${cadence.activeDayAverage}/day`}
            hint="Average review load on days with practice"
            tone="neutral"
          />
        </dl>
      )}
    </TutorPanel>
  );
}

function CadenceMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "accent" | "success" | "warning";
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2.5">
      <dt className="text-xs font-medium text-app">{label}</dt>
      <dd
        className={cn(
          "text-sm font-semibold tabular-nums text-app",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </dd>
      <p className="col-span-2 mt-1 text-[11px] leading-4 text-muted">{hint}</p>
    </div>
  );
}

function computeCadence(rows: Array<{ bucketStart: Date; count: number }>): CadenceStats {
  const sorted = [...rows].sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());
  const last7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);
  const thisWeek = sumCounts(last7);
  const previousWeek = sumCounts(prev7);
  const total = sumCounts(sorted);
  const weekCount = Math.max(1, Math.ceil(sorted.length / 7));
  const activeDays = sorted.filter((row) => row.count > 0).length;
  return {
    thisWeek,
    previousWeek,
    deltaPct:
      previousWeek > 0 ? Math.round(((thisWeek - previousWeek) / previousWeek) * 100) : null,
    weeklyAverage: Math.round(total / weekCount),
    activeDays,
    activeDayAverage: activeDays > 0 ? Math.round(total / activeDays) : 0,
  };
}

function sumCounts(rows: Array<{ count: number }>): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

function formatDelta(deltaPct: number | null): string {
  if (deltaPct === null) return "No previous-week baseline yet";
  if (deltaPct === 0) return "No change vs previous 7 days";
  return `${deltaPct > 0 ? "+" : ""}${deltaPct}% vs previous 7 days`;
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
        <div className="grid overflow-hidden rounded-object bg-surface-1 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted-2">
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
                      selectedUnitId === row.unitId ? "bg-accent/10" : "hover:bg-surface-2",
                    )}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        aria-pressed={selectedUnitId === row.unitId}
                        onClick={() => setSelectedUnitId(row.unitId)}
                        className="ui-focus-ring flex rounded-control text-left"
                      >
                        <span className="font-medium text-app">
                          {row.unitCode}: {row.unitTitle}
                        </span>
                        <span className="text-[10px] text-muted-2">{row.bookTitle}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted">{row.sessionCount}</td>
                    <td className="px-3 py-2">
                      <Badge tone={accuracyTone(row.accuracy)}>
                        {Math.round(row.accuracy * 100)}%
                      </Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted">
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

          <div className="border-t border-border-subtle bg-surface-2/45 p-4 xl:border-l xl:border-t-0">
            {selectedUnit ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="focus">{selectedUnit.unitCode}</Badge>
                  <Badge tone={accuracyTone(selectedUnit.accuracy)}>
                    {Math.round(selectedUnit.accuracy * 100)}%
                  </Badge>
                </div>
                <h3 className="mt-3 text-base font-semibold text-app">{selectedUnit.unitTitle}</h3>
                <dl className="mt-4 grid grid-cols-3 divide-x divide-border-subtle">
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
                  <p className="mb-2 text-xs font-semibold text-muted">Unit sessions</p>
                  {unitSessionsQ.isLoading ? (
                    <p className="text-xs text-muted">Loading sessions…</p>
                  ) : unitSessionsQ.isError ? (
                    <p role="alert" className="text-xs text-warning">
                      Unit sessions are temporarily unavailable.
                    </p>
                  ) : (unitSessionsQ.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-2">No sessions found for this unit.</p>
                  ) : (
                    <ul className="grouped-list divide-y divide-border-subtle">
                      {(unitSessionsQ.data ?? []).map((session) => (
                        <li
                          key={session.sessionId}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                        >
                          <span className="flex items-center gap-2">
                            <Badge tone="muted">{session.mode}</Badge>
                            <span className="text-muted">{formatDate(session.startedAt)}</span>
                          </span>
                          <span className="tabular-nums text-muted">
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
    pronunciationAssessmentCount?: number;
    pronunciationAverageScore?: number | null;
    pronunciationFlagCount?: number;
    pronunciationRetryRequiredCount?: number;
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
        pronunciationAssessmentCount?: number;
        pronunciationAverageScore?: number | null;
        pronunciationFlagCount?: number;
        pronunciationRetryRequiredCount?: number;
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

  const historyTransfer = (
    <div className="border-t border-border-subtle pt-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <label className="flex flex-col gap-1 text-xs text-muted">
          <span className="font-semibold text-muted-2">Export passphrase</span>
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.currentTarget.value)}
            placeholder="Optional AES export key"
            className="ui-focus-ring h-9 rounded-control border border-border-subtle bg-surface-1 px-3 text-sm text-app outline-none focus:border-accent"
          />
        </label>
        <label className="flex min-h-9 items-center gap-2 rounded-control border border-border-subtle bg-surface-1 px-3 text-xs text-muted">
          <input
            type="checkbox"
            checked={includeSnapshots}
            onChange={(event) => setIncludeSnapshots(event.currentTarget.checked)}
            className="h-4 w-4 accent-[rgb(var(--color-accent))]"
          />
          Include camera snapshots
        </label>
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
    </div>
  );

  return (
    <Panel
      title="Session evidence"
      caption="Timing, focus breaks, consented camera check-ins, and portable history export/import"
    >
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : !overview || overview.sessionCount === 0 ? (
        <div className="flex flex-col gap-5">
          <EmptyState
            title="No evidence logs yet"
            body="Student sessions will appear here after the learner starts a practice round."
          />
          {historyTransfer}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grouped-list grid sm:grid-cols-4 sm:divide-x sm:divide-border-subtle">
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

          <ul className="grouped-list divide-y divide-border-subtle">
            {overview.recentSessions.map((session) => (
              <li key={session.sessionId}>
                <button
                  type="button"
                  aria-pressed={selectedSessionId === session.sessionId}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                  className={cn(
                    "ui-focus-ring w-full rounded-none p-3 text-left transition-colors",
                    selectedSessionId === session.sessionId
                      ? "learning-trace bg-accent/10"
                      : "hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Badge tone="muted">{session.mode}</Badge>
                      <span className="text-xs text-muted">{formatDate(session.startedAt)}</span>
                    </span>
                    <Badge tone={attentionScoreTone(session.metrics.attentionScore)}>
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

          {historyTransfer}
        </div>
      )}
    </Panel>
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

  return (
    <Panel
      title="Pronunciation CAPT"
      caption="Computer-assisted pronunciation training scores from pronunciation sessions."
    >
      {loading ? (
        <p className="text-xs text-muted">Loading pronunciation evidence...</p>
      ) : !overview || attemptCount === 0 ? (
        <EmptyState
          title="No pronunciation attempts yet"
          body="CAPT attempts appear here after a student opens the pronunciation lab."
        />
      ) : (
        <div className="grid overflow-hidden rounded-object bg-surface-1 xl:grid-cols-[18rem_1fr]">
          <dl className="divide-y divide-border-subtle">
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
              value={
                overview.pronunciationRetryRequiredCount ?? overview.pronunciationFlagCount ?? 0
              }
              tone={
                (overview.pronunciationRetryRequiredCount ?? overview.pronunciationFlagCount ?? 0) >
                0
                  ? "warning"
                  : "success"
              }
            />
          </dl>
          <div className="border-t border-border-subtle bg-surface-2/45 p-4 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold text-muted">Recent pronunciation sessions</p>
            <ul className="grouped-list mt-3 divide-y divide-border-subtle">
              {sessions.slice(0, 6).map((session) => (
                <li
                  key={session.sessionId}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                >
                  <span className="text-muted">{formatDate(session.startedAt)}</span>
                  <span className="flex items-center gap-2">
                    <Badge
                      tone={
                        session.metrics.pronunciationAverageScore === null ||
                        session.metrics.pronunciationAverageScore === undefined
                          ? "muted"
                          : attentionScoreTone(session.metrics.pronunciationAverageScore)
                      }
                    >
                      {session.metrics.pronunciationAverageScore ?? "—"}
                    </Badge>
                    <span className="tabular-nums text-muted-2">
                      {session.metrics.pronunciationAssessmentCount ?? 0} attempts
                      {(session.metrics.pronunciationRetryRequiredCount ??
                        session.metrics.pronunciationFlagCount ??
                        0) > 0
                        ? ` · ${
                            session.metrics.pronunciationRetryRequiredCount ??
                            session.metrics.pronunciationFlagCount
                          } retries`
                        : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
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
    <div className="px-3 py-2.5">
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
      <div className="border-t border-border-subtle pt-4 text-xs text-muted">
        Session detail is unavailable.
      </div>
    );
  }

  const session = timeline?.session ?? report?.session;
  if (!session) return null;
  const endedAt = session.endedAt ?? timeline?.events.at(-1)?.occurredAt ?? session.startedAt;
  const accuracy = report?.accuracy ?? null;

  return (
    <section className="border-t border-border-subtle pt-4">
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
        <Badge tone={accuracy === null ? "muted" : accuracyTone(accuracy)}>
          {accuracy === null ? "No answers" : `${Math.round(accuracy * 100)}%`}
        </Badge>
      </header>

      <dl className="grouped-list mt-4 grid sm:grid-cols-4 sm:divide-x sm:divide-border-subtle">
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
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-4">
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
            <Badge key={unit.unitId} tone={accuracyTone(unit.accuracy)}>
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
  const [zoomed, setZoomed] = useState<(typeof snapshots)[number] | null>(null);

  if (snapshots.length === 0) {
    return <p className="mt-4 text-xs text-muted-2">No camera snapshots for this session.</p>;
  }

  return (
    <>
      <div className="grouped-list mt-5">
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
        <ul className="grouped-list divide-y divide-border-subtle">
          {rows.map((row) => (
            <li key={row.entryId}>
              <Link
                to="/tutor/content"
                search={{ entry: row.entryId, book: row.bookId }}
                className="ui-focus-ring flex items-center justify-between rounded-none px-3 py-2.5 text-sm transition-colors hover:bg-surface-2"
              >
                <span className="flex items-baseline gap-2">
                  <span className="ui-lexical text-[15px] font-medium text-app">
                    {row.headword}
                  </span>
                  <span className="text-[11px] text-muted-2">{row.pos}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Badge tone="warning">{Math.round(row.accuracy * 100)}%</Badge>
                  <span className="text-[11px] tabular-nums text-muted-2">
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
        <ul className="grouped-list divide-y divide-border-subtle">
          {rows.map((row) => {
            const accuracy =
              row.totalAnswered === 0
                ? null
                : Math.round((row.totalCorrect / row.totalAnswered) * 100);
            return (
              <li
                key={row.sessionId}
                className="flex items-center justify-between px-3 py-2.5 text-sm"
              >
                <span className="flex items-baseline gap-2">
                  <Badge tone="muted">{row.mode}</Badge>
                  <span className="text-xs text-muted">{formatDate(row.startedAt)}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <span className="text-[11px] tabular-nums text-muted-2">
                    {row.totalCorrect}/{row.totalAnswered}
                  </span>
                  {accuracy !== null ? (
                    <Badge
                      tone={accuracy >= 80 ? "success" : accuracy >= 50 ? "accent" : "warning"}
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
        <ul className="grouped-list divide-y divide-border-subtle">
          {defs.map((def) => (
            <li
              key={def.id}
              className="flex min-h-[var(--size-row)] items-center gap-2 px-3 py-2 text-xs text-success"
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
  tone?: "neutral" | "mastery" | "accent";
  children: React.ReactNode;
}) {
  return (
    <TutorPanel
      title={title}
      description={caption}
      className={cn(
        tone !== "neutral" && "learning-trace",
        tone === "mastery" && "[--trace-rgb:var(--color-moss)]",
      )}
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

function describeStudentState(
  summary:
    | {
        totalSeen: number;
        totalDue: number;
      }
    | undefined,
  practicedToday: boolean,
  accuracyPct: number | null,
): string {
  if (!summary) return "Loading the learner's current study state…";
  if (summary.totalSeen === 0) return "No completed answers yet; assign a first unit to begin.";
  if (summary.totalDue > 0 && accuracyPct !== null && accuracyPct < 70) {
    return `${summary.totalDue} items are due, with ${accuracyPct}% accuracy needing attention.`;
  }
  if (summary.totalDue > 0) {
    return `${summary.totalDue} items are due${practicedToday ? ", after practice today" : ""}.`;
  }
  if (practicedToday) return "Practised today, with no review items currently due.";
  return "No review items are currently due; recent work is shown below.";
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
