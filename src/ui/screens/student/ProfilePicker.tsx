import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export function StudentProfilePicker() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.students.listActive(),
    queryFn: () => api.students.listActive(),
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-8 py-12">
      <header className="flex flex-col gap-3">
        <Badge tone="xp" uppercase className="w-fit">
          Student practice
        </Badge>
        <div className="grid gap-3 md:grid-cols-[1fr_18rem] md:items-end">
          <div>
            <h1 className="text-4xl font-semibold leading-tight">Who's practising?</h1>
            <p className="mt-2 max-w-xl text-base text-muted">
              Pick a profile and jump straight back into the next vocabulary session.
            </p>
          </div>
          <BentoCard as="div" tone="focus" className="p-4">
            <p className="text-xs font-semibold uppercase text-focus">Today</p>
            <p className="mt-1 text-sm text-muted">Fresh run waiting.</p>
          </BentoCard>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs text-danger"
        >
          Failed to load students: {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
                      "group flex min-h-44 flex-col justify-between rounded-bento border border-border-subtle bg-surface-1 p-5 shadow-card transition-[background-color,border-color,box-shadow,transform]",
                      "hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2 hover:shadow-lift",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Avatar
                        name={student.displayName ?? student.name}
                        color={student.color}
                        size="lg"
                      />
                      <span
                        aria-hidden
                        className="grid h-9 w-9 place-items-center rounded-full border border-border-subtle text-muted transition-colors group-hover:border-accent/40 group-hover:text-accent"
                      >
                        &gt;
                      </span>
                    </div>
                    <div>
                      <span className="text-lg font-semibold">
                        {student.displayName ?? student.name}
                      </span>
                      <p className="mt-1 text-sm text-muted">Ready to practise</p>
                    </div>
                  </Link>
                </li>
              ))}
      </ul>

      {!isLoading && (data ?? []).length === 0 ? (
        <div className="rounded-bento border border-dashed border-border-subtle bg-surface-1 px-6 py-8 text-center">
          <h2 className="text-base font-semibold">No students yet</h2>
          <p className="mt-1 text-xs text-muted">
            Switch to tutor mode and add a student profile from{" "}
            <span className="text-app">Tutor - Students</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <li className="min-h-44 animate-pulse rounded-bento border border-border-subtle bg-surface-1 shadow-card" />
  );
}
