import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";
import { ContentIcon, DashboardIcon, StudentModeIcon, StudentsIcon } from "@/ui/shell/icons";
import { TutorDataTable, TutorMetricCard } from "@/ui/tutor/components/Material";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type React from "react";

/**
 * Tutor overview: a few corpus stats up top, then a per-student
 * roll-up table that links into the per-student detail screen. The
 * "Getting started" copy moved to README — this view is now the
 * actual at-a-glance for an active tutor.
 */
export function TutorDashboard() {
  const booksQ = useQuery({
    queryKey: queryKeys.curriculum.books(),
    queryFn: () => api.curriculum.listBooks(),
  });
  const studentsQ = useQuery({
    queryKey: queryKeys.students.listActive(),
    queryFn: () => api.students.listActive(),
  });
  const overviewQ = useQuery({
    queryKey: queryKeys.progress.tutorOverview(),
    queryFn: () => api.progress.tutorOverview(),
  });
  const evidenceQ = useQuery({
    queryKey: queryKeys.evidence.tutorOverview(),
    queryFn: () => api.evidence.tutorOverview(),
  });

  const books = booksQ.data ?? [];
  const students = studentsQ.data ?? [];
  const totalUnits = useTotalUnitCount(books.map((b) => b.id));

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Tutor dashboard"
        subtitle="At-a-glance corpus stats + per-student roll-up. Click a student to drill into their analytics."
      />

      <section className="grid grid-cols-1 gap-4 px-8 py-6 md:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Books"
          value={booksQ.isLoading ? "…" : String(books.length)}
          hint={books.length === 0 ? "Run npm run import" : "imported"}
          to="/tutor/content"
          icon={<ContentIcon />}
        />
        <Stat
          label="Units"
          value={totalUnits === null ? "…" : String(totalUnits)}
          hint="across all books"
          to="/tutor/content"
          icon={<DashboardIcon />}
        />
        <Stat
          label="Students"
          value={studentsQ.isLoading ? "…" : String(students.length)}
          hint="active profiles"
          to="/tutor/students"
          icon={<StudentsIcon />}
        />
        <Stat
          label="Sessions"
          value={overviewQ.data ? String(sumPracticed(overviewQ.data)) : "…"}
          hint="have practised"
          icon={<StudentModeIcon />}
        />
        <Stat
          label="Review flags"
          value={evidenceQ.data ? String(sumReviewFlags(evidenceQ.data)) : "…"}
          hint="attention signals"
          icon={<DashboardIcon />}
        />
      </section>

      <section className="px-8 pb-10">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase text-muted-2">Students</h2>
          <Link to="/tutor/students" className="text-xs font-semibold text-muted hover:text-app">
            Manage
          </Link>
        </header>
        {overviewQ.isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (overviewQ.data ?? []).length === 0 ? (
          <EmptyState
            title="No active students"
            body="Create a profile in Students to start tracking practice."
          />
        ) : (
          <StudentTable rows={overviewQ.data ?? []} evidenceRows={evidenceQ.data ?? []} />
        )}
      </section>
    </>
  );
}

function StudentTable({
  rows,
  evidenceRows,
}: {
  rows: Array<{
    student: {
      id: number;
      name: string;
      displayName: string | null;
      avatarSeed?: string | null;
      color: string | null;
    };
    totalSeen: number;
    totalDue: number;
    accuracy: number;
    lastPracticedAt: Date | null;
  }>;
  evidenceRows: Array<{
    student: { id: number };
    avgAttentionScore: number | null;
    totalReviewFlags: number;
  }>;
}) {
  const evidenceByStudent = new Map(evidenceRows.map((row) => [row.student.id, row]));
  return (
    <TutorDataTable>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] text-[11px] uppercase text-muted-2">
          <tr>
            <th className="px-4 py-2 font-medium">Student</th>
            <th className="px-4 py-2 font-medium">Seen</th>
            <th className="px-4 py-2 font-medium">Due</th>
            <th className="px-4 py-2 font-medium">Accuracy</th>
            <th className="px-4 py-2 font-medium">Attention</th>
            <th className="px-4 py-2 font-medium">Last practised</th>
            <th aria-hidden className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StudentRow
              key={row.student.id}
              row={row}
              evidence={evidenceByStudent.get(row.student.id)}
            />
          ))}
        </tbody>
      </table>
    </TutorDataTable>
  );
}

