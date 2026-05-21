import type { Book, Lesson, Unit } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { summarizeStudentProgress } from "@/modules/rewards";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { EmptyState } from "@/ui/components/EmptyState";
import {
  AccuracyIcon,
  DueIcon,
  LessonIcon,
  SeenIcon,
  StreakFlame,
} from "@/ui/components/LearningIcons";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { MascotIcon } from "@/ui/student/components/MascotIcon";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-8 py-10">
      <Link to="/student" className="self-start text-xs font-medium text-muted hover:text-app">
        Back to profiles
      </Link>

      <header className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <BentoCard className="flex items-center gap-5 p-6" interactive tone="focus">
          <Avatar
            name={studentQ.data?.displayName ?? studentQ.data?.name ?? "?"}
            avatarSeed={studentQ.data?.avatarSeed ?? null}
            color={studentQ.data?.color ?? null}
            size="lg"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Badge tone="focus" uppercase className="w-fit">
              Student
            </Badge>
            <h1 className="mt-2 truncate text-4xl font-semibold leading-tight">
              {studentQ.isLoading ? "Loading..." : studentName}
            </h1>
            <p className="mt-1 text-sm text-muted">Choose a lesson and keep the run alive.</p>
          </div>
          <MascotIcon
            mood="cheering"
            avatarSeed={studentQ.data?.avatarSeed ?? null}
            studentId={id}
            className="hidden h-24 w-24 shrink-0 text-success sm:block"
          />
        </BentoCard>
        {summaryQ.data ? (
          <SummaryStats
            summary={summaryQ.data}
            streak={streakQ.data?.currentStreak ?? 0}
            practicedToday={streakQ.data?.practicedToday ?? false}
          />
        ) : (
          <BentoCard className="flex items-center justify-center text-sm text-muted">
            Loading progress...
          </BentoCard>
        )}
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <AchievementHallCard studentId={id} />
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
      </section>

      {booksQ.isLoading ? (
        <p className="text-sm text-muted">Loading assigned units…</p>
      ) : (booksQ.data ?? []).length === 0 ? (
        <EmptyState
          title="No assigned units yet"
          body="Ask your tutor to assign a book unit before starting practice."
        />
      ) : (
        <BookList studentId={id} books={booksQ.data ?? []} />
      )}
    </div>
  );
}

