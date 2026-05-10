/**
 * SM-2 spaced-repetition scheduler. Pure functions — no DB access, no
 * dates beyond what callers pass in.
 *
 * Inputs (per item, per answer):
 *   - quality 0–5 (we map our 4-grade flashcard scale + multiple-choice
 *     correct/incorrect onto this range; see `qualityFromOutcome`).
 *   - the previous schedule state, or null on first review.
 *
 * Output: the new schedule state (ease, interval, repetitions, dueAt)
 * plus the `now` timestamp the caller passed in, for `lastSeenAt`.
 *
 * Storage shape mirrors `item_progress`: ease is stored as `int = ease * 100`
 * so the table column type stays `integer`. `streak` doubles as SM-2's
 * `repetitions` counter.
 */

import type { GradeOutcome, SelfGrade } from "../exercises/types";

export const EASE_MIN = 130; // 1.30 × 100
export const EASE_DEFAULT = 250; // 2.50 × 100
export const PASSING_QUALITY = 3;

export interface ScheduleState {
  /** SM-2 ease factor scaled by 100 (so 250 = 2.50). */
  ease: number;
  /** Days until the card is next due. 0 = "today / right now". */
  intervalDays: number;
  /** Consecutive correct answers, reset to 0 on a failure. */
  repetitions: number;
}

export const initialSchedule: ScheduleState = {
  ease: EASE_DEFAULT,
  intervalDays: 0,
  repetitions: 0,
};

export interface ApplyAnswerInput {
  /** Previous schedule, or null for a brand-new card. */
  prev: ScheduleState | null;
  /** Quality 0–5. */
  quality: number;
  /** Reference timestamp for `nextDueAt` calculation. */
  now: Date;
}

export interface ApplyAnswerResult extends ScheduleState {
  /** UTC timestamp at which the item is next due. */
  nextDueAt: Date;
  lastSeenAt: Date;
}

/**
 * Apply one answer to a schedule state and return the next state.
 * Implements vanilla SM-2, with `ease` kept as int×100 to fit the
 * SQLite integer column without precision loss.
 */
export function applyAnswer(input: ApplyAnswerInput): ApplyAnswerResult {
  const q = clamp(input.quality, 0, 5);
  const prev = input.prev ?? initialSchedule;

  const failed = q < PASSING_QUALITY;

  // Ease update — same delta on pass or fail; only interval/reps reset.
  // SM-2: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const five = 5 - q;
  const delta = 0.1 - five * (0.08 + five * 0.02);
  const easeNext = Math.max(EASE_MIN, Math.round(prev.ease + delta * 100));

  let repetitions: number;
  let intervalDays: number;

  if (failed) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = prev.repetitions + 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      // SM-2 multiplies the previous interval by EF; we use the *updated*
      // ease so a strong "easy" answer immediately stretches the interval.
      intervalDays = Math.max(1, Math.round(prev.intervalDays * (easeNext / 100)));
    }
  }

  const nextDueAt = addDays(input.now, intervalDays);
  return {
    ease: easeNext,
    intervalDays,
    repetitions,
    nextDueAt,
    lastSeenAt: input.now,
  };
}

/**
 * Map our outcome shape onto SM-2's 0–5 quality scale.
 *
 *   flashcard self-grade: again=2, hard=3, good=4, easy=5
 *   multiple_choice:      correct=4, incorrect=2
 */
export function qualityFromOutcome(outcome: GradeOutcome): number {
  if (outcome.selfGrade !== null) {
    return SELF_GRADE_QUALITY[outcome.selfGrade];
  }
  return outcome.correct ? 4 : 2;
}

const SELF_GRADE_QUALITY: Record<SelfGrade, number> = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function addDays(date: Date, days: number): Date {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + ms);
}
