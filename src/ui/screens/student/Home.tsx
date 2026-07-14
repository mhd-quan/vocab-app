import type { Book, Lesson, Unit } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { summarizeStudentProgress } from "@/modules/rewards";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Avatar } from "@/ui/components/Avatar";
import { EmptyState } from "@/ui/components/EmptyState";
import { AccuracyIcon, DueIcon, LessonIcon, SeenIcon } from "@/ui/components/LearningIcons";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { SplitView } from "@/ui/components/SplitView";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AchievementStrip } from "./AchievementStrip";

interface UnitWithLessons {
  unit: Unit;
  lessons: Lesson[];
}

/**
 * Student home is intentionally unit-first. Tutors decide which units a
 * learner can see; the learner picks a unit, then chooses the exact section
 * to practise on the unit study screen.
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
    queryKey: queryKeys.students.assignedBooks(id),
    queryFn: () => api.students.listAssignedBooks({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

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

  const dictionaryLearningQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.summary(id),
    queryFn: () => api.dictionaryLearning.summary({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const studentName = studentQ.data?.displayName ?? studentQ.data?.name ?? "Unknown student";
  const homePrompt = summaryQ.data
    ? summaryQ.data.totalDue > 0
      ? `${summaryQ.data.totalDue} items are ready for review. Your next unit is marked below.`
      : "You are caught up. Start a new unit when you are ready."
    : "Choose a unit from your learning path.";

  return (
    <SplitView
      side="trailing"
      initialSize={304}
      minSize={272}
      maxSize={384}
      label="Resize learning progress inspector"
      storageKey="vocab.student.today-pane"
      className="h-full min-h-0"
    >
      <section
        data-testid="student-learning-pane"
        aria-label="Learning path"
        className="h-full min-w-0 overflow-y-auto px-6 py-5"
      >
        <header className="mb-5 flex items-center gap-3">
          <Avatar
            name={studentQ.data?.displayName ?? studentQ.data?.name ?? "?"}
            avatarSeed={studentQ.data?.avatarSeed ?? null}
            color={studentQ.data?.color ?? null}
            size="md"
          />
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.02em]">
              {studentQ.isLoading ? "Loading…" : studentName}
            </h1>
            <p className="mt-1 text-[13px] text-muted">{homePrompt}</p>
          </div>
        </header>

        {booksQ.isLoading ? (
          <p className="text-sm text-muted">Loading assigned units…</p>
        ) : booksQ.isError ? (
          <div role="alert" className="learning-trace py-2 pl-4">
            <p className="text-sm font-medium text-app">The learning path is unavailable</p>
            <button
              type="button"
              className="ui-focus-ring mt-2 rounded-control text-xs font-semibold text-accent"
              onClick={() => booksQ.refetch()}
            >
              Retry
            </button>
          </div>
        ) : (booksQ.data ?? []).length === 0 ? (
          <EmptyState
            title="No assigned units yet"
            body="Ask your tutor to assign a book unit before starting practice."
          />
        ) : (
          <BookList studentId={id} books={booksQ.data ?? []} />
        )}
      </section>

      <aside
        data-testid="student-progress-inspector"
        className="inspector-material h-full overflow-y-auto px-4 py-5"
        aria-label="Learning progress"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Progress</h2>
          <span className="text-[11px] text-muted-2">Across all practice</span>
        </div>
        {summaryQ.data ? (
          <SummaryStats
            summary={summaryQ.data}
            streak={streakQ.data?.currentStreak ?? 0}
            practicedToday={streakQ.data?.practicedToday ?? false}
          />
        ) : summaryQ.isError ? (
          <p role="alert" className="py-4 text-xs text-warning">
            Progress is temporarily unavailable.
          </p>
        ) : (
          <p className="py-4 text-xs text-muted">Loading progress…</p>
        )}

        <section className="mt-6 border-t border-border-subtle pt-5">
          <h2 className="mb-2 text-xs font-semibold">Practice tools</h2>
          <div className="ui-group bg-surface-2">
            <PersonalVocabularyCard
              studentId={id}
              summary={
                dictionaryLearningQ.data ?? {
                  total: 0,
                  due: 0,
                  learning: 0,
                  shortTerm: 0,
                  longTerm: 0,
                  averageScore: 0,
                }
              }
              loading={dictionaryLearningQ.isLoading}
            />
            <PronunciationLabCard studentId={id} />
          </div>
        </section>

        <section className="mt-6 border-t border-border-subtle pt-5">
          <h2 className="mb-3 text-xs font-semibold">Achievements</h2>
          <AchievementStrip studentId={id} />
        </section>
      </aside>
    </SplitView>
  );
}

function PronunciationLabCard({ studentId }: { studentId: number }) {
  return (
    <Link
      to="/student/profile/$studentId/pronunciation"
      params={{ studentId: String(studentId) }}
      className="ui-focus-ring group flex min-h-[var(--size-row)] items-center gap-3 border-t border-border-subtle px-3 py-2.5 outline-offset-[-2px] transition-colors hover:bg-surface-3/60"
    >
      <AppGlyph name="volume" className="h-5 w-5 text-accent" />
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">Pronunciation lab</h3>
        <p className="mt-0.5 text-xs leading-4 text-muted">IPA, audio, and scoring.</p>
      </div>
      <AppGlyph name="arrowRight" className="h-4 w-4 text-muted-2 group-hover:text-app" />
    </Link>
  );
}

function PersonalVocabularyCard({
  studentId,
  summary,
  loading,
}: {
  studentId: number;
  summary: {
    total: number;
    due: number;
    learning: number;
    shortTerm: number;
    longTerm: number;
    averageScore: number;
  };
  loading: boolean;
}) {
  const hasDue = summary.due > 0;
  return (
    <Link
      to="/student/profile/$studentId/personal-vocabulary"
      params={{ studentId: String(studentId) }}
      className={cn(
        "ui-focus-ring group block px-3 py-3 outline-offset-[-2px] transition-colors hover:bg-surface-3/60",
        hasDue && "bg-accent/[0.04]",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <AppGlyph name="dictionary" className="h-5 w-5 text-accent" />
          <h3 className="font-medium">Personal vocabulary</h3>
          {hasDue ? (
            <span className="text-[11px] font-medium text-warning">{summary.due} due</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-4 text-muted">Words saved from dictionary searches.</p>
      </div>
      <dl className="mt-3 flex items-center gap-4">
        <MiniStat label="Words" value={loading ? "..." : String(summary.total)} />
        <MiniStat label="Learning" value={loading ? "..." : String(summary.learning)} />
        <MiniStat label="Score" value={loading ? "..." : `${summary.averageScore}%`} />
      </dl>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-2">{label}</dt>
      <dd data-tabular className="text-xs font-medium text-app">
        {value}
      </dd>
    </div>
  );
}

function SummaryStats({
  summary,
  streak,
  practicedToday,
}: {
  summary: {
    totalSeen: number;
    totalDue: number;
    totalCorrect: number;
    totalWrong: number;
    accuracy: number;
  };
  streak: number;
  practicedToday: boolean;
}) {
  const progress = summarizeStudentProgress({
    totalSeen: summary.totalSeen,
    totalCorrect: summary.totalCorrect,
    totalWrong: summary.totalWrong,
    accuracy: summary.accuracy,
    streakDays: streak,
    practicedToday,
  });
  return (
    <section className="mt-3">
      <div className="flex items-start justify-between gap-3 pb-4">
        <div>
          <h2 className="font-medium text-app">{progress.headline}</h2>
          <p className="mt-1 text-xs leading-4 text-muted">{progress.note}</p>
        </div>
      </div>
      <dl className="divide-y divide-border-subtle">
        <SummaryMetric
          label="Words seen"
          value={progress.wordsLabel}
          icon={<SeenIcon className="h-4 w-4 text-accent" />}
        />
        <SummaryMetric
          label="Streak"
          value={streak > 0 ? `${streak}d` : "0d"}
          icon={<AppGlyph name="flame" className="h-4 w-4 text-warning" />}
        />
        <SummaryMetric
          label="Due"
          value={String(summary.totalDue)}
          icon={
            <DueIcon
              className={summary.totalDue > 0 ? "h-4 w-4 text-warning" : "h-4 w-4 text-success"}
            />
          }
        />
        <SummaryMetric
          label="Accuracy"
          value={`${progress.accuracyPct}%`}
          icon={<AccuracyIcon className="h-4 w-4 text-accent" />}
        />
      </dl>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd data-tabular className="text-sm font-semibold text-app">
        {value}
      </dd>
      <span className="text-muted-2">{icon}</span>
    </div>
  );
}

function BookList({ studentId, books }: { studentId: number; books: Book[] }) {
  const [priorities, setPriorities] = useState<Record<number, { priority: number; order: number }>>(
    {},
  );
  const reportPriority = useCallback(
    (unitId: number, priority: number, order: number) =>
      setPriorities((current) => {
        const existing = current[unitId];
        if (existing?.priority === priority && existing.order === order) return current;
        return { ...current, [unitId]: { priority, order } };
      }),
    [],
  );
  const recommendedUnitId = useMemo(
    () =>
      Object.entries(priorities)
        .sort(([, a], [, b]) => a.priority - b.priority || a.order - b.order)
        .map(([unitId]) => Number(unitId))[0] ?? null,
    [priorities],
  );

  return (
    <ul className="flex flex-col gap-8">
      {books.map((book, bookIndex) => (
        <BookSection
          key={book.id}
          studentId={studentId}
          book={book}
          bookIndex={bookIndex}
          recommendedUnitId={recommendedUnitId}
          onPriority={reportPriority}
        />
      ))}
    </ul>
  );
}

function BookSection({
  studentId,
  book,
  bookIndex,
  recommendedUnitId,
  onPriority,
}: {
  studentId: number;
  book: Book;
  bookIndex: number;
  recommendedUnitId: number | null;
  onPriority: (unitId: number, priority: number, order: number) => void;
}) {
  const unitsQ = useQuery({
    queryKey: queryKeys.students.assignedUnits(studentId, book.id),
    queryFn: () => api.students.listAssignedUnits({ studentId, bookId: book.id }),
  });
  const units = unitsQ.data ?? [];

  return (
    <li className="flex flex-col gap-3">
      <header className="flex items-end justify-between gap-3 pb-1">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.012em]">{book.title}</h2>
          <span className="font-mono text-xs text-muted-2">{book.code}</span>
        </div>
      </header>
      {unitsQ.isLoading ? (
        <p className="text-xs text-muted">Loading units…</p>
      ) : unitsQ.isError ? (
        <p role="alert" className="text-xs text-warning">
          Assigned units are unavailable.
        </p>
      ) : units.length === 0 ? (
        <p className="text-xs text-muted-2">No assigned units in this book.</p>
      ) : (
        <ul data-testid="book-unit-list" className="ui-group bg-surface-1">
          {units.map((unit, unitIndex) => (
            <AssignedUnitCard
              key={unit.id}
              studentId={studentId}
              unit={unit}
              order={bookIndex * 1_000 + unitIndex}
              recommended={recommendedUnitId === unit.id}
              onPriority={onPriority}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function AssignedUnitCard({
  studentId,
  unit,
  order,
  recommended,
  onPriority,
}: {
  studentId: number;
  unit: Unit;
  order: number;
  recommended: boolean;
  onPriority: (unitId: number, priority: number, order: number) => void;
}) {
  const lessonsQ = useQuery({
    queryKey: queryKeys.curriculum.lessons(unit.id),
    queryFn: () => api.curriculum.listLessonsByUnit({ unitId: unit.id }),
  });
  const lessons = lessonsQ.data ?? [];

  // Due / new / total are all derivable from one IPC call per lesson —
  // batched here via useQueries so they share the renderer's cache and
  // fire in parallel.
  const dueQs = useQueries({
    queries: lessons.map((lesson) => ({
      queryKey: queryKeys.progress.dueByLesson(studentId, lesson.id),
      queryFn: () => api.progress.dueByLesson({ studentId, lessonId: lesson.id }),
    })),
  });
  const progressLoading = dueQs.some((query) => query.isLoading);
  const progressUnavailable = lessonsQ.isError || dueQs.some((query) => query.isError);

  const totals = lessons.reduce(
    (acc, lesson, index) => {
      const stats = dueQs[index]?.data;
      acc.totalCount += stats?.totalCount ?? 0;
      acc.dueCount += stats?.dueCount ?? 0;
      acc.newCount += stats?.newCount ?? stats?.totalCount ?? 0;
      if (lesson.kind === "grammar") acc.hasGrammar = true;
      if (lesson.kind === "vocabulary") acc.hasVocab = true;
      return acc;
    },
    { totalCount: 0, dueCount: 0, newCount: 0, hasGrammar: false, hasVocab: false },
  );

  const reviewCount = totals.dueCount + totals.newCount;
  const completedCount = Math.max(totals.totalCount - reviewCount, 0);
  const contentTypes = [totals.hasVocab ? "Vocabulary" : null, totals.hasGrammar ? "Grammar" : null]
    .filter(Boolean)
    .join(" + ");

  const traceTone =
    reviewCount === 0 && totals.totalCount > 0
      ? "bg-success"
      : totals.dueCount > 0
        ? "bg-warning"
        : "bg-accent";
  const priority = progressUnavailable ? 99 : totals.dueCount > 0 ? 0 : totals.newCount > 0 ? 1 : 2;

  useEffect(() => {
    if (lessonsQ.isLoading || progressLoading) return;
    onPriority(unit.id, priority, order);
  }, [lessonsQ.isLoading, onPriority, order, priority, progressLoading, unit.id]);

  if (lessonsQ.isLoading) {
    return (
      <li className="border-b border-border-subtle px-5 py-6 text-xs text-muted last:border-b-0">
        Loading lessons…
      </li>
    );
  }

  const actionLabel =
    progressUnavailable || !recommended
      ? "Open"
      : totals.dueCount > 0
        ? "Review next"
        : totals.newCount > 0
          ? "Start next"
          : "Continue";

  return (
    <li
      data-testid="unit-learning-object"
      className="border-b border-border-subtle last:border-b-0"
    >
      <Link
        to="/student/profile/$studentId/unit/$unitId"
        params={{ studentId: String(studentId), unitId: String(unit.id) }}
        className="ui-focus-ring group relative grid min-h-28 gap-4 overflow-hidden bg-surface-1 px-5 py-4 pl-6 text-sm outline-offset-[-2px] transition-colors hover:bg-surface-2/65 active:bg-surface-3/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        <span
          aria-hidden
          className={cn("absolute inset-y-4 left-0 w-[3px] rounded-r-sm", traceTone)}
        />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <LessonIcon className="h-[18px] w-[18px] text-accent" />
            <span className="truncate text-[15px] font-semibold">
              {unit.code}: {unit.title}
            </span>
            {contentTypes ? <span className="text-xs text-muted-2">{contentTypes}</span> : null}
          </div>
          {unit.summaryMd ? (
            <p className="mt-2 line-clamp-2 max-w-2xl text-[13px] leading-5 text-muted">
              {unit.summaryMd}
            </p>
          ) : null}
          {progressUnavailable ? (
            <p className="mt-3 text-xs text-warning">
              Progress is unavailable. Open the unit to retry.
            </p>
          ) : progressLoading ? (
            <p role="status" className="mt-3 text-xs text-muted">
              Loading progress…
            </p>
          ) : (
            <ProgressMeter
              value={completedCount}
              max={totals.totalCount}
              label={`${unit.title} progress`}
              tone={
                reviewCount === 0 && totals.totalCount > 0
                  ? "success"
                  : totals.dueCount > 0
                    ? "warning"
                    : "accent"
              }
              className="mt-3 max-w-xl"
            />
          )}
        </div>
        <div className="flex min-w-40 items-center gap-3 sm:justify-end">
          <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:justify-end">
            {!progressLoading && !progressUnavailable && totals.dueCount > 0 ? (
              <span className="font-medium text-warning">{totals.dueCount} due</span>
            ) : null}
            {!progressLoading && !progressUnavailable && totals.newCount > 0 ? (
              <span className="text-muted">{totals.newCount} new</span>
            ) : null}
            {!progressLoading &&
            !progressUnavailable &&
            reviewCount === 0 &&
            totals.totalCount > 0 ? (
              <span className="font-medium text-success">All caught up</span>
            ) : null}
            {!progressLoading && !progressUnavailable && totals.totalCount === 0 ? (
              <span className="text-muted">No cards yet</span>
            ) : null}
            {!progressLoading && !progressUnavailable ? (
              <span data-tabular className="text-muted-2">
                {totals.totalCount} items
              </span>
            ) : null}
          </div>
          <span
            className={cn(
              "text-xs font-semibold",
              recommended && totals.dueCount > 0 ? "text-warning" : "text-accent",
            )}
          >
            {actionLabel}
          </span>
          <AppGlyph
            name="arrowRight"
            className="h-4 w-4 text-muted-2 transition-colors group-hover:text-accent"
          />
        </div>
      </Link>
    </li>
  );
}

// Re-export so consumers can build their own UnitWithLessons-shaped views.
export type { UnitWithLessons };
