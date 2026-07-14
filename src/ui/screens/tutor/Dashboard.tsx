import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Avatar } from "@/ui/components/Avatar";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

const COHORT_DAYS = 14;
const STALE_AFTER_DAYS = 7;
const MIN_ACCURACY_SAMPLE = 10;
const LOW_ACCURACY_THRESHOLD = 0.65;
const ATTENTION_LIMIT = 5;

type OverviewRow = Awaited<ReturnType<typeof api.progress.tutorOverview>>[number];
type EvidenceRow = Awaited<ReturnType<typeof api.evidence.tutorOverview>>[number];
type CohortCell = Awaited<ReturnType<typeof api.progress.cohortActivity>>[number];

export function TutorDashboard() {
  const overviewQ = useQuery({
    queryKey: queryKeys.progress.tutorOverview(),
    queryFn: () => api.progress.tutorOverview(),
  });
  const evidenceQ = useQuery({
    queryKey: queryKeys.evidence.tutorOverview(),
    queryFn: () => api.evidence.tutorOverview(),
  });
  const cohortQ = useQuery({
    queryKey: queryKeys.progress.cohortActivity(COHORT_DAYS),
    queryFn: () => {
      const until = new Date();
      const since = new Date(until.getFullYear(), until.getMonth(), until.getDate());
      since.setDate(since.getDate() - (COHORT_DAYS - 1));
      return api.progress.cohortActivity({
        sinceIso: since.toISOString(),
        untilIso: until.toISOString(),
      });
    },
  });

  const rows = overviewQ.data ?? [];
  const evidenceRows = evidenceQ.data ?? [];
  const cohort = cohortQ.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Overview"
        subtitle="Practice rhythm, learners who need a follow-up, and the exact record behind it."
      />

      {overviewQ.isLoading ? (
        <div className="px-[var(--space-window-x)] pb-10">
          <p className="text-sm text-muted">Loading tutor overview…</p>
        </div>
      ) : overviewQ.isError ? (
        <div className="px-[var(--space-window-x)] pb-10">
          <div className="ui-group bg-surface-1 px-5 py-8 text-center">
            <p className="text-sm font-medium text-app">Tutor overview is unavailable</p>
            <p className="mt-1 text-xs text-muted">The student record could not be loaded.</p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-[var(--space-window-x)] pb-10">
          <div className="ui-group bg-surface-1 p-6">
            <EmptyState
              title="No active students"
              body="Create a learner profile to start tracking practice rhythm and review load."
              action={
                <Link
                  to="/tutor/students"
                  className="inline-flex h-[var(--size-control-md)] items-center rounded-md bg-accent px-3 text-xs font-medium text-white"
                >
                  Add a student
                </Link>
              }
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-[var(--space-window-x)] pb-10">
          <CohortConclusion
            rows={rows}
            evidenceRows={evidenceRows}
            cohort={cohort}
            cohortLoading={cohortQ.isLoading}
            cohortUnavailable={cohortQ.isError}
          />

          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
            <CohortRhythm
              cells={cohort}
              loading={cohortQ.isLoading}
              unavailable={cohortQ.isError}
            />
            <AttentionQueue rows={rows} evidenceRows={evidenceRows} />
          </div>

          <SummaryStrip
            rows={rows}
            cohort={cohort}
            cohortLoading={cohortQ.isLoading}
            cohortUnavailable={cohortQ.isError}
          />

          <StudentLedger
            rows={rows}
            evidenceRows={evidenceRows}
            evidenceUnavailable={evidenceQ.isError}
          />
        </div>
      )}
    </>
  );
}

