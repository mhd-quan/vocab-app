import { computeStudentXp, summarizeStudentProgress } from "@/modules/rewards";
import { describe, expect, it } from "vitest";

describe("student progress summary", () => {
  it("keeps XP tied to studied words, correct answers, accuracy, and streak", () => {
    expect(
      computeStudentXp({
        totalSeen: 10,
        totalCorrect: 18,
        totalWrong: 2,
        accuracy: 0.9,
        streakDays: 3,
      }),
    ).toBe(241);
  });

  it("gives a first-session message before the learner has data", () => {
    const summary = summarizeStudentProgress({
      totalSeen: 0,
      totalCorrect: 0,
      totalWrong: 0,
      accuracy: 0,
      streakDays: 0,
    });
    expect(summary.headline).toMatch(/first word/i);
    expect(summary.xp).toBe(0);
  });

  it("prioritizes habit feedback for a full-week streak", () => {
    const summary = summarizeStudentProgress({
      totalSeen: 30,
      totalCorrect: 40,
      totalWrong: 8,
      accuracy: 40 / 48,
      streakDays: 7,
      practicedToday: true,
    });
    expect(summary.headline).toMatch(/full-week/i);
    expect(summary.wordsLabel).toBe("30 words");
  });
});
