import type { Book, Unit } from "@/data/types";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Avatar } from "@/ui/components/Avatar";
import { EmptyState } from "@/ui/components/EmptyState";
import { SplitView } from "@/ui/components/SplitView";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { AchievementStrip } from "./AchievementStrip";
import { UnitStatusTrack } from "./UnitStatusTrack";

type UnitProgressRow = Awaited<ReturnType<typeof api.progress.assignedUnitProgress>>[number];

const numberFormat = new Intl.NumberFormat();

/**
 * Student home is unit-first: it answers what needs attention, where it sits
 * in the curriculum, and what state every item is in without flattening those
 * answers into a misleading completion percentage.
 */
export function StudentHome() {
  const { studentId } = useParams({ from: "/student/profile/$studentId" });
  const id = Number(studentId);
  const enabled = Number.isFinite(id) && id > 0;

  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(id),
    queryFn: () => api.students.getById({ id }),
    enabled,
  });
  const canLoadStudentData = enabled && studentQ.data != null;
  const booksQ = useQuery({
    queryKey: queryKeys.students.assignedBooks(id),
    queryFn: () => api.students.listAssignedBooks({ studentId: id }),
    enabled: canLoadStudentData,
  });
  const summaryQ = useQuery({
    queryKey: queryKeys.progress.summary(id),
    queryFn: () => api.progress.studentSummary({ studentId: id }),
    enabled: canLoadStudentData,
  });
  const assignedProgressQ = useQuery({
    queryKey: queryKeys.progress.assignedUnitProgress(id),
    queryFn: () => api.progress.assignedUnitProgress({ studentId: id }),
    enabled: canLoadStudentData,
  });
  const dictionaryLearningQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.summary(id),
    queryFn: () => api.dictionaryLearning.summary({ studentId: id }),
    enabled: canLoadStudentData,
  });

  if (!enabled) {
    return (
      <StudentHomeUnavailable title="Invalid profile" detail="Choose a learner profile again." />
    );
  }
  if (studentQ.isLoading) {
    return (
      <p role="status" className="px-8 py-10 text-sm text-muted">
        Loading learner profile…
      </p>
    );
  }
  if (studentQ.isError) {
    return (
      <StudentHomeUnavailable
        title="Learner profile is unavailable"
        detail="The profile could not be loaded."
        onRetry={() => studentQ.refetch()}
      />
    );
  }
  if (!studentQ.data) {
    return (
      <StudentHomeUnavailable
        title="Learner profile not found"
        detail="This profile may have been removed. Choose another learner."
      />
    );
  }

  const studentName = studentQ.data.displayName ?? studentQ.data.name;
  const assignedDueCount = assignedProgressQ.data?.reduce((total, row) => total + row.dueCount, 0);
  const homePrompt =
    assignedDueCount === undefined
      ? "Choose a unit from your learning path."
      : assignedDueCount > 0
        ? `${numberFormat.format(assignedDueCount)} ${assignedDueCount === 1 ? "item is" : "items are"} ready for review.`
        : "Review is up to date. Choose a unit when you are ready.";

  return (
    <SplitView
      side="trailing"
      initialSize={312}
      minSize={288}
      maxSize={376}
      label="Resize learning progress inspector"
      storageKey="vocab.student.today-pane"
      className="h-full min-h-0"
    >
      <section
        data-testid="student-learning-pane"
        aria-label="Learning path"
        className="student-learning-pane h-full min-w-0 overflow-y-auto px-7 py-6 xl:px-9"
      >
        <header className="mb-8 flex items-center gap-4">
          <Avatar
            name={studentQ.data?.displayName ?? studentQ.data?.name ?? "?"}
            avatarSeed={studentQ.data?.avatarSeed ?? null}
            color={studentQ.data?.color ?? null}
            size="lg"
            className="h-16 w-16 text-xl"
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-[30px] font-semibold leading-none tracking-[-0.025em] text-app">
              {studentQ.isLoading ? "Loading…" : studentName}
            </h1>
            <p className="mt-2 text-[13px] leading-5 text-muted">{homePrompt}</p>
          </div>
        </header>

        <div className="mb-4 border-b border-border-subtle pb-3">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.012em] text-app">
            Learning path
          </h2>
        </div>

        {assignedProgressQ.isError ? (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4"
          >
            <p className="text-xs leading-5 text-warning">
              Item status is temporarily unavailable. Units can still be opened normally.
            </p>
            <button
              type="button"
              className="ui-focus-ring rounded-control text-xs font-semibold text-accent"
              onClick={() => assignedProgressQ.refetch()}
            >
              Retry status
            </button>
          </div>
        ) : null}

        {booksQ.isLoading ? (
          <p role="status" className="py-3 text-sm text-muted">
            Loading assigned units…
          </p>
        ) : booksQ.isError ? (
          <div role="alert" className="py-3">
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
          <BookList
            studentId={id}
            books={booksQ.data ?? []}
            progressRows={assignedProgressQ.data ?? []}
            progressLoading={assignedProgressQ.isLoading}
            progressUnavailable={assignedProgressQ.isError}
          />
        )}
      </section>

      <aside
        data-testid="student-progress-inspector"
        className="inspector-material h-full overflow-y-auto px-4 py-5"
        aria-label="Learning progress"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-app">Practice record</h2>
          <span className="text-[11px] text-muted-2">Lifetime</span>
        </div>
        {summaryQ.data ? (
          <SummaryStats summary={summaryQ.data} />
        ) : summaryQ.isError ? (
          <p role="alert" className="py-4 text-xs text-warning">
            Practice totals are temporarily unavailable.
          </p>
        ) : (
          <p role="status" className="py-4 text-xs text-muted">
            Loading practice totals…
          </p>
        )}

        <section className="mt-6 border-t border-border-subtle pt-5">
          <h2 className="mb-1 text-xs font-semibold text-app">Practice tools</h2>
          <nav aria-label="Practice tools" className="divide-y divide-border-subtle">
            <PersonalVocabularyLink
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
              unavailable={dictionaryLearningQ.isError}
            />
            <PronunciationLabLink studentId={id} />
          </nav>
        </section>

        <section className="mt-6 border-t border-border-subtle pt-5">
          <h2 className="mb-3 text-xs font-semibold text-app">Achievements</h2>
          <AchievementStrip studentId={id} />
        </section>
      </aside>
    </SplitView>
  );
}

