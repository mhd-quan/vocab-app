/**
 * Catalogue of achievements + a pure evaluator. The DB only stores
 * `(studentId, achievementId, unlockedAt)` tuples, so adding a new
 * achievement is a code-only change with no migration.
 */

export type AchievementGroup =
  | "answers"
  | "words"
  | "practice"
  | "daily"
  | "session_run"
  | "accuracy"
  | "retention";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  /** Lucide-ish icon hint for the UI; renderer maps these to glyphs. */
  icon:
    | "spark"
    | "flame"
    | "target"
    | "trophy"
    | "calendar"
    | "star"
    | "compass"
    | "phoenix"
    | "gem"
    | "crown";
  tier: "bronze" | "silver" | "gold" | "platinum" | "mythic";
  group: AchievementGroup;
  goal:
    | { metric: keyof AchievementStats; target: number }
    | { metric: "accuracy"; target: number; floor: number }
    | { metric: "retention"; target: number; minAccuracy: number };
}

export interface AchievementStats {
  /** Total correct answers across all sessions. */
  totalCorrect: number;
  /** Distinct vocab entries answered correctly at least once. */
  distinctCorrect: number;
  /** Total attempts (correct + wrong). */
  totalAttempts: number;
  /** Calendar-day streak ending today (or yesterday if no practice today). */
  currentStreak: number;
  /** Longest single in-session run of correct answers ever recorded. */
  bestSessionRun: number;
}

interface AchievementRule extends AchievementDefinition {
  earned: (stats: AchievementStats) => boolean;
}

const LEGACY_RULES: AchievementRule[] = [
  {
    id: "first_answer",
    group: "answers",
    title: "Spark Rookie",
    description: "Answered your very first question correctly.",
    icon: "spark",
    tier: "bronze",
    goal: { metric: "totalCorrect", target: 1 },
    earned: (stats) => stats.totalCorrect >= 1,
  },
  {
    id: "streak_5",
    group: "session_run",
    title: "Flame Runner",
    description: "Got 5 in a row right inside one session.",
    icon: "flame",
    tier: "silver",
    goal: { metric: "bestSessionRun", target: 5 },
    earned: (stats) => stats.bestSessionRun >= 5,
  },
  {
    id: "streak_10",
    group: "session_run",
    title: "Dragon Mode",
    description: "Got 10 in a row right inside one session.",
    icon: "flame",
    tier: "gold",
    goal: { metric: "bestSessionRun", target: 10 },
    earned: (stats) => stats.bestSessionRun >= 10,
  },
  {
    id: "daily_3",
    group: "daily",
    title: "Calendar Scout",
    description: "Practised three days in a row.",
    icon: "calendar",
    tier: "silver",
    goal: { metric: "currentStreak", target: 3 },
    earned: (stats) => stats.currentStreak >= 3,
  },
  {
    id: "daily_7",
    group: "daily",
    title: "Seven-Day Sentinel",
    description: "Practised every day for a week straight.",
    icon: "calendar",
    tier: "gold",
    goal: { metric: "currentStreak", target: 7 },
    earned: (stats) => stats.currentStreak >= 7,
  },
  {
    id: "learned_25",
    group: "words",
    title: "Word Ranger",
    description: "Answered 25 different words correctly.",
    icon: "target",
    tier: "gold",
    goal: { metric: "distinctCorrect", target: 25 },
    earned: (stats) => stats.distinctCorrect >= 25,
  },
  {
    id: "learned_100",
    group: "words",
    title: "Lexicon Vault Keeper",
    description: "Answered 100 different words correctly.",
    icon: "trophy",
    tier: "platinum",
    goal: { metric: "distinctCorrect", target: 100 },
    earned: (stats) => stats.distinctCorrect >= 100,
  },
  {
    id: "accuracy_master",
    group: "accuracy",
    title: "Crystal Aim",
    description: "Hit 90% accuracy with at least 50 answers.",
    icon: "star",
    tier: "platinum",
    goal: { metric: "accuracy", target: 90, floor: 50 },
    earned: (stats) => accuracy(stats) >= 0.9 && stats.totalAttempts >= 50,
  },
];

