import type { Book, Lesson, Unit } from "@/data/types";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

interface UnitWithLessons {
  unit: Unit;
  lessons: Array<Lesson & { vocabCount: number }>;
}

/**
 * The student's home screen: identifies the student, then surfaces what
 * they can practise right now. Each vocab lesson shows three counters:
 *   - total entries imported,
 *   - due now (item_progress.next_due_at ≤ now), and
 *   - never seen (no item_progress row yet).
 * The numbers come from `progress.dueByLesson` (PR #8).
 */
export function StudentHome() {
  const { studentId } = useParams({ from: "/student/profile/$studentId" });
  const id = Number(studentId);

  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(id),
    queryFn: () => api.students.getById({ id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const booksQ = useQuery({
    queryKey: queryKeys.curriculum.books(),
    queryFn: () => api.curriculum.listBooks(),
  });

  const summaryQ = useQuery({
    queryKey: queryKeys.progress.summary(id),
    queryFn: () => api.progress.studentSummary({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <Link to="/student" className="self-start text-xs text-muted hover:text-app">
        ← Back to profiles
      </Link>

      <header className="flex items-center gap-4">
        <Avatar
          name={studentQ.data?.displayName ?? studentQ.data?.name ?? "?"}
          color={studentQ.data?.color ?? null}
          size="lg"
        />
        <div className="flex flex-1 flex-col">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted">
            Student
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            {studentQ.isLoading
              ? "Loading…"
              : (studentQ.data?.displayName ?? studentQ.data?.name ?? "Unknown student")}
          </h1>
        </div>
        {summaryQ.data && summaryQ.data.totalSeen > 0 ? (
          <SummaryStats summary={summaryQ.data} />
        ) : null}
      </header>

      {booksQ.isLoading ? (
        <p className="text-sm text-muted">Loading lessons…</p>
      ) : (booksQ.data ?? []).length === 0 ? (
        <EmptyState
          title="No content yet"
          body="Switch to tutor mode and run `npm run import` to load vocabulary lessons."
        />
      ) : (
        <BookList studentId={id} books={booksQ.data ?? []} />
      )}
    </div>
  );
}

function SummaryStats({
  summary,
}: {
  summary: { totalSeen: number; totalDue: number; accuracy: number };
}) {
  const accuracyPct = Math.round(summary.accuracy * 100);
  return (
    <dl className="flex shrink-0 items-center gap-4 text-right text-xs text-muted">
      <div className="flex flex-col">
        <dt className="text-[10px] uppercase tracking-widest text-muted-2">Seen</dt>
        <dd className="font-mono text-sm text-app">{summary.totalSeen}</dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-[10px] uppercase tracking-widest text-muted-2">Due</dt>
        <dd className="font-mono text-sm text-app">{summary.totalDue}</dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-[10px] uppercase tracking-widest text-muted-2">Accuracy</dt>
        <dd className="font-mono text-sm text-app">{accuracyPct}%</dd>
      </div>
    </dl>
  );
}

function BookList({ studentId, books }: { studentId: number; books: Book[] }) {
  return (
    <ul className="flex flex-col gap-6">
      {books.map((book) => (
        <BookSection key={book.id} studentId={studentId} book={book} />
      ))}
    </ul>
  );
}

function BookSection({ studentId, book }: { studentId: number; book: Book }) {
  const unitsQ = useQuery({
    queryKey: queryKeys.curriculum.units(book.id),
    queryFn: () => api.curriculum.listUnitsByBook({ bookId: book.id }),
  });
  const units = unitsQ.data ?? [];

  return (
    <li className="flex flex-col gap-3">
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{book.title}</h2>
        <span className="font-mono text-[10px] text-muted-2">{book.code}</span>
      </header>
      {unitsQ.isLoading ? (
        <p className="text-xs text-muted">Loading units…</p>
      ) : units.length === 0 ? (
        <p className="text-xs text-muted-2">No units imported yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {units.map((unit) => (
            <UnitGroup key={unit.id} studentId={studentId} unit={unit} />
          ))}
        </ul>
      )}
    </li>
  );
}

function UnitGroup({ studentId, unit }: { studentId: number; unit: Unit }) {
  const lessonsQ = useQuery({
    queryKey: queryKeys.curriculum.lessons(unit.id),
    queryFn: () => api.curriculum.listLessonsByUnit({ unitId: unit.id }),
  });
  const lessons = (lessonsQ.data ?? []).filter((l) => l.kind === "vocabulary");

  // Due / new / total are all derivable from one IPC call per lesson —
  // batched here via useQueries so they share the renderer's cache and
  // fire in parallel.
  const dueQs = useQueries({
    queries: lessons.map((lesson) => ({
      queryKey: queryKeys.progress.dueByLesson(studentId, lesson.id),
      queryFn: () => api.progress.dueByLesson({ studentId, lessonId: lesson.id }),
    })),
  });

  if (lessonsQ.isLoading) {
    return <p className="text-xs text-muted">Loading lessons…</p>;
  }
  if (lessons.length === 0) return null;

  return (
    <li className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <header className="mb-3 flex items-baseline gap-2">
        <span className="font-mono text-[11px] text-muted-2">{unit.code}</span>
        <h3 className="text-sm font-medium">{unit.title}</h3>
      </header>
      <ul className="flex flex-col gap-2">
        {lessons.map((lesson, i) => {
          const stats = dueQs[i]?.data;
          const totalCount = stats?.totalCount ?? 0;
          const dueCount = stats?.dueCount ?? 0;
          const newCount = stats?.newCount ?? totalCount;
          return (
            <li key={lesson.id}>
              <LessonRow
                studentId={studentId}
                lesson={lesson}
                totalCount={totalCount}
                dueCount={dueCount}
                newCount={newCount}
              />
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function LessonRow({
  studentId,
  lesson,
  totalCount,
  dueCount,
  newCount,
}: {
  studentId: number;
  lesson: Lesson;
  totalCount: number;
  dueCount: number;
  newCount: number;
}) {
  if (totalCount === 0) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-0/50 px-3 py-2 text-sm opacity-60">
        <span className="text-muted">{lesson.title}</span>
        <span className="text-[10px] text-muted-2">no entries</span>
      </div>
    );
  }
  const reviewCount = dueCount + newCount;
  return (
    <Link
      to="/student/profile/$studentId/session/$lessonId"
      params={{ studentId: String(studentId), lessonId: String(lesson.id) }}
      className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-0/50 px-3 py-2 text-sm transition-colors hover:border-accent/50 hover:bg-surface-2"
    >
      <div className="flex items-center gap-2">
        <Badge tone="accent" uppercase>
          Vocab
        </Badge>
        <span className="font-medium">{lesson.title}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        {dueCount > 0 ? (
          <Badge tone="warning" uppercase>
            {dueCount} due
          </Badge>
        ) : null}
        {newCount > 0 ? (
          <Badge tone="muted" uppercase>
            {newCount} new
          </Badge>
        ) : null}
        {reviewCount === 0 ? (
          <Badge tone="success" uppercase>
            All caught up
          </Badge>
        ) : null}
        <span className="font-mono text-[10px] text-muted-2">{totalCount}</span>
        <span aria-hidden>→</span>
      </div>
    </Link>
  );
}

// Re-export so consumers can build their own UnitWithLessons-shaped views.
export type { UnitWithLessons };
