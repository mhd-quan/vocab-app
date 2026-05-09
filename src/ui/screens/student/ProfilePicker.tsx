import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export function StudentProfilePicker() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.students.listActive(),
    queryFn: () => api.students.listActive(),
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full border border-border-subtle bg-surface-1 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-muted">
          Student practice
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Who's practising?</h1>
        <p className="max-w-md text-sm text-muted">
          Pick your profile to see your current unit and start a flashcard session.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs text-danger"
        >
          Failed to load students: {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {isLoading
          ? ["sk-1", "sk-2", "sk-3"].map((key) => <SkeletonCard key={key} />)
          : (data ?? []).length === 0
            ? null
            : data?.map((student) => (
                <li key={student.id}>
                  <Link
                    to="/student/profile/$studentId"
                    params={{ studentId: String(student.id) }}
                    className={cn(
                      "flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-1 transition-colors",
                      "hover:border-accent/50 hover:bg-surface-2",
                    )}
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold"
                      style={{
                        backgroundColor: student.color ?? "rgb(var(--color-surface-2))",
                        color: student.color
                          ? "rgb(var(--color-accent-fg))"
                          : "rgb(var(--color-app))",
                      }}
                    >
                      {initials(student.displayName ?? student.name)}
                    </span>
                    <span className="text-sm font-medium">
                      {student.displayName ?? student.name}
                    </span>
                  </Link>
                </li>
              ))}
      </ul>

      {!isLoading && (data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle bg-surface-1 px-6 py-8 text-center">
          <h2 className="text-sm font-medium">No students yet</h2>
          <p className="mt-1 text-xs text-muted">
            Switch to tutor mode and add a student profile from{" "}
            <span className="text-app">Tutor → Students</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return <li className="h-32 animate-pulse rounded-lg border border-border-subtle bg-surface-1" />;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
