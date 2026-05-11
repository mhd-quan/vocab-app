import type { Book, Lesson, Unit } from "@/data/types";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { getAchievement } from "@/modules/rewards";
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
import { AchievementIcon } from "@/ui/components/rewards";
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

  const streakQ = useQuery({
    queryKey: queryKeys.rewards.streak(id),
    queryFn: () => api.rewards.streak({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const unlockedQ = useQuery({
    queryKey: queryKeys.rewards.listUnlocked(id),
    queryFn: () => api.rewards.listUnlocked({ studentId: id }),
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
        </BentoCard>
        {summaryQ.data ? (
          <SummaryStats summary={summaryQ.data} streak={streakQ.data?.currentStreak ?? 0} />
        ) : (
          <BentoCard className="flex items-center justify-center text-sm text-muted">
            Loading progress...
          </BentoCard>
        )}
      </header>

      {unlockedQ.data && unlockedQ.data.length > 0 ? (
        <AchievementsStrip ids={unlockedQ.data.map((u) => u.achievementId)} />
      ) : null}

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
  streak,
}: {
  summary: { totalSeen: number; totalDue: number; accuracy: number };
  streak: number;
}) {
  const accuracyPct = Math.round(summary.accuracy * 100);
  return (
    <dl className="grid grid-cols-2 gap-3">
      <BentoCard as="div" tone={streak > 0 ? "ember" : "neutral"} className="p-4" interactive>
        <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-2">
          <span>Streak</span>
          <StreakFlame streak={streak} className="h-6 w-6" />
        </dt>
        <dd className="mt-2 flex items-center gap-2 font-mono text-2xl text-app">
          {streak > 0 ? `${streak}d` : "0d"}
        </dd>
      </BentoCard>
      <BentoCard as="div" tone="sky" className="p-4" interactive>
        <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-2">
          <span>Seen</span>
          <SeenIcon className="h-6 w-6 text-sky" />
        </dt>
        <dd className="mt-2 font-mono text-2xl text-app">{summary.totalSeen}</dd>
      </BentoCard>
      <BentoCard
        as="div"
        tone={summary.totalDue > 0 ? "coral" : "lime"}
        className="p-4"
        interactive
      >
        <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-2">
          <span>Due</span>
          <DueIcon className={summary.totalDue > 0 ? "h-6 w-6 text-coral" : "h-6 w-6 text-lime"} />
        </dt>
        <dd className="mt-2 font-mono text-2xl text-app">{summary.totalDue}</dd>
      </BentoCard>
      <BentoCard as="div" tone={accuracyPct >= 80 ? "success" : "rare"} className="p-4" interactive>
        <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-2">
          <span>Accuracy</span>
          <AccuracyIcon className="h-6 w-6 text-rare" />
        </dt>
        <dd className="mt-2 font-mono text-2xl text-app">{accuracyPct}%</dd>
        <ProgressMeter
          value={accuracyPct}
          max={100}
          label="Accuracy progress"
          tone={accuracyPct >= 80 ? "success" : "rare"}
          className="mt-3"
        />
      </BentoCard>
    </dl>
  );
}

function AchievementsStrip({ ids }: { ids: string[] }) {
  return (
    <BentoCard tone="mastery" className="px-5 py-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Achievements</h2>
        <span className="text-xs font-semibold uppercase text-muted-2">{ids.length} unlocked</span>
      </header>
      <ul className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <AchievementChip key={id} achievementId={id} />
        ))}
      </ul>
    </BentoCard>
  );
}

function AchievementChip({ achievementId }: { achievementId: string }) {
  const def = getAchievement(achievementId);
  if (!def) return null;
  return (
    <li
      className="flex items-center gap-2 rounded-full border border-mastery/40 bg-mastery/10 px-3 py-1.5 text-xs text-mastery"
      title={def.description}
    >
      <AchievementIcon icon={def.icon} className="h-3.5 w-3.5" />
      <span className="font-medium text-app">{def.title}</span>
    </li>
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
    queryKey: queryKeys.curriculum.units(book.id),
    queryFn: () => api.curriculum.listUnitsByBook({ bookId: book.id }),
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
        <p className="text-xs text-muted-2">No units imported yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-7 xl:grid-cols-2">
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
    <li>
      <header className="mb-3 flex items-baseline gap-2">
        <Badge tone="muted" uppercase>
          {unit.code}
        </Badge>
        <h3 className="text-base font-semibold">{unit.title}</h3>
      </header>
      <ul className="grid grid-cols-1 gap-3">
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
      <div className="flex min-h-28 items-center justify-between rounded-bento border border-dashed border-border-subtle bg-surface-1 px-5 py-4 text-sm opacity-70">
        <span className="text-muted">{lesson.title}</span>
        <span className="text-xs text-muted-2">no entries</span>
      </div>
    );
  }
  const reviewCount = dueCount + newCount;
  const completedCount = Math.max(totalCount - reviewCount, 0);
  const tier = lessonTier({ dueCount, newCount, reviewCount });
  return (
    <Link
      to="/student/profile/$studentId/session/$lessonId"
      params={{ studentId: String(studentId), lessonId: String(lesson.id) }}
      className="motion-card group grid min-h-32 gap-4 rounded-bento border border-border-subtle bg-surface-1 px-5 py-4 text-sm shadow-card transition-[background-color,border-color,box-shadow,transform] [--glow-rgb:var(--color-accent)] hover:-translate-y-1 hover:border-accent/40 hover:bg-surface-2 hover:shadow-lift sm:grid-cols-[1fr_auto]"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tier.tone} uppercase>
            {tier.label}
          </Badge>
          <Badge tone="accent" uppercase>
            Vocab
          </Badge>
          <LessonIcon className="h-5 w-5 text-accent" />
          <span className="truncate text-base font-semibold">{lesson.title}</span>
        </div>
        <ProgressMeter
          value={completedCount}
          max={totalCount}
          label={`${lesson.title} progress`}
          tone={reviewCount === 0 ? "success" : dueCount > 0 ? "warning" : "xp"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted sm:justify-end">
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
        <span className="font-mono text-xs text-muted-2">{totalCount} cards</span>
        <span aria-hidden className="text-muted-2 transition-colors group-hover:text-accent">
          &gt;
        </span>
      </div>
    </Link>
  );
}

function lessonTier({
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
