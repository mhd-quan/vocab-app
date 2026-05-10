import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

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

      <section className="grid grid-cols-1 gap-3 px-8 py-6 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Books"
          value={booksQ.isLoading ? "…" : String(books.length)}
          hint={books.length === 0 ? "Run npm run import" : "imported"}
          to="/tutor/content"
        />
        <Stat
          label="Units"
          value={totalUnits === null ? "…" : String(totalUnits)}
          hint="across all books"
          to="/tutor/content"
        />
        <Stat
          label="Students"
          value={studentsQ.isLoading ? "…" : String(students.length)}
          hint="active profiles"
          to="/tutor/students"
        />
        <Stat
          label="Sessions"
          value={overviewQ.data ? String(sumPracticed(overviewQ.data)) : "…"}
          hint="have practised"
        />
      </section>

      <section className="px-8 pb-10">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Students</h2>
          <Link to="/tutor/students" className="text-xs text-muted hover:text-app">
            Manage →
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
          <StudentTable rows={overviewQ.data ?? []} />
        )}
      </section>
    </>
  );
}

function StudentTable({
  rows,
}: {
  rows: Array<{
    student: {
      id: number;
      name: string;
      displayName: string | null;
      color: string | null;
    };
    totalSeen: number;
    totalDue: number;
    accuracy: number;
    lastPracticedAt: Date | null;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-subtle bg-surface-2 text-[10px] uppercase tracking-widest text-muted-2">
          <tr>
            <th className="px-4 py-2 font-medium">Student</th>
            <th className="px-4 py-2 font-medium">Seen</th>
            <th className="px-4 py-2 font-medium">Due</th>
            <th className="px-4 py-2 font-medium">Accuracy</th>
            <th className="px-4 py-2 font-medium">Last practised</th>
            <th aria-hidden className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StudentRow key={row.student.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentRow({
  row,
}: {
  row: {
    student: {
      id: number;
      name: string;
      displayName: string | null;
      color: string | null;
    };
    totalSeen: number;
    totalDue: number;
    accuracy: number;
    lastPracticedAt: Date | null;
  };
}) {
  const display = row.student.displayName ?? row.student.name;
  const totalAttempts = row.totalSeen > 0 ? Math.round(row.accuracy * 100) : null;
  return (
    <tr className="border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface-2">
      <td className="px-4 py-2.5">
        <Link
          to="/tutor/students/$studentId"
          params={{ studentId: String(row.student.id) }}
          className="flex items-center gap-3 hover:text-accent"
        >
          <Avatar name={display} color={row.student.color} size="sm" />
          <span className="font-medium text-app">{display}</span>
        </Link>
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-muted">{row.totalSeen}</td>
      <td className="px-4 py-2.5">
        {row.totalDue > 0 ? (
          <Badge tone="warning" uppercase>
            {row.totalDue}
          </Badge>
        ) : (
          <span className="font-mono text-xs text-muted-2">0</span>
        )}
      </td>
      <td className="px-4 py-2.5">
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
      <td className="px-4 py-2.5 text-xs text-muted">{relativeTime(row.lastPracticedAt)}</td>
      <td className="px-4 py-2.5 text-right">
        <Link
          to="/tutor/students/$studentId"
          params={{ studentId: String(row.student.id) }}
          className="text-xs text-muted hover:text-app"
        >
          Open →
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
}: {
  label: string;
  value: string;
  hint?: string;
  to?: string;
}) {
  const card = (
    <div className="flex h-full flex-col justify-between rounded-lg border border-border-subtle bg-surface-1 p-5 transition-colors hover:border-border-strong">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <span className="mt-3 font-mono text-3xl text-app">{value}</span>
      {hint ? <span className="mt-1 text-xs text-muted-2">{hint}</span> : null}
    </div>
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
