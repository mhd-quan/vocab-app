/**
 * Catalogue of achievements + a pure evaluator. The DB only stores
 * `(studentId, achievementId, unlockedAt)` tuples, so adding a new
 * achievement is a code-only change — no migration needed.
 *
 * Each rule receives an aggregate snapshot (cheap to compute from the
 * event log + item_progress). The evaluator returns the *full* set of
 * earned IDs; the repository filters that against already-unlocked
 * rows to determine the freshly-unlocked subset.
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

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: "first_answer",
    title: "First steps",
    description: "Answered your very first question correctly.",
    icon: "spark",
  },
  {
    id: "streak_5",
    title: "On a roll",
    description: "Got 5 in a row right inside one session.",
    icon: "flame",
  },
  {
    id: "streak_10",
    title: "Unstoppable",
    description: "Got 10 in a row right inside one session.",
    icon: "flame",
  },
  {
    id: "daily_3",
    title: "Three days strong",
    description: "Practised three days in a row.",
    icon: "calendar",
  },
  {
    id: "daily_7",
    title: "One full week",
    description: "Practised every day for a week straight.",
    icon: "calendar",
  },
  {
    id: "learned_25",
    title: "Quarter century",
    description: "Answered 25 different words correctly.",
    icon: "target",
  },
  {
    id: "learned_100",
    title: "Word collector",
    description: "Answered 100 different words correctly.",
    icon: "trophy",
  },
  {
    id: "accuracy_master",
    title: "Sharpshooter",
    description: "Hit 90% accuracy with at least 50 answers.",
    icon: "star",
  },
] as const;

const ACHIEVEMENTS_BY_ID = new Map<string, AchievementDefinition>(
  ACHIEVEMENTS.map((a) => [a.id, a]),
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
  const earned: string[] = [];
  if (stats.totalCorrect >= 1) earned.push("first_answer");
  if (stats.bestSessionRun >= 5) earned.push("streak_5");
  if (stats.bestSessionRun >= 10) earned.push("streak_10");
  if (stats.currentStreak >= 3) earned.push("daily_3");
  if (stats.currentStreak >= 7) earned.push("daily_7");
  if (stats.distinctCorrect >= 25) earned.push("learned_25");
  if (stats.distinctCorrect >= 100) earned.push("learned_100");
  if (stats.totalAttempts >= 50 && stats.totalCorrect / stats.totalAttempts >= 0.9) {
    earned.push("accuracy_master");
  }
  return earned;
}