function StudentHomeUnavailable({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => unknown;
}) {
  return (
    <div className="grid h-full place-items-center px-8 py-10">
      <section className="max-w-sm text-center">
        <h1 className="font-display text-xl font-semibold text-app">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
        <div className="mt-4 flex justify-center gap-3">
          {onRetry ? (
            <button
              type="button"
              className="ui-focus-ring rounded-control text-xs font-semibold text-accent"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
          <Link
            to="/student"
            className="ui-focus-ring rounded-control text-xs font-semibold text-accent"
          >
            Choose profile
          </Link>
        </div>
      </section>
    </div>
  );
}

function SummaryStats({
  summary,
}: {
  summary: {
    totalSeen: number;
    totalCorrect: number;
    totalWrong: number;
    accuracy: number;
    totalDue: number;
  };
}) {
  const attempts = summary.totalCorrect + summary.totalWrong;
  const lifetimeAccuracy =
    attempts > 0 ? Math.round((summary.totalCorrect / attempts) * 100) : null;

  return (
    <dl className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
      <RecordMetric
        label="Items practiced"
        value={numberFormat.format(summary.totalSeen)}
        detail="Distinct items across all practice"
      />
      <RecordMetric
        label="Lifetime accuracy"
        value={lifetimeAccuracy === null ? "—" : `${lifetimeAccuracy}%`}
        detail={
          attempts > 0
            ? `${numberFormat.format(summary.totalCorrect)} correct from ${numberFormat.format(attempts)} answers`
            : "No answers recorded yet"
        }
      />
    </dl>
  );
}

function RecordMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3">
      <dt className="text-xs font-medium text-app">{label}</dt>
      <dd data-tabular className="row-span-2 text-base font-semibold text-app">
        {value}
      </dd>
      <span className="text-[11px] leading-4 text-muted">{detail}</span>
    </div>
  );
}

function PersonalVocabularyLink({
  studentId,
  summary,
  loading,
  unavailable,
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
  unavailable: boolean;
}) {
  return (
    <Link
      to="/student/profile/$studentId/personal-vocabulary"
      params={{ studentId: String(studentId) }}
      className="ui-focus-ring group flex min-h-[var(--size-row)] items-center gap-3 py-3 outline-offset-[-2px] transition-colors duration-fast hover:text-accent motion-reduce:transition-none"
    >
      <AppGlyph name="dictionary" className="h-[18px] w-[18px] text-accent" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[13px] font-medium text-app">Personal vocabulary</h3>
        <p className="mt-0.5 truncate text-[11px] leading-4 text-muted">
          {loading
            ? "Loading saved words…"
            : unavailable
              ? "Saved-word totals unavailable"
              : `${numberFormat.format(summary.total)} saved${summary.due > 0 ? ` · ${numberFormat.format(summary.due)} ready` : ""}`}
        </p>
      </div>
      <AppGlyph name="arrowRight" className="h-4 w-4 text-muted-2 group-hover:text-accent" />
    </Link>
  );
}

