import {
  ACHIEVEMENTS,
  type AchievementStats,
  evaluateAchievements,
  getAchievement,
} from "@/modules/rewards";
import { describe, expect, it } from "vitest";

const baseStats: AchievementStats = {
  totalCorrect: 0,
  distinctCorrect: 0,
  totalAttempts: 0,
  currentStreak: 0,
  bestSessionRun: 0,
};

describe("evaluateAchievements — thresholds", () => {
  it("nothing earned for a brand-new student", () => {
    expect(evaluateAchievements(baseStats)).toEqual([]);
  });

  it("first_answer fires on the first correct answer", () => {
    expect(evaluateAchievements({ ...baseStats, totalCorrect: 1 })).toContain("first_answer");
  });

  it("streak_5 fires at exactly 5, streak_10 only at 10+", () => {
    expect(evaluateAchievements({ ...baseStats, bestSessionRun: 4 })).not.toContain("streak_5");
    expect(evaluateAchievements({ ...baseStats, bestSessionRun: 5 })).toContain("streak_5");
    expect(evaluateAchievements({ ...baseStats, bestSessionRun: 5 })).not.toContain("streak_10");
    expect(evaluateAchievements({ ...baseStats, bestSessionRun: 10 })).toContain("streak_10");
  });

  it("daily streaks unlock at 3 and 7", () => {
    expect(evaluateAchievements({ ...baseStats, currentStreak: 3 })).toContain("daily_3");
    expect(evaluateAchievements({ ...baseStats, currentStreak: 6 })).not.toContain("daily_7");
    expect(evaluateAchievements({ ...baseStats, currentStreak: 7 })).toContain("daily_7");
  });

  it("learned_25 / learned_100 measure distinct entries, not totals", () => {
    expect(
      evaluateAchievements({ ...baseStats, totalCorrect: 50, distinctCorrect: 24 }),
    ).not.toContain("learned_25");
    expect(evaluateAchievements({ ...baseStats, distinctCorrect: 25 })).toContain("learned_25");
    expect(evaluateAchievements({ ...baseStats, distinctCorrect: 100 })).toContain("learned_100");
  });

  it("accuracy_master needs both 50+ attempts and 90%+ accuracy", () => {
    expect(
      evaluateAchievements({ ...baseStats, totalCorrect: 9, totalAttempts: 10 }),
    ).not.toContain("accuracy_master");
    expect(evaluateAchievements({ ...baseStats, totalCorrect: 49, totalAttempts: 50 })).toContain(
      "accuracy_master",
    );
    expect(
      evaluateAchievements({ ...baseStats, totalCorrect: 44, totalAttempts: 50 }),
    ).not.toContain("accuracy_master");
  });
});

describe("evaluateAchievements — idempotency", () => {
  it("same input returns the same set", () => {
    const stats: AchievementStats = {
      totalCorrect: 30,
      distinctCorrect: 28,
      totalAttempts: 32,
      currentStreak: 4,
      bestSessionRun: 7,
    };
    expect(evaluateAchievements(stats)).toEqual(evaluateAchievements(stats));
  });

  it("higher tier earns lower tier too", () => {
    const earned = evaluateAchievements({
      totalCorrect: 200,
      distinctCorrect: 120,
      totalAttempts: 200,
      currentStreak: 10,
      bestSessionRun: 12,
    });
    expect(earned).toContain("first_answer");
    expect(earned).toContain("learned_25");
    expect(earned).toContain("learned_100");
    expect(earned).toContain("daily_3");
    expect(earned).toContain("daily_7");
    expect(earned).toContain("streak_5");
    expect(earned).toContain("streak_10");
  });
});

describe("getAchievement", () => {
  it("returns the definition for a known id", () => {
    const def = getAchievement("first_answer");
    expect(def?.title).toBe("First steps");
  });

  it("returns null for an unknown id", () => {
    expect(getAchievement("does_not_exist")).toBeNull();
  });

  it("every catalogue id has a definition", () => {
    for (const a of ACHIEVEMENTS) {
      expect(getAchievement(a.id)).not.toBeNull();
    }
  });
});
