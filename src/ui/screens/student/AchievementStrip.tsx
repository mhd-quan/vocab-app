import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
  evaluateAchievements,
  getAchievement,
  summarizeStudentProgress,
} from "@/modules/rewards";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { AchievementIcon } from "@/ui/components/rewards";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

/** Compact, inspectable link from the learning inspector into the collection. */
export function AchievementStrip({ studentId }: { studentId: number }) {
  const summaryQ = useQuery({
    queryKey: queryKeys.progress.summary(studentId),
    queryFn: () => api.progress.studentSummary({ studentId }),
    enabled: Number.isFinite(studentId) && studentId > 0,
  });
  const streakQ = useQuery({
    queryKey: queryKeys.rewards.streak(studentId),
    queryFn: () => api.rewards.streak({ studentId }),
    enabled: Number.isFinite(studentId) && studentId > 0,
  });
  const statsQ = useQuery({
    queryKey: queryKeys.rewards.stats(studentId),
    queryFn: () => api.rewards.stats({ studentId }),
    enabled: Number.isFinite(studentId) && studentId > 0,
  });
  const unlockedQ = useQuery({
    queryKey: queryKeys.rewards.listUnlocked(studentId),
    queryFn: () => api.rewards.listUnlocked({ studentId }),
    enabled: Number.isFinite(studentId) && studentId > 0,
  });

  const linkProps = {
    to: "/student/profile/$studentId/achievements" as const,
    params: { studentId: String(studentId) },
  };

  const baseClass =
    "ui-focus-ring group flex min-h-[var(--size-row)] w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-surface-2";

  if (summaryQ.isLoading || streakQ.isLoading || statsQ.isLoading || unlockedQ.isLoading) {
    return (
      <Link {...linkProps} className={baseClass}>
        <AppGlyph name="trophy" className="h-5 w-5 text-warning" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-app">Achievement collection</span>
          <span className="mt-0.5 block text-xs text-muted">Loading progress…</span>
        </span>
        <AppGlyph name="arrowRight" className="h-4 w-4 text-muted-2" />
      </Link>
    );
  }

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
    .map((id) => getAchievement(id))
    .filter((achievement): achievement is AchievementDefinition => achievement !== null);
  const featured = unlocked.slice(0, 3);

  return (
    <Link {...linkProps} className={baseClass}>
      <AppGlyph name="trophy" className="h-5 w-5 text-warning" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-app">Achievement collection</span>
        <span className="mt-0.5 block text-xs text-muted">
          <span className="tabular-figure font-medium text-app">{unlocked.length}</span> of{" "}
          {ACHIEVEMENTS.length} collected · {progress.xp} XP
        </span>
      </span>
      {featured.length > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5" aria-label="Featured achievements">
          {featured.map((achievement) => (
            <span
              key={achievement.id}
              title={achievement.title}
              className="grid h-5 w-5 place-items-center text-mastery"
            >
              <AchievementIcon icon={achievement.icon} className="h-3.5 w-3.5" />
            </span>
          ))}
        </span>
      ) : null}
      <AppGlyph name="arrowRight" className="h-4 w-4 text-muted-2 group-hover:text-app" />
    </Link>
  );
}