const ANSWER_THRESHOLDS = [
  5, 10, 15, 20, 30, 40, 50, 60, 75, 90, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 600,
  700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 4500, 5000,
  6000,
];
const WORD_THRESHOLDS = [
  5, 10, 15, 20, 30, 40, 50, 60, 75, 90, 125, 150, 175, 200, 225, 250, 275, 300, 350, 400, 450, 500,
  600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000,
];
const ATTEMPT_THRESHOLDS = [
  10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 650, 800, 1000, 1250, 1500, 1750, 2000, 2500,
  3000, 3500, 4000, 5000, 6000,
];
const DAILY_THRESHOLDS = [
  2, 4, 5, 10, 14, 21, 30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300, 330, 365,
];
const SESSION_RUN_THRESHOLDS = [
  3, 4, 6, 7, 8, 9, 12, 15, 18, 20, 24, 28, 32, 36, 40, 45, 50, 60, 75, 100,
];
const ACCURACY_THRESHOLDS = [60, 65, 70, 75, 80, 82, 84, 86, 88, 92, 94, 95, 96, 97, 98, 99];
const ACCURACY_ATTEMPT_FLOORS = [25, 50, 100, 200, 400, 800, 1200, 2000];

const RULES: AchievementRule[] = dedupeRules([
  ...LEGACY_RULES,
  ...ANSWER_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `answers_${threshold}`,
      group: "answers",
      title: correctTitle(threshold),
      description: `Answered ${threshold} questions correctly.`,
      icon: threshold >= 2000 ? "crown" : threshold >= 500 ? "trophy" : "spark",
      tier: tierFor(threshold, [25, 100, 500, 1500]),
      goal: { metric: "totalCorrect", target: threshold },
      earned: (stats) => stats.totalCorrect >= threshold,
    }),
  ),
  ...WORD_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `words_${threshold}`,
      group: "words",
      title: wordTitle(threshold),
      description: `Answered ${threshold} different vocabulary words correctly.`,
      icon: threshold >= 1000 ? "gem" : threshold >= 500 ? "trophy" : "target",
      tier: tierFor(threshold, [25, 100, 500, 1000]),
      goal: { metric: "distinctCorrect", target: threshold },
      earned: (stats) => stats.distinctCorrect >= threshold,
    }),
  ),
  ...ATTEMPT_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `practice_${threshold}`,
      group: "practice",
      title: practiceTitle(threshold),
      description: `Completed ${threshold} total practice attempts.`,
      icon: threshold >= 3000 ? "crown" : threshold >= 1000 ? "trophy" : "star",
      tier: tierFor(threshold, [50, 200, 1000, 3000]),
      goal: { metric: "totalAttempts", target: threshold },
      earned: (stats) => stats.totalAttempts >= threshold,
    }),
  ),
  ...DAILY_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `daily_${threshold}`,
      group: "daily",
      title: streakDayTitle(threshold),
      description: `Kept a learning streak for ${threshold} days.`,
      icon: threshold >= 180 ? "phoenix" : threshold >= 30 ? "trophy" : "calendar",
      tier: tierFor(threshold, [5, 14, 60, 180]),
      goal: { metric: "currentStreak", target: threshold },
      earned: (stats) => stats.currentStreak >= threshold,
    }),
  ),
  ...SESSION_RUN_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `streak_${threshold}`,
      group: "session_run",
      title: runTitle(threshold),
      description: `Got ${threshold} answers correct in one session without a miss.`,
      icon: threshold >= 60 ? "phoenix" : threshold >= 20 ? "trophy" : "flame",
      tier: tierFor(threshold, [5, 10, 20, 60]),
      goal: { metric: "bestSessionRun", target: threshold },
      earned: (stats) => stats.bestSessionRun >= threshold,
    }),
  ),
  ...ACCURACY_ATTEMPT_FLOORS.flatMap((floor) =>
    ACCURACY_THRESHOLDS.map((pct) =>
      thresholdRule({
        id: `accuracy_${pct}_after_${floor}`,
        group: "accuracy",
        title: accuracyTitle(pct, floor),
        description: `Held at least ${pct}% accuracy after ${floor} practice attempts.`,
        icon: pct >= 98 ? "gem" : pct >= 95 ? "trophy" : "star",
        tier:
          pct >= 98 && floor >= 800
            ? "mythic"
            : pct >= 95
              ? "platinum"
              : pct >= 88
                ? "gold"
                : pct >= 75
                  ? "silver"
                  : "bronze",
        goal: { metric: "accuracy", target: pct, floor },
        earned: (stats) => stats.totalAttempts >= floor && accuracy(stats) >= pct / 100,
      }),
    ),
  ),
  ...WORD_THRESHOLDS.slice(0, 24).map((threshold) =>
    thresholdRule({
      id: `retention_${threshold}`,
      group: "retention",
      title: stableTitle(threshold),
      description: `Built a remembered-word base of ${threshold} vocabulary items.`,
      icon: threshold >= 300 ? "compass" : "target",
      tier: tierFor(threshold, [20, 75, 200, 400]),
      goal: { metric: "retention", target: threshold, minAccuracy: 70 },
      earned: (stats) => stats.distinctCorrect >= threshold && accuracy(stats) >= 0.7,
    }),
  ),
]);

