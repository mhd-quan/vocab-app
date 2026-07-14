import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
  evaluateAchievements,
  getAchievement,
} from "@/modules/rewards";
import { Modal } from "@/ui/components/Modal";
import { AchievementIcon } from "@/ui/components/rewards";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

const unlockedDateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** A compact collection preview. Each visible glyph is directly inspectable. */
export function AchievementStrip({ studentId }: { studentId: number }) {
  const [selected, setSelected] = useState<AchievementDefinition | null>(null);
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

  const collectionLink = (
    <Link
      to="/student/profile/$studentId/achievements"
      params={{ studentId: String(studentId) }}
      className="ui-focus-ring rounded-control text-xs font-medium text-accent transition-colors duration-fast hover:text-app motion-reduce:transition-none"
    >
      See all
    </Link>
  );
  const loading =
    summaryQ.isLoading || streakQ.isLoading || statsQ.isLoading || unlockedQ.isLoading;
  const unavailable = summaryQ.isError || streakQ.isError || statsQ.isError || unlockedQ.isError;

  if (loading || unavailable) {
    return (
      <div className="flex min-h-9 items-center justify-between gap-3">
        <p role={unavailable ? "alert" : "status"} className="text-xs text-muted">
          {unavailable ? "Achievements are temporarily unavailable." : "Loading achievements…"}
        </p>
        {collectionLink}
      </div>
    );
  }

  const summary = summaryQ.data;
  const streak = streakQ.data?.currentStreak ?? 0;
  const stats =
    statsQ.data ??
    ({
      totalCorrect: summary?.totalCorrect ?? 0,
      distinctCorrect: summary?.totalSeen ?? 0,
      totalAttempts: (summary?.totalCorrect ?? 0) + (summary?.totalWrong ?? 0),
      currentStreak: streak,
      bestSessionRun: 0,
    } as const);
  const unlockedIds = new Set((unlockedQ.data ?? []).map((item) => item.achievementId));
  const unlockedRecords = new Map(
    (unlockedQ.data ?? []).map((item) => [item.achievementId, item] as const),
  );
  const achievedIds = new Set([...unlockedIds, ...evaluateAchievements(stats)]);
  const unlocked = [...achievedIds]
    .map((achievementId) => getAchievement(achievementId))
    .filter((achievement): achievement is AchievementDefinition => achievement !== null)
    .sort((left, right) => {
      const leftTime =
        unlockedRecords.get(left.id)?.unlockedAt.getTime() ?? Number.NEGATIVE_INFINITY;
      const rightTime =
        unlockedRecords.get(right.id)?.unlockedAt.getTime() ?? Number.NEGATIVE_INFINITY;
      return rightTime - leftTime;
    });
  const featured = unlocked.slice(0, 5);
  const selectedRecord = selected ? unlockedRecords.get(selected.id) : undefined;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          <span data-tabular className="font-medium text-app">
            {unlocked.length}
          </span>{" "}
          of {ACHIEVEMENTS.length} collected
        </p>
        {collectionLink}
      </div>

      {featured.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Collected achievements">
          {featured.map((achievement) => (
            <li key={achievement.id}>
              <button
                type="button"
                aria-label={`View achievement: ${achievement.title}`}
                title={achievement.title}
                onClick={() => setSelected(achievement)}
                className="ui-focus-ring grid h-9 w-9 place-items-center rounded-control border border-border-subtle text-mastery transition-[border-color,background-color,color] duration-fast hover:border-border-strong hover:bg-surface-2 hover:text-app motion-reduce:transition-none"
              >
                <AchievementIcon icon={achievement.icon} className="h-[18px] w-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs leading-5 text-muted">Your first milestone will appear here.</p>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Achievement"}
        size="sm"
      >
        {selected ? (
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-object border border-border-subtle bg-surface-2 text-mastery">
              <AchievementIcon icon={selected.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-5 text-app">{selected.description}</p>
              <p className="mt-3 text-xs text-muted">
                Tier <span className="font-medium text-app">{formatTier(selected.tier)}</span>
              </p>
              {selectedRecord ? (
                <p className="mt-1 text-xs text-muted">
                  Collected{" "}
                  <span className="font-medium text-app">
                    {unlockedDateFormat.format(selectedRecord.unlockedAt)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function formatTier(tier: AchievementDefinition["tier"]): string {
  return `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
}
