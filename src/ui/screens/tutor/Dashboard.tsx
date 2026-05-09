import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { PageHeader } from "@/ui/components/PageHeader";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export function TutorDashboard() {
  const booksQ = useQuery({
    queryKey: queryKeys.curriculum.books(),
    queryFn: () => api.curriculum.listBooks(),
  });
  const studentsQ = useQuery({
    queryKey: queryKeys.students.listActive(),
    queryFn: () => api.students.listActive(),
  });
  const appInfoQ = useQuery({
    queryKey: queryKeys.meta.appInfo(),
    queryFn: () => api.meta.appInfo(),
  });

  const books = booksQ.data ?? [];
  const students = studentsQ.data ?? [];
  const totalUnits = useTotalUnitCount(books.map((b) => b.id));

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Tutor dashboard"
        subtitle="Quick view of what's loaded in the local database. Detailed views land in the content browser and analytics screens."
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
          label="Schema"
          value={appInfoQ.data ? `${appInfoQ.data.schemaTablesExpected} tables` : "…"}
          hint="v0.0.1"
        />
      </section>

      <section className="px-8 pb-10">
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Getting started
          </h2>
          <ol className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <li>
              <span className="text-app">1.</span> Edit YAML in{" "}
              <code className="text-xs text-app">content/books/...</code>
            </li>
            <li>
              <span className="text-app">2.</span> Run{" "}
              <code className="text-xs text-app">npm run import</code> — re-runs are idempotent.
            </li>
            <li>
              <span className="text-app">3.</span> Browse imported content here once PR #6 lands.
            </li>
          </ol>
        </div>
      </section>
    </>
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