function AchievementHallCard({ studentId }: { studentId: number }) {
  return (
    <Link
      to="/student/profile/$studentId/achievements"
      params={{ studentId: String(studentId) }}
      className="motion-card flex min-h-48 flex-col justify-between gap-4 rounded-bento border border-mastery/30 bg-mastery/10 px-5 py-5 shadow-card transition hover:-translate-y-0.5 hover:border-mastery/50 hover:shadow-lift"
    >
      <div>
        <Badge tone="mastery" uppercase>
          Achievement hall
        </Badge>
        <h2 className="mt-3 font-display text-2xl font-semibold">Learning summary & trophies</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Open the dedicated trophy page to see polished badges, tiers, and live quest progress.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 font-semibold text-mastery">
        View hall
        <AppGlyph name="arrowRight" className="h-4 w-4" />
      </span>
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
        "motion-card group grid min-h-48 gap-4 rounded-bento border px-5 py-5 shadow-card transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-1 hover:border-focus/45 hover:shadow-lift sm:grid-cols-[1fr_auto] sm:items-center lg:grid-cols-1 lg:items-start xl:grid-cols-[1fr_auto] xl:items-center",
        hasDue ? "border-focus/35 bg-focus/10" : "border-border-subtle bg-surface-1",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={hasDue ? "focus" : "muted"} uppercase>
            Personal vocabulary
          </Badge>
          {hasDue ? (
            <Badge tone="warning" uppercase>
              {summary.due} due
            </Badge>
          ) : null}
        </div>
        <h2 className="mt-3 font-display text-2xl font-semibold">Words from dictionary searches</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          New dictionary lookups become a separate review track with flashcards, choices, cloze, and
          typing before they graduate to long-term memory.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:min-w-[14rem] xl:min-w-[17rem]">
        <MiniStat label="Words" value={loading ? "..." : String(summary.total)} />
        <MiniStat label="Learning" value={loading ? "..." : String(summary.learning)} />
        <MiniStat label="Short" value={loading ? "..." : String(summary.shortTerm)} />
        <MiniStat label="Score" value={loading ? "..." : `${summary.averageScore}%`} />
      </dl>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/65 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase text-muted-2">{label}</dt>
      <dd className="mt-1 font-mono text-lg text-app">{value}</dd>
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
    <dl className="grid grid-cols-2 gap-3">
      <BentoCard as="div" tone="xp" className="col-span-2 p-4" interactive>
        <dt className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase text-muted-2">Learning summary</span>
          <Badge tone="xp" uppercase>
            {progress.xp} XP
          </Badge>
        </dt>
        <dd className="mt-3">
          <p className="font-display text-xl font-semibold text-app">{progress.headline}</p>
          <p className="mt-1 text-sm leading-6 text-muted">{progress.note}</p>
        </dd>
      </BentoCard>
      <BentoCard as="div" tone="sky" className="p-4" interactive>
        <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-2">
          <span>Studied</span>
          <SeenIcon className="h-7 w-7 text-sky" />
        </dt>
        <dd className="mt-2 font-mono text-2xl text-app">{progress.wordsLabel}</dd>
      </BentoCard>
      <BentoCard as="div" tone={streak > 0 ? "ember" : "neutral"} className="p-4" interactive>
        <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-2">
          <span>Streak</span>
          <StreakFlame streak={streak} className="h-7 w-7" />
        </dt>
        <dd className="mt-2 flex items-center gap-2 font-mono text-2xl text-app">
          {streak > 0 ? `${streak}d` : "0d"}
        </dd>
      </BentoCard>
      <BentoCard
        as="div"
        tone={summary.totalDue > 0 ? "coral" : "lime"}
        className="p-4"
        interactive
      >
        <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-2">
          <span>Due</span>
          <DueIcon className={summary.totalDue > 0 ? "h-7 w-7 text-coral" : "h-7 w-7 text-lime"} />
        </dt>
        <dd className="mt-2 font-mono text-2xl text-app">{summary.totalDue}</dd>
      </BentoCard>
      <BentoCard
        as="div"
        tone={progress.accuracyPct >= 80 ? "success" : "rare"}
        className="p-4"
        interactive
      >
        <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-2">
          <span>Accuracy</span>
          <AccuracyIcon className="h-7 w-7 text-rare" />
        </dt>
        <dd className="mt-2 font-mono text-2xl text-app">{progress.accuracyPct}%</dd>
        <ProgressMeter
          value={progress.accuracyPct}
          max={100}
          label="Accuracy progress"
          tone={progress.accuracyPct >= 80 ? "success" : "rare"}
          className="mt-3"
        />
      </BentoCard>
    </dl>
  );
}

function BookList({ studentId, books }: { studentId: number; books: Book[] }) {
  return (
    <ul className="flex flex-col gap-8">
      {books.map((book) => (
        <BookSection key={book.id} studentId={studentId} book={book} />
      ))}
    </ul>
  );
}

function BookSection({ studentId, book }: { studentId: number; book: Book }) {
  const unitsQ = useQuery({
    queryKey: queryKeys.students.assignedUnits(studentId, book.id),
    queryFn: () => api.students.listAssignedUnits({ studentId, bookId: book.id }),
  });
  const units = unitsQ.data ?? [];

  return (
    <li className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3 border-b border-border-subtle pb-3">
        <div>
          <h2 className="text-xl font-semibold">{book.title}</h2>
          <span className="font-mono text-xs text-muted-2">{book.code}</span>
        </div>
      </header>
      {unitsQ.isLoading ? (
        <p className="text-xs text-muted">Loading units…</p>
      ) : units.length === 0 ? (
        <p className="text-xs text-muted-2">No assigned units in this book.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-7 xl:grid-cols-2">
          {units.map((unit) => (
            <AssignedUnitCard key={unit.id} studentId={studentId} unit={unit} />
          ))}
        </ul>
      )}
    </li>
  );
}