function CohortConclusion({
  rows,
  evidenceRows,
  cohort,
  cohortLoading,
  cohortUnavailable,
}: {
  rows: OverviewRow[];
  evidenceRows: EvidenceRow[];
  cohort: CohortCell[];
  cohortLoading: boolean;
  cohortUnavailable: boolean;
}) {
  const evidenceByStudent = new Map(evidenceRows.map((row) => [row.student.id, row]));
  const attention = rows
    .map((row): AttentionItem | null => {
      const reasons = attentionReasons(row, evidenceByStudent.get(row.student.id));
      return reasons.length > 0 ? { row, reasons } : null;
    })
    .filter((item): item is AttentionItem => item !== null)
    .sort(compareAttentionItems);
  const first = attention[0];
  const totalDue = rows.reduce((sum, row) => sum + row.totalDue, 0);
  const answerCount = cohort.reduce((sum, cell) => sum + cell.answerCount, 0);
  const activeToday = cohort.at(-1)?.activeStudentCount ?? 0;

  const title = first
    ? `${studentDisplayName(first.row)} is the clearest next follow-up.`
    : totalDue > 0
      ? `${formatInteger(totalDue)} items are due for review.`
      : "The cohort has no urgent follow-up signals.";
  const detail = cohortLoading
    ? `${formatInteger(rows.length)} active profiles · lesson activity is loading.`
    : cohortUnavailable
      ? `${formatInteger(rows.length)} active profiles · lesson activity is temporarily unavailable.`
      : `${formatInteger(activeToday)} lesson-active today · ${formatInteger(answerCount)} assigned-lesson answers in ${COHORT_DAYS} days.`;

  return (
    <section className="learning-trace py-1 pl-4" aria-labelledby="cohort-conclusion-title">
      <h2 id="cohort-conclusion-title" className="text-[15px] font-semibold text-app">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        {first ? `${first.reasons.map((reason) => reason.label).join(" · ")}. ` : ""}
        {detail}
      </p>
    </section>
  );
}

