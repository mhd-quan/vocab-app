/**
 * Catalogue of achievements + a pure evaluator. The DB only stores
 * `(studentId, achievementId, unlockedAt)` tuples, so adding a new
 * achievement is a code-only change with no migration.
 */

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  /** Lucide-ish icon hint for the UI; renderer maps these to glyphs. */
  icon: "spark" | "flame" | "target" | "trophy" | "calendar" | "star";
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
    title: "First steps",
    description: "Answered your very first question correctly.",
    icon: "spark",
    earned: (stats) => stats.totalCorrect >= 1,
  },
  {
    id: "streak_5",
    title: "On a roll",
    description: "Got 5 in a row right inside one session.",
    icon: "flame",
    earned: (stats) => stats.bestSessionRun >= 5,
  },
  {
    id: "streak_10",
    title: "Unstoppable",
    description: "Got 10 in a row right inside one session.",
    icon: "flame",
    earned: (stats) => stats.bestSessionRun >= 10,
  },
  {
    id: "daily_3",
    title: "Three days strong",
    description: "Practised three days in a row.",
    icon: "calendar",
    earned: (stats) => stats.currentStreak >= 3,
  },
  {
    id: "daily_7",
    title: "One full week",
    description: "Practised every day for a week straight.",
    icon: "calendar",
    earned: (stats) => stats.currentStreak >= 7,
  },
  {
    id: "learned_25",
    title: "Quarter century",
    description: "Answered 25 different words correctly.",
    icon: "target",
    earned: (stats) => stats.distinctCorrect >= 25,
  },
  {
    id: "learned_100",
    title: "Word collector",
    description: "Answered 100 different words correctly.",
    icon: "trophy",
    earned: (stats) => stats.distinctCorrect >= 100,
  },
  {
    id: "accuracy_master",
    title: "Sharpshooter",
    description: "Hit 90% accuracy with at least 50 answers.",
    icon: "star",
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
      title: `${threshold} correct`,
      description: `Answered ${threshold} questions correctly.`,
      icon: threshold >= 1000 ? "trophy" : "spark",
      earned: (stats) => stats.totalCorrect >= threshold,
    }),
  ),
  ...WORD_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `words_${threshold}`,
      title: `${threshold} words remembered`,
      description: `Answered ${threshold} different vocabulary words correctly.`,
      icon: threshold >= 500 ? "trophy" : "target",
      earned: (stats) => stats.distinctCorrect >= threshold,
    }),
  ),
  ...ATTEMPT_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `practice_${threshold}`,
      title: `${threshold} practice reps`,
      description: `Completed ${threshold} total practice attempts.`,
      icon: threshold >= 1000 ? "trophy" : "star",
      earned: (stats) => stats.totalAttempts >= threshold,
    }),
  ),
  ...DAILY_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `daily_${threshold}`,
      title: `${threshold}-day cadence`,
      description: `Kept a learning streak for ${threshold} days.`,
      icon: threshold >= 30 ? "trophy" : "calendar",
      earned: (stats) => stats.currentStreak >= threshold,
    }),
  ),
  ...SESSION_RUN_THRESHOLDS.map((threshold) =>
    thresholdRule({
      id: `streak_${threshold}`,
      title: `${threshold} clean in a row`,
      description: `Got ${threshold} answers correct in one session without a miss.`,
      icon: threshold >= 20 ? "trophy" : "flame",
      earned: (stats) => stats.bestSessionRun >= threshold,
    }),
  ),
  ...ACCURACY_ATTEMPT_FLOORS.flatMap((floor) =>
    ACCURACY_THRESHOLDS.map((pct) =>
      thresholdRule({
        id: `accuracy_${pct}_after_${floor}`,
        title: `${pct}% focus · ${floor}+ reps`,
        description: `Held at least ${pct}% accuracy after ${floor} practice attempts.`,
        icon: pct >= 95 ? "trophy" : "star",
        earned: (stats) => stats.totalAttempts >= floor && accuracy(stats) >= pct / 100,
      }),
    ),
  ),
  ...WORD_THRESHOLDS.slice(0, 24).map((threshold) =>
    thresholdRule({
      id: `retention_${threshold}`,
      title: `${threshold} stable words`,
      description: `Built a remembered-word base of ${threshold} vocabulary items.`,
      icon: threshold >= 300 ? "trophy" : "target",
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

function accuracy(stats: AchievementStats): number {
  return stats.totalAttempts > 0 ? stats.totalCorrect / stats.totalAttempts : 0;
}

function thresholdRule(rule: AchievementRule): AchievementRule {
  return rule;
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