export const ACHIEVEMENTS: readonly AchievementDefinition[] = RULES.map(
  ({ earned: _earned, ...definition }) => definition,
);

const ACHIEVEMENTS_BY_ID = new Map<string, AchievementDefinition>(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);

export function getAchievement(id: string): AchievementDefinition | null {
  return ACHIEVEMENTS_BY_ID.get(id) ?? null;
}

/**
 * Return every achievement ID the student has currently earned, given
 * the supplied aggregates. Pure + idempotent: feeding the same stats
 * twice yields the same set.
 */
export function evaluateAchievements(stats: AchievementStats): string[] {
  return RULES.filter((rule) => rule.earned(stats)).map((rule) => rule.id);
}

export interface AchievementProgress {
  value: number;
  max: number;
  pct: number;
  remaining: number;
  label: string;
}

export function nextAchievementQuests(
  achievements: readonly AchievementDefinition[],
  unlockedIds: ReadonlySet<string>,
  stats: AchievementStats,
): Array<{ achievement: AchievementDefinition; progress: AchievementProgress }> {
  const byGroup = new Map<
    AchievementGroup,
    { achievement: AchievementDefinition; progress: AchievementProgress }
  >();

  for (const achievement of achievements) {
    if (unlockedIds.has(achievement.id)) continue;
    const progress = achievementProgress(achievement, stats);
    if (progress.remaining === 0) continue;
    const current = byGroup.get(achievement.group);
    if (
      !current ||
      questRank(progress, achievement) > questRank(current.progress, current.achievement)
    ) {
      byGroup.set(achievement.group, { achievement, progress });
    }
  }

  return [...byGroup.values()].sort((a, b) => {
    const delta = b.progress.pct - a.progress.pct;
    return delta !== 0 ? delta : a.progress.remaining - b.progress.remaining;
  });
}

function questRank(progress: AchievementProgress, achievement: AchievementDefinition): number {
  return progress.pct * 10_000 - progress.remaining - tierWeight(achievement.tier);
}

function tierWeight(tier: AchievementDefinition["tier"]): number {
  if (tier === "mythic") return 5;
  if (tier === "platinum") return 4;
  if (tier === "gold") return 3;
  if (tier === "silver") return 2;
  return 1;
}

