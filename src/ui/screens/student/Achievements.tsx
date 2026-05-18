import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
  achievementProgress,
  getAchievement,
  summarizeStudentProgress,
} from "@/modules/rewards";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { AchievementIcon } from "@/ui/components/rewards";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

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
  const unlockedQ = useQuery({
    queryKey: queryKeys.rewards.listUnlocked(id),
    queryFn: () => api.rewards.listUnlocked({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const summary = summaryQ.data;
  const streak = streakQ.data?.currentStreak ?? 0;
  const stats = {
    totalCorrect: summary?.totalCorrect ?? 0,
    distinctCorrect: summary?.totalSeen ?? 0,
    totalAttempts: (summary?.totalCorrect ?? 0) + (summary?.totalWrong ?? 0),
    currentStreak: streak,
    bestSessionRun: bestRunFromUnlocked((unlockedQ.data ?? []).map((u) => u.achievementId)),
  };
  const progress = summarizeStudentProgress({
    totalSeen: summary?.totalSeen ?? 0,
    totalCorrect: summary?.totalCorrect ?? 0,
    totalWrong: summary?.totalWrong ?? 0,
    accuracy: summary?.accuracy ?? 0,
    streakDays: streak,
    practicedToday: streakQ.data?.practicedToday ?? false,
  });
  const unlockedIds = new Set((unlockedQ.data ?? []).map((u) => u.achievementId));
  const unlocked = [...unlockedIds]
    .map((achievementId) => getAchievement(achievementId))
    .filter((a): a is AchievementDefinition => a !== null);
  const locked = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id))
    .map((a) => ({ achievement: a, progress: achievementProgress(a, stats) }))
    .sort((a, b) => b.progress.pct - a.progress.pct)
    .slice(0, 36);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-8 py-10">
      <Link
        to="/student/profile/$studentId"
        params={{ studentId: String(id) }}
        className="self-start text-xs font-medium text-muted hover:text-app"
      >
        Back to lessons
      </Link>
      <header className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <BentoCard tone="mastery" className="flex items-center gap-5 p-6" interactive>
          <Avatar
            name={studentQ.data?.displayName ?? studentQ.data?.name ?? "?"}
            avatarSeed={studentQ.data?.avatarSeed}
            color={studentQ.data?.color}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <Badge tone="mastery" uppercase>
              Achievement hall
            </Badge>
            <h1 className="mt-2 font-display text-4xl font-semibold">
              {studentQ.data?.displayName ?? studentQ.data?.name ?? "Student"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Learning summary and trophy progress in one place.
            </p>
          </div>
        </BentoCard>
        <BentoCard tone="xp" className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase text-muted-2">Learning summary</span>
            <Badge tone="xp" uppercase>
              {progress.xp} XP
            </Badge>
          </div>
          <p className="mt-3 font-display text-xl font-semibold">{progress.headline}</p>
          <p className="mt-1 text-sm text-muted">{progress.note}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Mini label="Words" value={progress.wordsLabel} />
            <Mini label="Accuracy" value={`${progress.accuracyPct}%`} />
            <Mini label="Due" value={String(summary?.totalDue ?? 0)} />
            <Mini label="Streak" value={`${streak}d`} />
          </div>
        </BentoCard>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <BentoCard className="p-5" tone="warning">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">Unlocked trophies</h2>
              <p className="text-sm text-muted">
                {unlocked.length} / {ACHIEVEMENTS.length} collected
              </p>
            </div>
            <Badge tone="warning" uppercase>
              Vault
            </Badge>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {unlocked.slice(0, 24).map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} unlocked />
            ))}
          </ul>
        </BentoCard>
        <BentoCard className="p-5" tone="focus">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">Almost there</h2>
              <p className="text-sm text-muted">Progress bars make the next quest visible.</p>
            </div>
            <Badge tone="focus" uppercase>
              Next quests
            </Badge>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {locked.map(({ achievement, progress }) => (
              <li key={achievement.id}>
                <AchievementCard achievement={achievement} unlocked={false} />
                <ProgressMeter
                  value={progress.value}
                  max={progress.max}
                  label={progress.label}
                  tone="accent"
                  className="mt-2"
                />
                <p className="mt-1 text-[11px] text-muted-2">{progress.label}</p>
              </li>
            ))}
          </ul>
        </BentoCard>
      </section>
    </div>
  );
}

function AchievementCard({
  achievement,
  unlocked,
}: { achievement: AchievementDefinition; unlocked: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-20 gap-3 rounded-2xl border p-3",
        unlocked
          ? tierClass(achievement.tier)
          : "border-border-subtle bg-surface-0/60 text-muted grayscale",
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-current/20 bg-current/10">
        <AchievementIcon icon={achievement.icon} className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
          {achievement.tier}
        </span>
        <span className="block font-semibold text-app">{achievement.title}</span>
        <span className="line-clamp-2 text-xs text-muted">{achievement.description}</span>
      </span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/60 p-3">
      <div className="text-[10px] font-semibold uppercase text-muted-2">{label}</div>
      <div className="mt-1 font-mono text-xl text-app">{value}</div>
    </div>
  );
}

function tierClass(tier: AchievementDefinition["tier"]): string {
  if (tier === "mythic") return "border-mastery/50 bg-mastery/15 text-mastery shadow-lift";
  if (tier === "platinum") return "border-sky/45 bg-sky/10 text-sky";
  if (tier === "gold") return "border-warning/45 bg-warning/10 text-warning";
  if (tier === "silver") return "border-accent/35 bg-accent/10 text-accent";
  return "border-success/35 bg-success/10 text-success";
}

function bestRunFromUnlocked(ids: string[]): number {
  return ids.reduce((best, id) => {
    const match = id.match(/^streak_(\d+)$/);
    return match ? Math.max(best, Number(match[1])) : best;
  }, 0);
}