function AssignedUnitCard({ studentId, unit }: { studentId: number; unit: Unit }) {
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

  if (lessonsQ.isLoading) {
    return <p className="text-xs text-muted">Loading lessons…</p>;
  }

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
  const tier = unitTier({
    dueCount: totals.dueCount,
    newCount: totals.newCount,
    reviewCount,
  });

  const content = (
    <>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tier.tone} uppercase>
            {tier.label}
          </Badge>
          {totals.hasVocab ? (
            <Badge tone="xp" uppercase>
              Vocabulary
            </Badge>
          ) : null}
          {totals.hasGrammar ? (
            <Badge tone="focus" uppercase>
              Grammar
            </Badge>
          ) : null}
          <LessonIcon className={cn("h-8 w-8 text-accent")} />
          <span className="truncate text-base font-semibold">
            {unit.code}: {unit.title}
          </span>
        </div>
        {unit.summaryMd ? (
          <p className="line-clamp-2 max-w-2xl text-sm leading-6 text-muted">{unit.summaryMd}</p>
        ) : null}
        <ProgressMeter
          value={completedCount}
          max={totals.totalCount}
          label={`${unit.title} progress`}
          tone={
            reviewCount === 0 && totals.totalCount > 0
              ? "success"
              : totals.dueCount > 0
                ? "warning"
                : "xp"
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted sm:justify-end">
        {totals.dueCount > 0 ? (
          <Badge tone="warning" uppercase>
            {totals.dueCount} due
          </Badge>
        ) : null}
        {totals.newCount > 0 ? (
          <Badge tone="muted" uppercase>
            {totals.newCount} new
          </Badge>
        ) : null}
        {reviewCount === 0 && totals.totalCount > 0 ? (
          <Badge tone="success" uppercase>
            All caught up
          </Badge>
        ) : null}
        {totals.totalCount === 0 ? (
          <Badge tone="muted" uppercase>
            No cards yet
          </Badge>
        ) : null}
        <span className="font-mono text-xs text-muted-2">{totals.totalCount} items</span>
        <span aria-hidden className="text-muted-2 transition-colors group-hover:text-accent">
          &gt;
        </span>
      </div>
    </>
  );

  const className =
    "motion-card group grid min-h-48 gap-4 rounded-bento border border-border-subtle bg-surface-1 px-5 py-5 text-sm shadow-card shadow-press transition-[background-color,border-color,box-shadow,transform] [--glow-rgb:var(--color-accent)] hover:translate-y-0 hover:border-accent/40 hover:bg-surface-2 hover:shadow-lift active:translate-y-[3px] active:shadow-press-active sm:grid-cols-[1fr_auto]";

  return (
    <Link
      to="/student/profile/$studentId/unit/$unitId"
      params={{ studentId: String(studentId), unitId: String(unit.id) }}
      className={className}
    >
      {content}
    </Link>
  );
}

function unitTier({
  dueCount,
  newCount,
  reviewCount,
}: {
  dueCount: number;
  newCount: number;
  reviewCount: number;
}): { label: string; tone: "success" | "warning" | "xp" | "rare" } {
  if (reviewCount === 0) return { label: "Mastery", tone: "success" };
  if (dueCount > 0) return { label: "Focus", tone: "warning" };
  if (newCount > 0) return { label: "New", tone: "xp" };
  return { label: "Core", tone: "rare" };
}

// Re-export so consumers can build their own UnitWithLessons-shaped views.
export type { UnitWithLessons };
