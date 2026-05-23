import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
  evaluateAchievements,
  getAchievement,
  summarizeStudentProgress,
} from "@/modules/rewards";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Badge } from "@/ui/components/Badge";
import { AchievementIcon } from "@/ui/components/rewards";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

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

  if (summaryQ.isLoading || streakQ.isLoading || statsQ.isLoading || unlockedQ.isLoading) {
    return (
      <Link
        {...linkProps}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-2 hover:text-mastery"
      >
        Trophy hall
        <AppGlyph name="arrowRight" className="h-3.5 w-3.5" />
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
    .filter((a): a is AchievementDefinition => a !== null);
  const featured = unlocked.slice(0, 3);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-mastery/25 bg-mastery/5 px-3 py-2 text-xs">
      <Badge tone="xp" uppercase>
        {progress.xp} XP
      </Badge>
      <span className="font-semibold text-mastery">
        {unlocked.length} / {ACHIEVEMENTS.length} trophies
      </span>
      {featured.length > 0 ? (
        <span className="flex items-center gap-1">
          {featured.map((achievement) => (
            <span
              key={achievement.id}
              title={achievement.title}
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full border",
                "border-mastery/30 bg-mastery/10 text-mastery",
              )}
            >
              <AchievementIcon icon={achievement.icon} className="h-3.5 w-3.5" />
            </span>
          ))}
        </span>
      ) : null}
      <Link
        {...linkProps}
        className="ml-auto inline-flex items-center gap-1 font-semibold text-mastery hover:underline"
      >
        Trophy hall
        <AppGlyph name="arrowRight" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
