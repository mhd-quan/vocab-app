import { api } from "@/lib/api";
import { Button } from "@/ui/components/Button";
import { PlaceholderPanel } from "@/ui/components/PlaceholderPanel";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

export function StudentHome() {
  const { studentId } = useParams({ from: "/student/profile/$studentId" });
  const id = Number(studentId);
  const { data, isLoading } = useQuery({
    queryKey: ["students", "byId", id],
    queryFn: () => api.students.getById({ id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
      <Link to="/student" className="self-start text-xs text-muted hover:text-app">
        ← Back to profiles
      </Link>
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted">
          Student
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isLoading ? "Loading…" : (data?.displayName ?? data?.name ?? "Unknown student")}
        </h1>
      </header>
      <PlaceholderPanel
        title="Practice session UI"
        body="The flashcard / multiple-choice / fill-blank player runs here once the exercise engine lands in PR #6 (engine) and PR #7 (student player)."
        hint="Spaced repetition + reward feedback follow in PR #8 / #9."
      >
        <div className="mt-4 flex gap-2">
          <Button disabled>Start flashcard session</Button>
          <Button variant="secondary" disabled>
            Review weak words
          </Button>
        </div>
      </PlaceholderPanel>
    </div>
  );
}
