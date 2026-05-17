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
                          ? "border-mastery/50 bg-mastery/10 shadow-glow"
                          : "border-border-subtle bg-surface-0/60 hover:border-border-strong hover:bg-surface-2",
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
                className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface-0/70 px-3 py-2.5 text-sm transition-colors hover:border-accent/50 hover:bg-surface-2"
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
                className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface-0/70 px-3 py-2.5 text-sm"
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