function PronunciationLabLink({ studentId }: { studentId: number }) {
  return (
    <Link
      to="/student/profile/$studentId/pronunciation"
      params={{ studentId: String(studentId) }}
      className="ui-focus-ring group flex min-h-[var(--size-row)] items-center gap-3 py-3 outline-offset-[-2px] transition-colors duration-fast hover:text-accent motion-reduce:transition-none"
    >
      <AppGlyph name="volume" className="h-[18px] w-[18px] text-accent" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[13px] font-medium text-app">Pronunciation lab</h3>
        <p className="mt-0.5 text-[11px] leading-4 text-muted">IPA, audio, and scoring</p>
      </div>
      <AppGlyph name="arrowRight" className="h-4 w-4 text-muted-2 group-hover:text-accent" />
    </Link>
  );
}

function BookList({
  studentId,
  books,
  progressRows,
  progressLoading,
  progressUnavailable,
}: {
  studentId: number;
  books: Book[];
  progressRows: UnitProgressRow[];
  progressLoading: boolean;
  progressUnavailable: boolean;
}) {
  const unitQueries = useQueries({
    queries: books.map((book) => ({
      queryKey: queryKeys.students.assignedUnits(studentId, book.id),
      queryFn: () => api.students.listAssignedUnits({ studentId, bookId: book.id }),
    })),
  });
  const unitQueriesLoading = unitQueries.some((query) => query.isLoading);
  const unitQueriesUnavailable = unitQueries.some((query) => query.isError);
  const unitsByBook = books.map((book, bookIndex) => ({
    book,
    units: [...(unitQueries[bookIndex]?.data ?? [])].sort(
      (left, right) => left.ordinal - right.ordinal || left.id - right.id,
    ),
    loading: unitQueries[bookIndex]?.isLoading ?? false,
    unavailable: unitQueries[bookIndex]?.isError ?? false,
  }));
  const orderedUnits = unitsByBook
    .flatMap(({ units }) => units)
    .map((unit, order) => ({
      unit,
      order,
    }));
  const recommendedUnitId =
    progressLoading || progressUnavailable || unitQueriesLoading || unitQueriesUnavailable
      ? null
      : selectRecommendedUnitId(progressRows, orderedUnits);
  const progressByUnit = useMemo(
    () => new Map(progressRows.map((row) => [row.unitId, row])),
    [progressRows],
  );

  return (
    <div className="flex flex-col gap-10">
      {unitsByBook.map(({ book, units, loading, unavailable }) => (
        <BookSection
          key={book.id}
          studentId={studentId}
          book={book}
          units={units}
          loading={loading}
          unavailable={unavailable}
          progressByUnit={progressByUnit}
          progressLoading={progressLoading}
          progressUnavailable={progressUnavailable}
          recommendedUnitId={recommendedUnitId}
        />
      ))}
    </div>
  );
}

