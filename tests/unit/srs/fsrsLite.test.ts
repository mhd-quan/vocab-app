import type { GradeOutcome } from "@/modules/exercises/types";
import {
  DEFAULT_THRESHOLDS,
  DIFFICULTY_DEFAULT,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  STABILITY_FLOOR,
  applyAnswer,
  initialState,
  ratingFromOutcome,
} from "@/modules/srs/fsrsLite";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-05-16T00:00:00Z");

describe("fsrsLite.applyAnswer", () => {
  it("new card + rating=3 (good) seeds stability=1 and state=short_term at default thresholds", () => {
    const result = applyAnswer({ prev: null, rating: 3, now: NOW });
    expect(result.stability).toBe(1);
    expect(result.state).toBe("short_term");
    expect(result.reps).toBe(1);
    expect(result.lapses).toBe(0);
    expect(result.difficulty).toBe(DIFFICULTY_DEFAULT);
    // dueAt = now + 1 day
    expect(result.dueAt.getTime() - NOW.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("new card + rating=4 (easy) jumps further — stability=3, state=short_term", () => {
    const result = applyAnswer({ prev: null, rating: 4, now: NOW });
    expect(result.stability).toBe(3);
    expect(result.state).toBe("short_term");
    expect(result.difficulty).toBeLessThan(DIFFICULTY_DEFAULT);
  });

  it("new card + rating=2 (hard) seeds tiny stability and lands in learning", () => {
    const result = applyAnswer({ prev: null, rating: 2, now: NOW });
    expect(result.stability).toBe(0.5);
    expect(result.state).toBe("learning");
    expect(result.difficulty).toBeGreaterThan(DIFFICULTY_DEFAULT);
  });

  it("new card + rating=1 (again) lapses immediately — schedules 1 minute relearn", () => {
    const result = applyAnswer({ prev: null, rating: 1, now: NOW });
    expect(result.state).toBe("learning");
    expect(result.lapses).toBe(1);
    expect(result.reps).toBe(0);
    expect(result.stability).toBeGreaterThanOrEqual(STABILITY_FLOOR);
    expect(result.dueAt.getTime() - NOW.getTime()).toBe(60 * 1000);
  });

  it("transitions learning → short_term → long_term across consecutive 'good' answers", () => {
    let state: ReturnType<typeof applyAnswer> | null = null;
    const prev = () => (state ? { ...state } : initialState);
    // 1st good: short_term (stability 1)
    state = applyAnswer({ prev: prev(), rating: 3, now: NOW });
    expect(state.state).toBe("short_term");
    // 2nd good: stability ~1 * 1.6 * 0.9^0 = 1.6
    state = applyAnswer({ prev: prev(), rating: 3, now: NOW });
    expect(state.state).toBe("short_term");
    expect(state.stability).toBeGreaterThan(1);
    // Keep going until we cross 21 days
    let iters = 0;
    while (state.state !== "long_term" && iters < 30) {
      state = applyAnswer({ prev: prev(), rating: 4, now: NOW });
      iters++;
    }
    expect(state.state).toBe("long_term");
    expect(state.stability).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.longTermDays);
  });

  it("lapse from long_term resets stability * 0.3 and goes back to learning", () => {
    const prev = {
      stability: 30,
      difficulty: 4,
      state: "long_term" as const,
      reps: 8,
      lapses: 0,
    };
    const result = applyAnswer({ prev, rating: 1, now: NOW });
    expect(result.state).toBe("learning");
    expect(result.lapses).toBe(1);
    expect(result.stability).toBeCloseTo(9, 4); // 30 * 0.3
  });

  it("custom thresholds override state assignment", () => {
    const prev = { stability: 5, difficulty: 5, state: "short_term" as const, reps: 3, lapses: 0 };
    const aggressive = applyAnswer({
      prev,
      rating: 3,
      now: NOW,
      thresholds: { shortTermDays: 3, longTermDays: 30 },
    });
    // 5 * 1.6 = 8 → between 3 and 30 → short_term
    expect(aggressive.state).toBe("short_term");

    const conservative = applyAnswer({
      prev,
      rating: 3,
      now: NOW,
      thresholds: { shortTermDays: 1, longTermDays: 7 },
    });
    expect(conservative.state).toBe("long_term");
  });

  it("difficulty stays within [1, 10] under repeated easy ratings", () => {
    let state = initialState;
    for (let i = 0; i < 100; i++) {
      state = applyAnswer({ prev: state, rating: 4, now: NOW });
    }
    expect(state.difficulty).toBeGreaterThanOrEqual(DIFFICULTY_MIN);
    expect(state.difficulty).toBeLessThanOrEqual(DIFFICULTY_MAX);
  });

  it("difficulty stays within [1, 10] under repeated lapses", () => {
    let state = initialState;
    for (let i = 0; i < 100; i++) {
      state = applyAnswer({ prev: state, rating: 1, now: NOW });
    }
    expect(state.difficulty).toBeLessThanOrEqual(DIFFICULTY_MAX);
    expect(state.difficulty).toBeGreaterThanOrEqual(DIFFICULTY_MIN);
  });
});

describe("fsrsLite.ratingFromOutcome", () => {
  function outcome(over: Partial<GradeOutcome>): GradeOutcome {
    return {
      correct: false,
      feedback: "",
      selfGrade: null,
      selectedIndex: null,
      ...over,
    };
  }

  it("maps SelfGrade → 1..4", () => {
    expect(ratingFromOutcome(outcome({ selfGrade: "again" }))).toBe(1);
    expect(ratingFromOutcome(outcome({ selfGrade: "hard" }))).toBe(2);
    expect(ratingFromOutcome(outcome({ selfGrade: "good" }))).toBe(3);
    expect(ratingFromOutcome(outcome({ selfGrade: "easy" }))).toBe(4);
  });

  it("maps auto-grade correctness — correct=3 (good), incorrect=1 (again)", () => {
    expect(ratingFromOutcome(outcome({ correct: true }))).toBe(3);
    expect(ratingFromOutcome(outcome({ correct: false }))).toBe(1);
  });
});
