import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
  evaluateAchievements,
  getAchievement,
  nextAchievementQuests,
  summarizeStudentProgress,
} from "@/modules/rewards";
import { Avatar } from "@/ui/components/Avatar";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { AchievementIcon } from "@/ui/components/rewards";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

export function StudentAchievements() {
  const { studentId } = useParams({ from: "/student/profile/$studentId/achievements" });
  const id = Number(studentId);
  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(id),
    queryFn: () => api.students.getById({ id }),
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
  const statsQ = useQuery({
    queryKey: queryKeys.rewards.stats(id),
    queryFn: () => api.rewards.stats({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });
  const unlockedQ = useQuery({
    queryKey: queryKeys.rewards.listUnlocked(id),
    queryFn: () => api.rewards.listUnlocked({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const summary = summaryQ.data;
  const streak = streakQ.data?.currentStreak ?? 0;
  const fallbackStats = {
    totalCorrect: summary?.totalCorrect ?? 0,
    distinctCorrect: summary?.totalSeen ?? 0,
    totalAttempts: (summary?.totalCorrect ?? 0) + (summary?.totalWrong ?? 0),
    currentStreak: streak,
    bestSessionRun: 0,
  };
  const stats = statsQ.data ?? fallbackStats;
  const progress = summarizeStudentProgress({
    totalSeen: summary?.totalSeen ?? 0,
    totalCorrect: summary?.totalCorrect ?? 0,
    totalWrong: summary?.totalWrong ?? 0,
    accuracy: summary?.accuracy ?? 0,
    streakDays: streak,
    practicedToday: streakQ.data?.practicedToday ?? false,
  });
  const unlockedIds = new Set((unlockedQ.data ?? []).map((u) => u.achievementId));
  const achievedIds = new Set([...unlockedIds, ...evaluateAchievements(stats)]);
  const unlocked = [...achievedIds]
    .map((achievementId) => getAchievement(achievementId))
    .filter((a): a is AchievementDefinition => a !== null);
  const locked = nextAchievementQuests(ACHIEVEMENTS, achievedIds, stats);
  const studentName = studentQ.data?.displayName ?? studentQ.data?.name ?? "Student";
  const recordLoading =
    studentQ.isLoading ||
    summaryQ.isLoading ||
    streakQ.isLoading ||
    statsQ.isLoading ||
    unlockedQ.isLoading;
  const recordUnavailable =
    studentQ.isError || summaryQ.isError || streakQ.isError || statsQ.isError || unlockedQ.isError;

  if (recordLoading || recordUnavailable) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
        <header>
          <h1 className="text-title font-semibold">Achievements</h1>
          <p className="mt-0.5 text-sm text-muted">Learning record and milestones</p>
        </header>
        {recordLoading ? (
          <p role="status" className="grouped-list px-5 py-8 text-sm text-muted">
            Loading achievements…
          </p>
        ) : (
          <section role="alert" className="grouped-list px-5 py-6">
            <h2 className="text-base font-semibold">Achievements are temporarily unavailable</h2>
            <p className="mt-1 text-sm text-muted">No learning record has been changed.</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                void studentQ.refetch();
                void summaryQ.refetch();
                void streakQ.refetch();
                void statsQ.refetch();
                void unlockedQ.refetch();
              }}
            >
              Retry
            </Button>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
      <header className="flex items-center gap-3">
        <Avatar
          name={studentName}
          avatarSeed={studentQ.data?.avatarSeed}
          color={studentQ.data?.color}
          size="md"
        />
        <div className="min-w-0">
          <h1 className="truncate text-title font-semibold">Achievements</h1>
          <p className="mt-0.5 text-sm text-muted">{studentName}&rsquo;s learning record</p>
        </div>
      </header>

      <section className="grouped-list learning-trace" aria-labelledby="learning-summary-title">
        <div className="px-5 py-4">
          <h2 id="learning-summary-title" className="text-base font-semibold">
            {progress.headline}
          </h2>
          <p className="mt-1 text-sm text-muted">{progress.note}</p>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-border-subtle bg-border-subtle sm:grid-cols-3 lg:grid-cols-6">
          <SummaryMetric label="Words" value={progress.wordsLabel} />
          <SummaryMetric label="Accuracy" value={`${progress.accuracyPct}%`} />
          <SummaryMetric
            label="Due"
            value={summary?.totalDue ?? 0}
            warning={(summary?.totalDue ?? 0) > 0}
          />
          <SummaryMetric label="Streak" value={`${streak}d`} />
          <SummaryMetric label="XP" value={progress.xp} />
          <SummaryMetric label="Collected" value={`${unlocked.length}/${ACHIEVEMENTS.length}`} />
        </dl>
      </section>

      <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
        <section className="grouped-list self-start" aria-labelledby="unlocked-title">
          <header className="border-b border-border-subtle px-4 py-3">
            <h2 id="unlocked-title" className="font-semibold">
              Collected
            </h2>
            <p className="mt-0.5 text-xs text-muted">Milestones already earned through practice.</p>
          </header>
          {unlocked.length === 0 ? (
            <EmptyState
              title="Your first milestone is close"
              body="Complete a practice session to begin this collection."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {unlocked.slice(0, 24).map((achievement) => (
                <li key={achievement.id}>
                  <AchievementRow achievement={achievement} unlocked />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grouped-list self-start" aria-labelledby="next-quests-title">
          <header className="border-b border-border-subtle px-4 py-3">
            <h2 id="next-quests-title" className="font-semibold">
              Next milestones
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              The closest unfinished goal in each collection.
            </p>
          </header>
          {locked.length === 0 ? (
            <EmptyState title="Collection complete" body="Every current milestone is unlocked." />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {locked.map(({ achievement, progress: questProgress }) => (
                <li key={achievement.id} className="px-4 py-3.5">
                  <AchievementRow achievement={achievement} unlocked={false} compact />
                  <ProgressMeter
                    value={questProgress.value}
                    max={questProgress.max}
                    label={questProgress.label}
                    tone="accent"
                    className="mt-3"
                    showValue
                  />
                  <p className="mt-1.5 text-xs text-muted">{questProgress.label}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number | string;
  warning?: boolean;
}) {
  return (
    <div className="bg-paper px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={cn(
          "tabular-figure mt-0.5 text-lg font-semibold",
          warning ? "text-warning" : "text-app",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function AchievementRow({
  achievement,
  unlocked,
  compact = false,
}: {
  achievement: AchievementDefinition;
  unlocked: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex gap-3", !compact && "px-4 py-3.5")}>
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-control bg-surface-2",
          unlocked ? tierInkClass(achievement.tier) : "text-muted-2 grayscale",
        )}
      >
        <AchievementIcon icon={achievement.icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-app">{achievement.title}</span>
          <span className="shrink-0 text-xs capitalize text-muted">{achievement.tier}</span>
        </span>
        <span className="mt-0.5 block text-sm leading-5 text-muted">{achievement.description}</span>
      </span>
    </div>
  );
}

function tierInkClass(tier: AchievementDefinition["tier"]): string {
  if (tier === "mythic") return "text-mastery";
  if (tier === "platinum") return "text-iris";
  if (tier === "gold") return "text-warning";
  if (tier === "silver") return "text-muted";
  return "text-success";
}
