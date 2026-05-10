import type { GradeOutcome } from "@/modules/exercises";
import {
  EASE_DEFAULT,
  EASE_MIN,
  applyAnswer,
  initialSchedule,
  qualityFromOutcome,
} from "@/modules/srs";
import { describe, expect, it } from "vitest";

const T0 = new Date("2026-01-01T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("applyAnswer — first review", () => {
  it("a passing first answer (q=4) sets reps=1, interval=1 day", () => {
    const out = applyAnswer({ prev: null, quality: 4, now: T0 });
    expect(out.repetitions).toBe(1);
    expect(out.intervalDays).toBe(1);
    expect(out.nextDueAt.getTime() - T0.getTime()).toBe(DAY);
  });

  it("a failing first answer (q<3) resets reps to 0 and schedules tomorrow", () => {
    const out = applyAnswer({ prev: null, quality: 1, now: T0 });
    expect(out.repetitions).toBe(0);
    expect(out.intervalDays).toBe(1);
  });

  it("ease never falls below the floor (1.30 × 100 = 130)", () => {
    let state = applyAnswer({ prev: null, quality: 0, now: T0 });
    for (let i = 0; i < 20; i++) {
      state = applyAnswer({ prev: state, quality: 0, now: T0 });
    }
    expect(state.ease).toBeGreaterThanOrEqual(EASE_MIN);
  });
});

describe("applyAnswer — interval growth", () => {
  it("rep=2 hops to a 6-day interval", () => {
    const r1 = applyAnswer({ prev: null, quality: 4, now: T0 });
    const r2 = applyAnswer({ prev: r1, quality: 4, now: T0 });
    expect(r2.repetitions).toBe(2);
    expect(r2.intervalDays).toBe(6);
  });

  it("rep ≥ 3 multiplies the previous interval by ease", () => {
    let s = applyAnswer({ prev: null, quality: 4, now: T0 }); // 1 day
    s = applyAnswer({ prev: s, quality: 4, now: T0 }); // 6 days
    const expectedEase = s.ease;
    const r3 = applyAnswer({ prev: s, quality: 4, now: T0 });
    expect(r3.repetitions).toBe(3);
    expect(r3.intervalDays).toBe(Math.round(6 * (expectedEase / 100)));
  });

  it("an 'easy' answer pushes the interval further than 'good'", () => {
    const goodChain = applyAnswer({ prev: null, quality: 4, now: T0 });
    const easyChain = applyAnswer({ prev: null, quality: 5, now: T0 });
    // First-rep interval is fixed at 1 day either way, but ease diverges.
    expect(easyChain.ease).toBeGreaterThan(goodChain.ease);
  });
});

describe("applyAnswer — failure resets", () => {
  it("a failure mid-streak resets reps to 0 and interval to 1 day", () => {
    let s = applyAnswer({ prev: null, quality: 4, now: T0 });
    s = applyAnswer({ prev: s, quality: 5, now: T0 });
    const failed = applyAnswer({ prev: s, quality: 1, now: T0 });
    expect(failed.repetitions).toBe(0);
    expect(failed.intervalDays).toBe(1);
  });

  it("failure does NOT change ease above the floor by less than the delta", () => {
    const before = { ...initialSchedule };
    const after = applyAnswer({ prev: before, quality: 2, now: T0 });
    expect(after.ease).toBeLessThan(EASE_DEFAULT);
  });
});

describe("qualityFromOutcome", () => {
  function fc(grade: "again" | "hard" | "good" | "easy"): GradeOutcome {
    return {
      correct: grade === "good" || grade === "easy",
      feedback: "",
      selfGrade: grade,
      selectedIndex: null,
    };
  }

  it("maps the four self-grades to the SM-2 scale", () => {
    expect(qualityFromOutcome(fc("again"))).toBe(2);
    expect(qualityFromOutcome(fc("hard"))).toBe(3);
    expect(qualityFromOutcome(fc("good"))).toBe(4);
    expect(qualityFromOutcome(fc("easy"))).toBe(5);
  });

  it("maps multiple-choice correct=4 / incorrect=2", () => {
    const correct: GradeOutcome = {
      correct: true,
      feedback: "",
      selfGrade: null,
      selectedIndex: 0,
    };
    const wrong: GradeOutcome = {
      correct: false,
      feedback: "",
      selfGrade: null,
      selectedIndex: 1,
    };
    expect(qualityFromOutcome(correct)).toBe(4);
    expect(qualityFromOutcome(wrong)).toBe(2);
  });
});
