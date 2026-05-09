/**
 * Domain types for the exercise engine.
 *
 * The plugin model splits responsibilities cleanly:
 *   - `build` turns a `VocabEntryFull` (plus options + RNG) into an
 *     `Exercise` payload, or returns null when the entry can't satisfy
 *     the kind's requirements (e.g. multiple-choice needs distractors).
 *   - `grade` takes that exercise + the student's answer and returns a
 *     `GradeOutcome`. Self-graded kinds (flashcard) trust the student;
 *     auto-graded kinds (multiple-choice) compare against the truth.
 *
 * Persistence (writing `learning_events`, updating `item_progress`) is
 * intentionally out of scope here — sessions in PR #7 are ephemeral, so
 * the engine stays a pure-function island and the player records nothing
 * beyond local React state. PR #8 layers persistence on top via
 * `learning_events` + `practice_sessions`.
 */
import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";

export type ExerciseKind = "flashcard" | "multiple_choice";

/** Self-grade scale used by flashcards (matches FSRS / Anki conventions). */
export const selfGrades = ["again", "hard", "good", "easy"] as const;
export type SelfGrade = (typeof selfGrades)[number];

export interface ExerciseBase {
  /** Stable per-session id. Includes the seed so the same deck is reproducible. */
  id: string;
  kind: ExerciseKind;
  /** The vocab entry id we built this from. PR #8 maps this → content_items.id. */
  entryId: number;
}

export interface FlashcardPayload {
  front: {
    headword: string;
    pos: string;
    ipa: string | null;
  };
  back: {
    /** Primary EN definition; secondary defs render below in a list. */
    definitionsEn: string[];
    definitionVi: string | null;
    /** First example's text — already contains `{{cloze}}` markers. */
    exampleText: string | null;
  };
}

export interface FlashcardExercise extends ExerciseBase {
  kind: "flashcard";
  payload: FlashcardPayload;
}

export interface MultipleChoiceOption {
  /** Headword shown to the student. */
  text: string;
  correct: boolean;
}

export interface MultipleChoicePayload {
  /** What we show to the student — derived from the entry's first sense. */
  prompt: string;
  options: MultipleChoiceOption[];
}

export interface MultipleChoiceExercise extends ExerciseBase {
  kind: "multiple_choice";
  payload: MultipleChoicePayload;
}

export type Exercise = FlashcardExercise | MultipleChoiceExercise;

export type Answer =
  | { kind: "flashcard"; grade: SelfGrade }
  | { kind: "multiple_choice"; selectedIndex: number };

export interface GradeOutcome {
  /** Whether to count this as a correct attempt for stats. */
  correct: boolean;
  /** Short feedback to surface in the UI. */
  feedback: string;
  /** Self-grade for flashcards; null for auto-graded kinds. */
  selfGrade: SelfGrade | null;
  /** Index the student picked, if applicable. */
  selectedIndex: number | null;
}

export interface BuildContext {
  /** Pool of headwords usable as distractors (excludes the target). */
  distractorPool: string[];
  /** Seeded RNG (mulberry32) — pass-through to plugins for deterministic tests. */
  rng: () => number;
  /** Seed string baked into exercise ids so a deck can be replayed. */
  sessionSeed: string;
}

export interface ExercisePlugin<TExercise extends Exercise, TAnswer> {
  kind: TExercise["kind"];
  /** Returns null when the entry can't produce this kind of exercise. */
  build(entry: VocabEntryFull, ctx: BuildContext): TExercise | null;
  grade(exercise: TExercise, answer: TAnswer): GradeOutcome;
}

export type AnyExercisePlugin = ExercisePlugin<Exercise, Answer>;
