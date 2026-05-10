import { computeStreak } from "@/modules/rewards";
import { describe, expect, it } from "vitest";

function localDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

describe("computeStreak — empty history", () => {
  it("returns zeros when no events", () => {
    const out = computeStreak({ eventTimestamps: [], now: localDate(2026, 5, 10) });
    expect(out).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastPracticedAt: null,
      practicedToday: false,
    });
  });
});

describe("computeStreak — current streak", () => {
  it("counts consecutive days ending today when practised today", () => {
    const out = computeStreak({
      eventTimestamps: [
        localDate(2026, 5, 8),
        localDate(2026, 5, 9),
        localDate(2026, 5, 10, 9),
        localDate(2026, 5, 10, 17),
      ],
      now: localDate(2026, 5, 10, 20),
    });
    expect(out.currentStreak).toBe(3);
    expect(out.practicedToday).toBe(true);
  });

  it("counts streak ending yesterday when no practice today (grace day)", () => {
    const out = computeStreak({
      eventTimestamps: [localDate(2026, 5, 8), localDate(2026, 5, 9)],
      now: localDate(2026, 5, 10, 6),
    });
    expect(out.currentStreak).toBe(2);
    expect(out.practicedToday).toBe(false);
  });

  it("resets to 0 when neither today nor yesterday has practice", () => {
    const out = computeStreak({
      eventTimestamps: [localDate(2026, 5, 5), localDate(2026, 5, 6)],
      now: localDate(2026, 5, 10),
    });
    expect(out.currentStreak).toBe(0);
  });

  it("a single practice today is a 1-day streak", () => {
    const out = computeStreak({
      eventTimestamps: [localDate(2026, 5, 10)],
      now: localDate(2026, 5, 10, 18),
    });
    expect(out.currentStreak).toBe(1);
    expect(out.practicedToday).toBe(true);
  });

  it("dedupes multiple same-day events", () => {
    const out = computeStreak({
      eventTimestamps: [
        localDate(2026, 5, 10, 8),
        localDate(2026, 5, 10, 12),
        localDate(2026, 5, 10, 15),
      ],
      now: localDate(2026, 5, 10, 20),
    });
    expect(out.currentStreak).toBe(1);
  });
});

describe("computeStreak — longest streak", () => {
  it("tracks the longest run separately from current", () => {
    const out = computeStreak({
      eventTimestamps: [
        // 5-day run a month ago
        localDate(2026, 4, 1),
        localDate(2026, 4, 2),
        localDate(2026, 4, 3),
        localDate(2026, 4, 4),
        localDate(2026, 4, 5),
        // 2-day run ending yesterday
        localDate(2026, 5, 8),
        localDate(2026, 5, 9),
      ],
      now: localDate(2026, 5, 10, 6),
    });
    expect(out.longestStreak).toBe(5);
    expect(out.currentStreak).toBe(2);
  });

  it("longestStreak = currentStreak when there's only one run", () => {
    const out = computeStreak({
      eventTimestamps: [localDate(2026, 5, 8), localDate(2026, 5, 9), localDate(2026, 5, 10)],
      now: localDate(2026, 5, 10, 18),
    });
    expect(out.longestStreak).toBe(3);
    expect(out.currentStreak).toBe(3);
  });
});

describe("computeStreak — lastPracticedAt", () => {
  it("returns the most recent event timestamp", () => {
    const last = localDate(2026, 5, 10, 17);
    const out = computeStreak({
      eventTimestamps: [localDate(2026, 5, 8), last, localDate(2026, 5, 10, 9)],
      now: localDate(2026, 5, 10, 20),
    });
    expect(out.lastPracticedAt?.getTime()).toBe(last.getTime());
  });
});