export function achievementProgress(
  achievement: AchievementDefinition,
  stats: AchievementStats,
): AchievementProgress {
  if (achievement.goal.metric === "accuracy") {
    const attempts = Math.min(stats.totalAttempts, achievement.goal.floor);
    const pctNow = Math.round(accuracy(stats) * 100);
    const ready = stats.totalAttempts >= achievement.goal.floor;
    const value = ready ? Math.min(pctNow, achievement.goal.target) : attempts;
    const max = ready ? achievement.goal.target : achievement.goal.floor;
    const remaining = Math.max(max - value, 0);
    return {
      value,
      max,
      pct: progressPercent(value, max, remaining === 0),
      remaining,
      label: ready
        ? `${pctNow}% / ${achievement.goal.target}% accuracy`
        : `${attempts}/${achievement.goal.floor} attempts before accuracy badge`,
    };
  }
  if (achievement.goal.metric === "retention") {
    const distinctCorrect = Number(stats.distinctCorrect ?? 0);
    const words = Math.min(distinctCorrect, achievement.goal.target);
    const accuracyPct = Math.round(accuracy(stats) * 100);
    const wordRemaining = Math.max(achievement.goal.target - distinctCorrect, 0);
    const accuracyRemaining = Math.max(achievement.goal.minAccuracy - accuracyPct, 0);
    const complete = wordRemaining === 0 && accuracyRemaining === 0;
    const wordProgress = achievement.goal.target > 0 ? words / achievement.goal.target : 1;
    const accuracyProgress =
      achievement.goal.minAccuracy > 0
        ? Math.min(accuracyPct, achievement.goal.minAccuracy) / achievement.goal.minAccuracy
        : 1;
    const pct = progressPercent(Math.min(wordProgress, accuracyProgress) * 100, 100, complete);
    return {
      value: pct,
      max: 100,
      pct,
      remaining: wordRemaining + accuracyRemaining,
      label: `${words}/${achievement.goal.target} words + ${accuracyPct}%/${achievement.goal.minAccuracy}% accuracy`,
    };
  }
  const current = Number(stats[achievement.goal.metric] ?? 0);
  const value = Math.min(current, achievement.goal.target);
  const remaining = Math.max(achievement.goal.target - current, 0);
  return {
    value,
    max: achievement.goal.target,
    pct: progressPercent(value, achievement.goal.target, remaining === 0),
    remaining,
    label: `${value}/${achievement.goal.target}`,
  };
}

function accuracy(stats: AchievementStats): number {
  return stats.totalAttempts > 0 ? stats.totalCorrect / stats.totalAttempts : 0;
}

function progressPercent(value: number, max: number, complete: boolean): number {
  if (max <= 0) return complete ? 100 : 0;
  const pct = Math.max(0, Math.round((value / max) * 100));
  return complete ? 100 : Math.min(99, pct);
}

function thresholdRule(rule: AchievementRule): AchievementRule {
  return rule;
}

function tierFor(
  value: number,
  cuts: [number, number, number, number],
): AchievementDefinition["tier"] {
  if (value >= cuts[3]) return "mythic";
  if (value >= cuts[2]) return "platinum";
  if (value >= cuts[1]) return "gold";
  if (value >= cuts[0]) return "silver";
  return "bronze";
}

function correctTitle(n: number): string {
  if (n >= 5000) return "Answer Constellation";
  if (n >= 1000) return `${n} Thunder Answers`;
  if (n >= 100) return `${n} Victory Sparks`;
  return `${n} Correct Sparks`;
}

function wordTitle(n: number): string {
  if (n >= 1000) return "Atlas of 1,000 Words";
  if (n >= 500) return `${n}-Word Treasure Vault`;
  if (n >= 100) return `${n}-Word Explorer`;
  return `${n}-Word Scout`;
}

function practiceTitle(n: number): string {
  if (n >= 3000) return "Practice Galaxy Pilot";
  if (n >= 1000) return `${n} Rep Titan`;
  if (n >= 100) return `${n} Training Beats`;
  return `${n} Practice Pops`;
}

function streakDayTitle(n: number): string {
  if (n >= 365) return "Yearlong Phoenix";
  if (n >= 90) return `${n}-Day Legend Trail`;
  if (n >= 30) return `${n}-Day Quest Chain`;
  return `${n}-Day Spark Chain`;
}

function runTitle(n: number): string {
  if (n >= 60) return "Meteor-No-Miss Run";
  if (n >= 20) return `${n} Perfect Strikes`;
  if (n >= 10) return `${n} Dragon Combo`;
  return `${n} Clean Combo`;
}

function accuracyTitle(pct: number, floor: number): string {
  if (pct >= 98) return `${pct}% Diamond Focus`;
  if (pct >= 95) return `${pct}% Golden Aim`;
  return `${pct}% Focus Badge · ${floor}+`;
}

function stableTitle(n: number): string {
  if (n >= 300) return `${n} Memory Compass Stars`;
  if (n >= 100) return `${n} Locked-In Words`;
  return `${n} Sticky Words`;
}

function dedupeRules(rules: AchievementRule[]): AchievementRule[] {
  const seen = new Set<string>();
  const out: AchievementRule[] = [];
  for (const rule of rules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    out.push(rule);
  }
  return out;
}