function StudentRow({
  row,
  evidence,
}: {
  row: {
    student: {
      id: number;
      name: string;
      displayName: string | null;
      avatarSeed?: string | null;
      color: string | null;
    };
    totalSeen: number;
    totalDue: number;
    accuracy: number;
    lastPracticedAt: Date | null;
  };
  evidence?: {
    avgAttentionScore: number | null;
    totalReviewFlags: number;
  };
}) {
  const display = row.student.displayName ?? row.student.name;
  const totalAttempts = row.totalSeen > 0 ? Math.round(row.accuracy * 100) : null;
  return (
    <tr className="border-b border-border-subtle last:border-b-0 transition-colors hover:bg-accent/[var(--state-hover)]">
      <td className="px-4 py-3">
        <Link
          to="/tutor/students/$studentId"
          params={{ studentId: String(row.student.id) }}
          className="flex items-center gap-3 hover:text-accent"
        >
          <Avatar
            name={display}
            avatarSeed={row.student.avatarSeed ?? null}
            color={row.student.color}
            size="sm"
          />
          <span className="font-medium text-app">{display}</span>
        </Link>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted">{row.totalSeen}</td>
      <td className="px-4 py-3">
        {row.totalDue > 0 ? (
          <Badge tone="warning" uppercase>
            {row.totalDue}
          </Badge>
        ) : (
          <span className="font-mono text-xs text-muted-2">0</span>
        )}
      </td>
      <td className="px-4 py-3">
        {totalAttempts === null ? (
          <span className="font-mono text-xs text-muted-2">—</span>
        ) : (
          <Badge
            tone={totalAttempts >= 80 ? "success" : totalAttempts >= 50 ? "accent" : "warning"}
            uppercase
          >
            {totalAttempts}%
          </Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {evidence?.avgAttentionScore === null || evidence?.avgAttentionScore === undefined ? (
          <span className="font-mono text-xs text-muted-2">—</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Badge tone={attentionTone(evidence.avgAttentionScore)} uppercase>
              {evidence.avgAttentionScore}
            </Badge>
            {evidence.totalReviewFlags > 0 ? (
              <span className="font-mono text-[10px] text-muted-2">
                {evidence.totalReviewFlags} flags
              </span>
            ) : null}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted">{relativeTime(row.lastPracticedAt)}</td>
      <td className="px-4 py-3 text-right">
        <Link
          to="/tutor/students/$studentId"
          params={{ studentId: String(row.student.id) }}
          className="text-xs text-muted hover:text-app"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  hint,
  to,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  to?: string;
  icon?: React.ReactNode;
}) {
  const card = (
    <TutorMetricCard
      label={label}
      value={value}
      hint={hint}
      icon={icon}
      tone={label === "Sessions" ? "success" : label === "Students" ? "secondary" : "primary"}
      className={to ? "hover:-translate-y-1 hover:shadow-lift" : undefined}
    />
  );
  if (to) {
    return (
      <Link to={to} className="block">
        {card}
      </Link>
    );
  }
  return card;
}

/**
 * Sum unit counts across books. `useQueries` keeps this hook-safe regardless
 * of how `bookIds` changes between renders, while still letting each book's
 * units cache under its own key for reuse on the content browser later.
 */
function useTotalUnitCount(bookIds: number[]): number | null {
  const queries = useQueries({
    queries: bookIds.map((id) => ({
      queryKey: queryKeys.curriculum.units(id),
      queryFn: () => api.curriculum.listUnitsByBook({ bookId: id }),
    })),
  });
  if (queries.length === 0) return 0;
  if (queries.some((q) => q.isLoading)) return null;
  return queries.reduce((acc, q) => acc + (q.data?.length ?? 0), 0);
}

function sumPracticed(rows: Array<{ totalSeen: number }>): number {
  return rows.reduce((acc, r) => acc + (r.totalSeen > 0 ? 1 : 0), 0);
}

function sumReviewFlags(rows: Array<{ totalReviewFlags: number }>): number {
  return rows.reduce((acc, r) => acc + r.totalReviewFlags, 0);
}

function attentionTone(score: number): "success" | "accent" | "warning" {
  if (score >= 85) return "success";
  if (score >= 65) return "accent";
  return "warning";
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeTime(d: Date | null): string {
  if (!d) return "never";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "just now";
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