function SummaryStrip({
  rows,
  cohort,
  cohortLoading,
  cohortUnavailable,
}: {
  rows: OverviewRow[];
  cohort: CohortCell[];
  cohortLoading: boolean;
  cohortUnavailable: boolean;
}) {
  const totalDue = rows.reduce((sum, row) => sum + row.totalDue, 0);
  const answerCount = cohort.reduce((sum, cell) => sum + cell.answerCount, 0);
  const activeToday = cohort.at(-1)?.activeStudentCount ?? 0;
  const values = [
    { label: "Active profiles", value: formatInteger(rows.length) },
    { label: "Due now", value: formatInteger(totalDue) },
    {
      label: `Lesson answers · ${COHORT_DAYS} days`,
      value: cohortLoading ? "…" : cohortUnavailable ? "—" : formatInteger(answerCount),
    },
    {
      label: "Lesson-active today",
      value: cohortLoading ? "…" : cohortUnavailable ? "—" : formatInteger(activeToday),
    },
  ];

  return (
    <dl className="ui-group grid grid-cols-2 gap-px bg-border-subtle lg:grid-cols-4">
      {values.map((item) => (
        <div key={item.label} className="bg-surface-1 px-4 py-3">
          <dt className="text-[11px] text-muted">{item.label}</dt>
          <dd data-tabular className="mt-1 text-lg font-semibold tracking-[-0.01em] text-app">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CohortRhythm({
  cells,
  loading,
  unavailable,
}: {
  cells: CohortCell[];
  loading: boolean;
  unavailable: boolean;
}) {
  const answerCount = cells.reduce((sum, cell) => sum + cell.answerCount, 0);
  const correctCount = cells.reduce((sum, cell) => sum + cell.correctCount, 0);
  const accuracy = answerCount === 0 ? null : Math.round((correctCount / answerCount) * 100);
  const maxAnswers = Math.max(1, ...cells.map((cell) => cell.answerCount));
  const peak = cells.reduce<CohortCell | null>(
    (best, cell) => (!best || cell.answerCount > best.answerCount ? cell : best),
    null,
  );
  const range = formatRange(cells);
  const chartLabel = `Assigned lesson activity for ${range}: ${answerCount} answers, ${correctCount} correct${
    accuracy === null ? "" : `, ${accuracy} percent accuracy`
  }.`;

  return (
    <section className="ui-group min-w-0 bg-surface-1 p-5" aria-labelledby="cohort-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="cohort-title" className="text-[15px] font-semibold text-app">
            Assigned lesson rhythm
          </h2>
          <p className="mt-1 text-xs text-muted">Assigned-lesson answers · {range}</p>
        </div>
        {!loading && answerCount > 0 ? (
          <p data-tabular className="text-right text-xs text-muted">
            <span className="font-medium text-app">{formatInteger(answerCount)}</span> answers
            <span aria-hidden className="px-1.5 text-muted-2">
              ·
            </span>
            <span className="font-medium text-app">{accuracy}%</span> correct
          </p>
        ) : null}
      </header>

      {loading ? (
        <div className="grid min-h-52 place-items-center" aria-live="polite">
          <p className="text-sm text-muted">Loading cohort rhythm…</p>
        </div>
      ) : unavailable ? (
        <div className="grid min-h-52 place-items-center border-t border-border-subtle text-center">
          <div>
            <p className="text-sm font-medium text-app">Cohort activity is unavailable</p>
            <p className="mt-1 text-xs text-muted">Student totals below are still available.</p>
          </div>
        </div>
      ) : answerCount === 0 ? (
        <div className="grid min-h-52 place-items-center border-t border-border-subtle text-center">
          <div>
            <p className="text-sm font-medium text-app">No answers in the last 14 days</p>
            <p className="mt-1 text-xs text-muted">
              The rhythm begins with the next practice round.
            </p>
          </div>
        </div>
      ) : (
        <figure className="mt-5 min-w-0">
          <div role="img" aria-label={chartLabel} className="min-w-0">
            <div className="flex h-40 items-end gap-1.5 border-b border-border-subtle px-0.5">
              {cells.map((cell) => {
                const totalHeight = Math.max(2, (cell.answerCount / maxAnswers) * 100);
                const correctHeight =
                  cell.answerCount === 0 ? 0 : (cell.correctCount / cell.answerCount) * 100;
                return (
                  <div
                    key={cell.bucketStart.toISOString()}
                    className="flex h-full min-w-0 flex-1 items-end"
                    title={formatCellLabel(cell)}
                  >
                    {cell.answerCount > 0 ? (
                      <div
                        className="relative w-full min-w-[6px] overflow-hidden rounded-t-[3px] bg-accent/20"
                        style={{ height: `${totalHeight}%` }}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 bg-accent"
                          style={{ height: `${correctHeight}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1.5 px-0.5" aria-hidden>
              {cells.map((cell, index) => (
                <span
                  key={cell.bucketStart.toISOString()}
                  className="min-w-0 flex-1 text-center text-[9px] tabular-nums text-muted-2"
                >
                  {index === 0 || index === cells.length - 1 || index % 3 === 1
                    ? cell.bucketStart.getDate()
                    : ""}
                </span>
              ))}
            </div>
          </div>

          <table className="sr-only">
            <caption>Daily cohort answer counts</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Answers</th>
                <th>Correct</th>
                <th>Active learners</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => (
                <tr key={cell.bucketStart.toISOString()}>
                  <td>{formatDateLabel(cell.bucketStart)}</td>
                  <td>{cell.answerCount}</td>
                  <td>{cell.correctCount}</td>
                  <td>{cell.activeStudentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3 text-[11px] text-muted">
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-[2px] bg-accent/20" /> Total answers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-[2px] bg-accent" /> Correct
              </span>
            </span>
            <span data-tabular>
              Peak {peak ? `${formatShortDate(peak.bucketStart)} · ${peak.answerCount}` : "—"}
            </span>
          </figcaption>
        </figure>
      )}
    </section>
  );
}

interface AttentionReason {
  priority: number;
  label: string;
}

interface AttentionItem {
  row: OverviewRow;
  reasons: AttentionReason[];
}

function AttentionQueue({
  rows,
  evidenceRows,
}: {
  rows: OverviewRow[];
  evidenceRows: EvidenceRow[];
}) {
  const evidenceByStudent = new Map(evidenceRows.map((row) => [row.student.id, row]));
  const attention = rows
    .map((row): AttentionItem | null => {
      const reasons = attentionReasons(row, evidenceByStudent.get(row.student.id));
      return reasons.length > 0 ? { row, reasons } : null;
    })
    .filter((item): item is AttentionItem => item !== null)
    .sort(compareAttentionItems);
  const visible = attention.slice(0, ATTENTION_LIMIT);

  return (
    <section className="ui-group min-w-0 bg-surface-1" aria-labelledby="attention-title">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h2 id="attention-title" className="text-[15px] font-semibold text-app">
            Needs a follow-up
          </h2>
          <p className="mt-1 text-xs text-muted">Sorted by explicit, inspectable signals.</p>
        </div>
        <span data-tabular className="text-xs text-muted-2">
          {attention.length}
        </span>
      </header>

      {visible.length === 0 ? (
        <div className="border-t border-border-subtle px-4 py-8 text-center">
          <p className="text-sm font-medium text-app">Nothing needs follow-up now</p>
          <p className="mt-1 text-xs text-muted">
            No stale due load, review flags, or weak samples.
          </p>
        </div>
      ) : (
        <ul aria-label="Learners needing attention" className="border-t border-border-subtle">
          {visible.map(({ row, reasons }) => {
            const display = row.student.displayName ?? row.student.name;
            return (
              <li key={row.student.id} className="border-b border-border-subtle last:border-b-0">
                <Link
                  to="/tutor/students/$studentId"
                  params={{ studentId: String(row.student.id) }}
                  className="ui-focus-ring group flex min-h-16 items-center gap-3 px-4 py-3 outline-offset-[-2px] transition-colors hover:bg-surface-2/65"
                >
                  <span aria-hidden className="h-8 w-0.5 shrink-0 rounded-sm bg-accent" />
                  <Avatar
                    name={display}
                    avatarSeed={row.student.avatarSeed ?? null}
                    color={row.student.color}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-app">{display}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-muted">
                      {reasons.map((reason) => reason.label).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-muted group-hover:text-app">
                    Open
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {attention.length > visible.length ? (
        <p className="border-t border-border-subtle px-4 py-2.5 text-[11px] text-muted">
          {attention.length - visible.length} more learner
          {attention.length - visible.length === 1 ? "" : "s"} in the ledger below.
        </p>
      ) : null}
    </section>
  );
}

function StudentLedger({
  rows,
  evidenceRows,
  evidenceUnavailable,
}: {
  rows: OverviewRow[];
  evidenceRows: EvidenceRow[];
  evidenceUnavailable: boolean;
}) {
  const evidenceByStudent = new Map(evidenceRows.map((row) => [row.student.id, row]));
  const sorted = [...rows].sort((a, b) =>
    studentDisplayName(a).localeCompare(studentDisplayName(b), undefined, { sensitivity: "base" }),
  );

  return (
    <section aria-labelledby="ledger-title">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 id="ledger-title" className="text-[15px] font-semibold text-app">
            Student ledger
          </h2>
          <p className="mt-1 text-xs text-muted">Lifetime totals with current review load.</p>
        </div>
        {evidenceUnavailable ? (
          <span className="text-[11px] text-warning">Session signals unavailable</span>
        ) : (
          <Link
            to="/tutor/students"
            className="ui-focus-ring rounded-control text-xs font-medium text-accent hover:underline"
          >
            Manage profiles
          </Link>
        )}
      </header>

      <div className="ui-group overflow-x-auto bg-surface-1">
        <table className="w-full min-w-[46rem] text-left text-[13px]">
          <caption className="sr-only">Student ledger</caption>
          <thead className="border-b border-border-subtle bg-surface-2/70 text-[11px] text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-3 py-2 text-right font-medium">Answers</th>
              <th className="px-3 py-2 text-right font-medium">Due</th>
              <th className="px-3 py-2 text-right font-medium">Accuracy</th>
              <th className="px-3 py-2 font-medium">Last practised</th>
              <th className="px-3 py-2 text-right font-medium">Review flags</th>
              <th aria-hidden className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const display = studentDisplayName(row);
              const evidence = evidenceByStudent.get(row.student.id);
              return (
                <tr
                  key={row.student.id}
                  className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-2/55"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/tutor/students/$studentId"
                      params={{ studentId: String(row.student.id) }}
                      className="ui-focus-ring flex items-center gap-3 rounded-control hover:text-accent"
                    >
                      <Avatar
                        name={display}
                        avatarSeed={row.student.avatarSeed ?? null}
                        color={row.student.color}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-app">{display}</span>
                        <span data-tabular className="mt-0.5 block text-[11px] text-muted-2">
                          {formatInteger(row.totalSeen)} words seen
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td data-tabular className="px-3 py-3 text-right text-app">
                    {formatInteger(row.totalAttempts)}
                  </td>
                  <td
                    data-tabular
                    className={cn(
                      "px-3 py-3 text-right",
                      row.totalDue > 0 ? "font-medium text-warning" : "text-muted-2",
                    )}
                  >
                    {formatInteger(row.totalDue)}
                  </td>
                  <td data-tabular className="px-3 py-3 text-right text-app">
                    {row.totalAttempts === 0 ? "—" : `${Math.round(row.accuracy * 100)}%`}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {row.lastPracticedAt ? (
                      <time
                        dateTime={row.lastPracticedAt.toISOString()}
                        title={formatDateLabel(row.lastPracticedAt)}
                      >
                        {relativeTime(row.lastPracticedAt)}
                      </time>
                    ) : (
                      "Never"
                    )}
                  </td>
                  <td
                    data-tabular
                    className={cn(
                      "px-3 py-3 text-right",
                      (evidence?.totalReviewFlags ?? 0) > 0 ? "text-warning" : "text-muted-2",
                    )}
                  >
                    {formatInteger(evidence?.totalReviewFlags ?? 0)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      to="/tutor/students/$studentId"
                      params={{ studentId: String(row.student.id) }}
                      aria-label={`Open ${display}`}
                      className="ui-focus-ring rounded-control text-[11px] font-medium text-muted hover:text-app"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function attentionReasons(row: OverviewRow, evidence?: EvidenceRow): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (row.totalAttempts === 0) {
    reasons.push({ priority: 0, label: "No practice yet" });
  } else {
    const daysAway = row.lastPracticedAt ? daysSince(row.lastPracticedAt) : null;
    if (row.totalDue > 0 && daysAway !== null && daysAway >= STALE_AFTER_DAYS) {
      reasons.push({
        priority: 1,
        label: `${formatInteger(row.totalDue)} due after ${daysAway}d away`,
      });
    }
  }
  if ((evidence?.totalReviewFlags ?? 0) > 0) {
    const count = evidence?.totalReviewFlags ?? 0;
    reasons.push({
      priority: 2,
      label: `${formatInteger(count)} recorded review flag${count === 1 ? "" : "s"}`,
    });
  }
  if (row.totalAttempts >= MIN_ACCURACY_SAMPLE && row.accuracy < LOW_ACCURACY_THRESHOLD) {
    reasons.push({
      priority: 3,
      label: `${Math.round(row.accuracy * 100)}% across ${formatInteger(row.totalAttempts)} answers`,
    });
  }
  return reasons.sort((a, b) => a.priority - b.priority);
}

function compareAttentionItems(a: AttentionItem, b: AttentionItem): number {
  const priorityDelta = (a.reasons[0]?.priority ?? 99) - (b.reasons[0]?.priority ?? 99);
  if (priorityDelta !== 0) return priorityDelta;
  const dueDelta = b.row.totalDue - a.row.totalDue;
  if (dueDelta !== 0) return dueDelta;
  const aTime = a.row.lastPracticedAt?.getTime() ?? 0;
  const bTime = b.row.lastPracticedAt?.getTime() ?? 0;
  if (aTime !== bTime) return aTime - bTime;
  return studentDisplayName(a.row).localeCompare(studentDisplayName(b.row));
}

function studentDisplayName(row: OverviewRow): string {
  return row.student.displayName ?? row.student.name;
}

function daysSince(value: Date): number {
  const now = new Date();
  const startDay = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - startDay) / 86_400_000));
}

function formatRange(cells: CohortCell[]): string {
  const first = cells[0]?.bucketStart;
  const last = cells.at(-1)?.bucketStart;
  if (!first || !last) return `last ${COHORT_DAYS} days`;
  return `${formatShortDate(first)}–${formatShortDate(last)}`;
}

function formatCellLabel(cell: CohortCell): string {
  return `${formatDateLabel(cell.bucketStart)}: ${cell.answerCount} assigned-lesson answers, ${cell.correctCount} correct, ${cell.activeStudentCount} lesson-active learners`;
}

function formatDateLabel(value: Date): string {
  return value.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatShortDate(value: Date): string {
  return value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatInteger(value: number): string {
  return value.toLocaleString();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeTime(value: Date): string {
  const diff = Date.now() - value.getTime();
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return formatShortDate(value);
}