function BookSection({
  studentId,
  book,
  units,
  loading,
  unavailable,
  progressByUnit,
  progressLoading,
  progressUnavailable,
  recommendedUnitId,
}: {
  studentId: number;
  book: Book;
  units: Unit[];
  loading: boolean;
  unavailable: boolean;
  progressByUnit: Map<number, UnitProgressRow>;
  progressLoading: boolean;
  progressUnavailable: boolean;
  recommendedUnitId: number | null;
}) {
  return (
    <section aria-labelledby={`book-${book.id}-title`}>
      <header className="flex items-baseline justify-between gap-4">
        <h2
          id={`book-${book.id}-title`}
          className="font-display text-[18px] font-semibold tracking-[-0.015em] text-app"
        >
          {book.title}
        </h2>
        {!loading && !unavailable ? (
          <span className="text-[11px] text-muted-2">
            {units.length} {units.length === 1 ? "unit" : "units"}
          </span>
        ) : null}
      </header>

      {loading ? (
        <p role="status" className="py-4 text-xs text-muted">
          Loading units…
        </p>
      ) : unavailable ? (
        <p role="alert" className="py-4 text-xs text-warning">
          Assigned units are unavailable.
        </p>
      ) : units.length === 0 ? (
        <p className="py-4 text-xs text-muted-2">No assigned units in this book.</p>
      ) : (
        <ul data-testid="book-unit-list" className="student-unit-grid mt-3">
          {units.map((unit) => (
            <AssignedUnitCard
              key={unit.id}
              studentId={studentId}
              unit={unit}
              progress={progressByUnit.get(unit.id)}
              progressLoading={progressLoading}
              progressUnavailable={progressUnavailable}
              recommended={recommendedUnitId === unit.id}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AssignedUnitCard({
  studentId,
  unit,
  progress,
  progressLoading,
  progressUnavailable,
  recommended,
}: {
  studentId: number;
  unit: Unit;
  progress: UnitProgressRow | undefined;
  progressLoading: boolean;
  progressUnavailable: boolean;
  recommended: boolean;
}) {
  const missingProgress = !progressLoading && !progressUnavailable && progress === undefined;

  return (
    <li data-testid="unit-learning-object" className="min-w-0">
      <Link
        to="/student/profile/$studentId/unit/$unitId"
        params={{ studentId: String(studentId), unitId: String(unit.id) }}
        data-recommended={recommended ? "true" : undefined}
        className="ui-focus-ring group flex h-full min-h-[164px] flex-col border-t border-border-subtle py-4 text-sm outline-offset-2 transition-[border-color,color] duration-fast hover:border-border-strong motion-reduce:transition-none"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[11px] font-medium text-muted-2">{unit.code}</span>
          {recommended ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-app">
              <span data-testid="review-now-action">Review now</span>
              <AppGlyph name="arrowRight" className="h-4 w-4" />
            </span>
          ) : (
            <AppGlyph
              name="arrowRight"
              className="h-4 w-4 text-muted-2 transition-colors duration-fast group-hover:text-accent motion-reduce:transition-none"
            />
          )}
        </div>

        <h3 className="mt-2 font-display text-[18px] font-semibold leading-6 tracking-[-0.012em] text-app transition-colors duration-fast group-hover:text-accent motion-reduce:transition-none">
          {unit.title}
        </h3>
        {unit.summaryMd ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{unit.summaryMd}</p>
        ) : null}

        {progressUnavailable ? null : (
          <div className="mt-auto pt-5">
            {missingProgress ? (
              <p className="text-xs text-warning">Progress is temporarily unavailable.</p>
            ) : progressLoading ? (
              <p role="status" className="text-xs text-muted">
                Loading item status…
              </p>
            ) : progress && progress.totalCount > 0 ? (
              <UnitStatusTrack
                label={`${unit.code} ${unit.title}`}
                totalCount={progress.totalCount}
                reviewNowCount={progress.dueCount}
                learningCurrentCount={progress.learningCurrentCount}
                secureCurrentCount={progress.secureCurrentCount}
                newCount={progress.newCount}
                dueLearningCount={progress.dueLearningCount}
                dueSecureCount={progress.dueSecureCount}
              />
            ) : (
              <p className="text-xs text-muted">No practice items yet.</p>
            )}
          </div>
        )}
      </Link>
    </li>
  );
}

function selectRecommendedUnitId(
  progressRows: UnitProgressRow[],
  orderedUnits: Array<{ unit: Unit; order: number }>,
): number | null {
  const curriculumOrder = new Map(orderedUnits.map(({ unit, order }) => [unit.id, order]));
  const candidates = progressRows.filter(
    (row) => row.dueCount > 0 && curriculumOrder.has(row.unitId),
  );

  candidates.sort((left, right) => {
    const leftOldest = dueTimestamp(left.oldestDueAt);
    const rightOldest = dueTimestamp(right.oldestDueAt);
    if (leftOldest !== rightOldest) return leftOldest < rightOldest ? -1 : 1;

    const leftRatio = left.dueCount / Math.max(left.totalCount, 1);
    const rightRatio = right.dueCount / Math.max(right.totalCount, 1);
    if (leftRatio !== rightRatio) return rightRatio - leftRatio;
    if (left.dueCount !== right.dueCount) return right.dueCount - left.dueCount;
    return (curriculumOrder.get(left.unitId) ?? 0) - (curriculumOrder.get(right.unitId) ?? 0);
  });

  return candidates[0]?.unitId ?? null;
}

function dueTimestamp(value: UnitProgressRow["oldestDueAt"]): number {
  // A null due date is an introduced item with no future schedule. It is due
  // immediately and must not be pushed behind items with known overdue dates.
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export { selectRecommendedUnitId };
