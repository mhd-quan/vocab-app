/**
 * FSRS-lite spaced-repetition scheduler.
 *
 * Pure functions — no DB, no clocks beyond what the caller passes.
 * The repository layer calls the scheduler through this module boundary so
 * storage, settings, and UI code do not depend on scheduling internals.
 *
 * Why FSRS-lite (and not full FSRS):
 *   Full FSRS-5 needs offline-trained weights to be optimal. For a
 *   tutor-curated curriculum the gains from a custom-trained model are
 *   small compared to the operational complexity. This implementation
 *   keeps FSRS's *shape* — stability + difficulty + four ratings — but
 *   uses fixed published weights from the FSRS reference (rounded for
 *   readability). Same lifecycle: new → learning → short_term →
 *   long_term, driven by interval growth.
 *
 * Storage:
 *   `stability` REAL (days)        — current memory half-life estimate.
 *   `difficulty` REAL (1..10)      — item-intrinsic hardness.
 *   `state` TEXT                   — derived from stability + thresholds.
 *   `reps` INTEGER                 — consecutive non-lapse reviews.
 *   `lapses` INTEGER               — total failures.
 *   `lastReviewedAt`, `dueAt`      — timestamps.
 *
 * Ratings are 1..4 to match Anki/RemNote convention:
 *   1 again — failure, schedule for ~1 minute.
 *   2 hard  — passed barely; smaller stability bump.
 *   3 good  — comfortable recall; baseline bump.
 *   4 easy  — instant recall; large bump.
 */

import type { GradeOutcome, SelfGrade } from "../exercises/types";

export type FsrsRating = 1 | 2 | 3 | 4;

export const fsrsStates = ["new", "learning", "short_term", "long_term"] as const;
export type FsrsState = (typeof fsrsStates)[number];

export interface FsrsThresholds {
  /** Stability (days) at which state graduates from `learning` → `short_term`. */
  shortTermDays: number;
  /** Stability (days) at which state graduates from `short_term` → `long_term`. */
  longTermDays: number;
}

export const DEFAULT_THRESHOLDS: FsrsThresholds = {
  shortTermDays: 1,
  longTermDays: 21,
};

export const DIFFICULTY_DEFAULT = 5.0;
export const DIFFICULTY_MIN = 1.0;
export const DIFFICULTY_MAX = 10.0;
export const STABILITY_FLOOR = 0.2;
export const LAPSE_RETENTION_FACTOR = 0.3;
export const RELEARN_INTERVAL_MIN = 1; // minutes

export interface FsrsState_ {
  stability: number;
  difficulty: number;
  state: FsrsState;
  reps: number;
  lapses: number;
}

export const initialState: FsrsState_ = {
  stability: 0,
  difficulty: DIFFICULTY_DEFAULT,
  state: "new",
  reps: 0,
  lapses: 0,
};

export interface ApplyAnswerInput {
  /** Previous state, or null for a brand-new card. */
  prev: FsrsState_ | null;
  rating: FsrsRating;
  /** Reference timestamp for `dueAt`. */
  now: Date;
  /** Optional override for the global thresholds (tutor-tunable). */
  thresholds?: FsrsThresholds;
}

export interface ApplyAnswerResult extends FsrsState_ {
  /** Absolute timestamp at which the item is next due. */
  dueAt: Date;
  /** Mirrors `now` — for repos to write `lastReviewedAt`. */
  lastReviewedAt: Date;
}

/**
 * Apply one answer to FSRS-lite. Pure — deterministic given inputs.
 */
export function applyAnswer(input: ApplyAnswerInput): ApplyAnswerResult {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const prev = input.prev ?? initialState;
  const rating = clamp(input.rating, 1, 4) as FsrsRating;

  // --- Lapse path: schedule short relearn, halve stability, harder by ~0.4. ---
  if (rating === 1) {
    const stability = Math.max(STABILITY_FLOOR, prev.stability * LAPSE_RETENTION_FACTOR);
    const difficulty = clamp(prev.difficulty + 0.4, DIFFICULTY_MIN, DIFFICULTY_MAX);
    return {
      stability,
      difficulty,
      state: "learning",
      reps: 0,
      lapses: prev.lapses + 1,
      dueAt: addMinutes(input.now, RELEARN_INTERVAL_MIN),
      lastReviewedAt: input.now,
    };
  }

  // --- Pass path. ---
  // First successful review: seed stability from a small table.
  // Subsequent reviews: multiplicative growth, damped by difficulty.
  const seedStability = rating === 4 ? 3 : rating === 3 ? 1 : /* hard */ 0.5;
  const successFactor = rating === 4 ? 2.5 : rating === 3 ? 1.6 : /* hard */ 1.2;

  const nextStability =
    prev.state === "new" || prev.stability < STABILITY_FLOOR
      ? seedStability
      : prev.stability * successFactor * 0.9 ** (prev.difficulty - DIFFICULTY_DEFAULT);

  const difficultyDelta = rating === 4 ? -0.15 : rating === 3 ? 0 : /* hard */ 0.2;
  const nextDifficulty = clamp(prev.difficulty + difficultyDelta, DIFFICULTY_MIN, DIFFICULTY_MAX);

  const nextState: FsrsState =
    nextStability >= thresholds.longTermDays
      ? "long_term"
      : nextStability >= thresholds.shortTermDays
        ? "short_term"
        : "learning";

  return {
    stability: roundDecimal(nextStability, 4),
    difficulty: roundDecimal(nextDifficulty, 3),
    state: nextState,
    reps: prev.reps + 1,
    lapses: prev.lapses,
    dueAt: addDays(input.now, nextStability),
    lastReviewedAt: input.now,
  };
}

/**
 * Map our outcome shape onto FSRS's 1..4 rating scale.
 *
 *   flashcard self-grade: again=1, hard=2, good=3, easy=4
 *   multiple-choice:      correct=3, incorrect=1
 *
 * The mapping deliberately treats a multiple-choice failure as a hard
 * lapse (same as "again"), because the student saw the right answer in
 * the option set — getting it wrong means recall is weak.
 */
export function ratingFromOutcome(outcome: GradeOutcome): FsrsRating {
  if (outcome.selfGrade !== null) {
    return SELF_GRADE_RATING[outcome.selfGrade];
  }
  return outcome.correct ? 3 : 1;
}

const SELF_GRADE_RATING: Record<SelfGrade, FsrsRating> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function roundDecimal(n: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}
