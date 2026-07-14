import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { type HeatmapCell, bucketByDay } from "@/modules/analytics";
import { getAchievement } from "@/modules/rewards";
import { AppGlyph, type AppGlyphName } from "@/ui/components/AppGlyph";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Heatmap } from "@/ui/components/Heatmap";
import { Modal } from "@/ui/components/Modal";
import { PageHeader } from "@/ui/components/PageHeader";
import { SplitView } from "@/ui/components/SplitView";
import { AchievementIcon } from "@/ui/components/rewards";
import { TutorPanel, TutorSelectField } from "@/ui/tutor/components/Material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EvidenceRecord } from "./student-detail/EvidenceRecord";

const HEATMAP_DAYS = 90;
const ACHIEVEMENT_PREVIEW_LIMIT = 6;

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
  const canLoadStudentData = Number.isFinite(id) && id > 0 && studentQ.data != null;

  const queryClient = useQueryClient();

  const summaryQ = useQuery({
    queryKey: queryKeys.progress.summary(id),
    queryFn: () => api.progress.studentSummary({ studentId: id }),
    enabled: canLoadStudentData,
  });

  const streakQ = useQuery({
    queryKey: queryKeys.rewards.streak(id),
    queryFn: () => api.rewards.streak({ studentId: id }),
    enabled: canLoadStudentData,
  });

  const unlockedQ = useQuery({
    queryKey: queryKeys.rewards.listUnlocked(id),
    queryFn: () => api.rewards.listUnlocked({ studentId: id }),
    enabled: canLoadStudentData,
  });

  const weakQ = useQuery({
    queryKey: queryKeys.progress.weakItems(id),
    queryFn: () => api.progress.weakItems({ studentId: id, minAttempts: 3, limit: 10 }),
    enabled: canLoadStudentData,
  });

  const recentQ = useQuery({
    queryKey: queryKeys.progress.recentSessions(id),
    queryFn: () => api.progress.recentSessions({ studentId: id, limit: 10 }),
    enabled: canLoadStudentData,
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
    enabled: canLoadStudentData,
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

  if (studentQ.isLoading) {
    return (
      <>
        <PageHeader title="Loading student…" subtitle="Opening the learner record." />
        <p role="status" className="px-[var(--space-window-x)] text-sm text-muted">
          Loading student profile…
        </p>
      </>
    );
  }

  if (studentQ.isError) {
    return (
      <StudentRecordUnavailable
        title="Student profile is unavailable"
        detail="The learner record could not be loaded."
        onRetry={() => studentQ.refetch()}
      />
    );
  }

  if (!studentQ.data) {
    return (
      <StudentRecordUnavailable
        title="Student not found"
        detail="This learner may have been archived or deleted."
      />
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

      <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4 px-6 pb-10">
        <section className="object-surface overflow-hidden">
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
          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Heatmap
              cells={heatmapCells}
              title="Practice activity"
              caption={`Last ${HEATMAP_DAYS} days`}
              density="roomy"
            />
            <CadencePanel cadence={cadence} loading={false} />
          </section>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
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

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <AssignmentsPanel key={`assignments-${id}`} studentId={id} queryClient={queryClient} />

          <section
            className="object-surface overflow-hidden"
            aria-labelledby="learner-records-title"
          >
            <header className="border-b border-border-subtle px-4 py-3">
              <h2
                id="learner-records-title"
                className="font-display text-base font-semibold text-app"
              >
                Learner records
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                Open a focused view when you need the underlying detail.
              </p>
            </header>
            <div className="divide-y divide-border-subtle">
              <UnitReportPanel key={`unit-report-${id}`} studentId={id} />

              <EvidenceRecord key={`evidence-${id}`} studentId={id} />

              {unlockedQ.isError ? (
                <RecordUnavailable title="Achievements" onRetry={() => unlockedQ.refetch()} />
              ) : (
                <AchievementsPanel
                  key={`achievements-${id}`}
                  records={unlockedQ.data ?? []}
                  loading={unlockedQ.isLoading}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function StudentRecordUnavailable({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => unknown;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={detail} />
      <div className="px-[var(--space-window-x)] pb-10">
        <div className="object-surface max-w-xl px-5 py-6">
          <p className="text-sm text-muted">No student controls are available for this record.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            <Link
              to="/tutor/students"
              className="ui-focus-ring inline-flex min-h-8 items-center rounded-control px-2 text-xs font-medium text-accent"
            >
              Return to students
            </Link>
          </div>
        </div>
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

function RecordUnavailable({ title, onRetry }: { title: string; onRetry: () => unknown }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-app">{title}</span>
        <span className="mt-0.5 block text-xs text-warning">Temporarily unavailable</span>
      </span>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
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
  const [hydratedAssignmentKey, setHydratedAssignmentKey] = useState<string | null>(null);

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
  const assignmentKey = bookId === null ? null : `${studentId}:${bookId}`;

  useEffect(() => {
    if (assignmentKey !== null && assignedQ.data) {
      setSelectedUnitIds(new Set(assignedQ.data));
      setHydratedAssignmentKey(assignmentKey);
    }
  }, [assignedQ.data, assignmentKey]);

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
        queryClient.invalidateQueries({
          queryKey: queryKeys.progress.assignedUnitProgress(studentId),
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
              disabled={unitsQ.isLoading || assignedQ.isLoading || saveAssignments.isPending}
              onChange={(value) => {
                setBookId(Number(value));
                setSelectedUnitIds(new Set());
                setHydratedAssignmentKey(null);
              }}
              containerClassName="sm:min-w-72"
            />
            <Button
              onClick={() => saveAssignments.mutate()}
              disabled={
                bookId === null ||
                hydratedAssignmentKey !== assignmentKey ||
                unitsQ.isLoading ||
                unitsQ.isError ||
                assignedQ.isLoading ||
                assignedQ.isError ||
                saveAssignments.isPending
              }
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

function UnitReportPanel({ studentId }: { studentId: number }) {
  const [open, setOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const unitReportQ = useQuery({
    queryKey: queryKeys.progress.unitReport(studentId),
    queryFn: () => api.progress.unitReport({ studentId }),
    enabled: open && studentId > 0,
  });
  const rows = unitReportQ.data ?? [];
  const effectiveSelectedUnitId =
    selectedUnitId !== null && rows.some((row) => row.unitId === selectedUnitId)
      ? selectedUnitId
      : (rows[0]?.unitId ?? null);

  useEffect(() => {
    setSelectedUnitId((current) => {
      if (current !== null && rows.some((row) => row.unitId === current)) return current;
      return rows[0]?.unitId ?? null;
    });
  }, [rows]);

  const selectedUnit = rows.find((row) => row.unitId === effectiveSelectedUnitId) ?? null;
  const unitSessionsQ = useQuery({
    queryKey:
      effectiveSelectedUnitId === null
        ? ["progress", "unitSessions", studentId, "none"]
        : queryKeys.progress.unitSessions(studentId, effectiveSelectedUnitId),
    queryFn: () =>
      api.progress.unitSessions({
        studentId,
        unitId: effectiveSelectedUnitId ?? 0,
        limit: 20,
      }),
    enabled: open && effectiveSelectedUnitId !== null,
  });

  return (
    <>
      <RecordLauncher
        title="Unit report"
        detail={
          open && unitReportQ.isLoading
            ? "Loading unit history…"
            : unitReportQ.data
              ? `${rows.length} practised unit${rows.length === 1 ? "" : "s"}`
              : "Review unit performance and session history"
        }
        icon="book"
        open={open}
        onOpen={() => setOpen(true)}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Unit report"
        description="Choose a unit to inspect its aggregate results and session history."
        size="lg"
      >
        {unitReportQ.isLoading ? (
          <p role="status" className="py-8 text-center text-sm text-muted">
            Loading units…
          </p>
        ) : unitReportQ.isError ? (
          <div role="alert" className="py-8 text-center">
            <p className="text-sm font-medium text-app">Unit report is unavailable</p>
            <p className="mt-1 text-xs text-muted">No learner record has been changed.</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => unitReportQ.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No unit attempts yet"
            body="Unit rows appear after the student answers vocabulary or grammar items."
          />
        ) : (
          <SplitView
            initialSize={210}
            minSize={180}
            maxSize={260}
            contentMinSize={300}
            label="Resize unit index"
            storageKey={`tutor.student.${studentId}.unit-report-split`}
            className="h-[min(60vh,38rem)] overflow-hidden rounded-object border border-border-subtle"
          >
            <nav aria-label="Unit report index" className="h-full overflow-y-auto bg-surface-2/45">
              {rows.map((row) => (
                <button
                  key={row.unitId}
                  type="button"
                  aria-pressed={effectiveSelectedUnitId === row.unitId}
                  onClick={() => setSelectedUnitId(row.unitId)}
                  className={cn(
                    "ui-focus-ring w-full border-b border-border-subtle px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2",
                    effectiveSelectedUnitId === row.unitId && "bg-surface-3/60",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-app">
                      {row.unitCode}: {row.unitTitle}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {Math.round(row.accuracy * 100)}%
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-muted-2">
                    {row.bookTitle} · {row.sessionCount} session{row.sessionCount === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </nav>

            <section className="h-full overflow-y-auto p-5" aria-live="polite">
              {selectedUnit ? (
                <>
                  <p className="text-xs font-medium text-accent">{selectedUnit.unitCode}</p>
                  <h3 className="mt-1 text-lg font-semibold text-app">{selectedUnit.unitTitle}</h3>
                  <p className="mt-1 text-xs text-muted">{selectedUnit.bookTitle}</p>
                  <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-control bg-border-subtle sm:grid-cols-4">
                    <UnitReportMetric
                      label="Answered"
                      value={selectedUnit.totalAnswered}
                      tone="accent"
                    />
                    <UnitReportMetric
                      label="Correct"
                      value={selectedUnit.totalCorrect}
                      tone="success"
                    />
                    <UnitReportMetric
                      label="Accuracy"
                      value={`${Math.round(selectedUnit.accuracy * 100)}%`}
                      tone={accuracyTone(selectedUnit.accuracy)}
                    />
                    <UnitReportMetric
                      label="Avg response"
                      value={
                        selectedUnit.avgResponseMs === null
                          ? "—"
                          : formatMs(selectedUnit.avgResponseMs)
                      }
                      tone="neutral"
                    />
                  </dl>
                  <div className="mt-5 border-t border-border-subtle pt-4">
                    <h4 className="text-sm font-semibold text-app">Sessions</h4>
                    {unitSessionsQ.isLoading ? (
                      <p role="status" className="mt-3 text-xs text-muted">
                        Loading sessions…
                      </p>
                    ) : unitSessionsQ.isError ? (
                      <p role="alert" className="mt-3 text-xs text-warning">
                        Unit sessions are temporarily unavailable.
                      </p>
                    ) : (unitSessionsQ.data ?? []).length === 0 ? (
                      <p className="mt-3 text-xs text-muted-2">No sessions found for this unit.</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-border-subtle">
                        {(unitSessionsQ.data ?? []).map((session) => (
                          <li
                            key={session.sessionId}
                            className="flex items-center justify-between gap-3 py-2.5 text-xs"
                          >
                            <span>
                              <span className="block font-medium text-app">{session.mode}</span>
                              <time
                                className="mt-0.5 block text-muted"
                                dateTime={session.startedAt.toISOString()}
                              >
                                {formatDate(session.startedAt)}
                              </time>
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
            </section>
          </SplitView>
        )}
      </Modal>
    </>
  );
}

function UnitReportMetric({
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
      <dd
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "neutral" && "text-muted",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </dd>
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

function AchievementsPanel({
  records,
  loading,
}: {
  records: Array<{ achievementId: string; unlockedAt: Date }>;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const achievements = records.flatMap((record) => {
    const definition = getAchievement(record.achievementId);
    return definition ? [{ definition, unlockedAt: record.unlockedAt }] : [];
  });
  const preview = achievements.slice(0, ACHIEVEMENT_PREVIEW_LIMIT);
  const overflow = achievements.length - preview.length;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="ui-focus-ring group w-full rounded-none px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <span className="flex items-center gap-3">
          <AppGlyph name="trophy" className="text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-app">Achievements</span>
            <span className="mt-0.5 block text-xs text-muted">
              {loading ? "Loading collection…" : `${achievements.length} unlocked`}
            </span>
          </span>
          <AppGlyph name="arrowRight" className="text-muted-2 group-hover:text-app" />
        </span>
        {!loading && preview.length > 0 ? (
          <span className="mt-2.5 flex items-center gap-2 pl-8" aria-label="Achievement preview">
            {preview.map(({ definition }) => (
              <span
                key={definition.id}
                title={definition.title}
                className="grid h-6 w-6 place-items-center text-mastery"
              >
                <AchievementIcon icon={definition.icon} className="h-[18px] w-[18px]" />
              </span>
            ))}
            {overflow > 0 ? (
              <span className="text-xs font-medium tabular-nums text-muted">+{overflow}</span>
            ) : null}
          </span>
        ) : null}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Achievements"
        description={
          loading
            ? "Loading the learner’s collection…"
            : `${achievements.length} milestones unlocked.`
        }
        size="md"
      >
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-muted">
            Loading achievements…
          </p>
        ) : achievements.length === 0 ? (
          <EmptyState
            title="No achievements yet"
            body="Completed practice milestones will appear in this collection."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {achievements.map(({ definition, unlockedAt }) => (
              <li key={definition.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <AchievementIcon
                  icon={definition.icon}
                  className="mt-0.5 h-5 w-5 shrink-0 text-mastery"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-app">{definition.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {definition.description}
                  </span>
                  <time
                    dateTime={unlockedAt.toISOString()}
                    className="mt-1 block text-[11px] text-muted-2"
                  >
                    Unlocked {formatCalendarDate(unlockedAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <TutorPanel title={title} description={caption}>
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

function formatCalendarDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
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

function accuracyTone(score: number): "success" | "accent" | "warning" {
  if (score >= 0.8) return "success";
  if (score >= 0.5) return "accent";
  return "warning";
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
