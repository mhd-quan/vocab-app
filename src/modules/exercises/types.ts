/**
 * Domain types for the exercise engine.
 *
 * The plugin model splits responsibilities cleanly:
 *   - `build` turns a `VocabEntryFull` (plus options + RNG) into an
 *     `Exercise` payload, or returns null when the entry can't satisfy
 *     the kind's requirements (e.g. multiple-choice needs distractors).
 *   - `grade` takes that exercise + the student's answer and returns a
 *     `GradeOutcome`. Self-graded kinds (flashcard) trust the student;
 *     auto-graded kinds compare against the truth.
 *
 * Persistence (writing `learning_events`, updating `item_progress`) is
 * intentionally out of scope here — the engine stays a pure-function
 * island and the player records via repos.
 */
import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";

export type ExerciseKind =
  | "flashcard"
  | "multiple_choice"
  | "audio_recall"
  | "definition_match"
  | "sentence_rebuild";
export type DefinitionPriority = "en_first" | "vi_first";

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

/* ---------------------------------------------------------------------- *
 *  Flashcard — self-graded recall.
 * ---------------------------------------------------------------------- */

export interface FlashcardPayload {
  front: {
    headword: string;
    pos: string;
    ipa: string | null;
    /**
     * Audio ref the front can autoplay. Populated by the plugin from
     * `entry.audioRef` (single ref, "other" accent); when null the
     * front skips the pronunciation control entirely.
     */
    audioRef: string | null;
  };
  back: {
    /** Primary EN definition; secondary defs render below in a list. */
    definitionsEn: string[];
    definitionVi: string | null;
    definitionPriority: DefinitionPriority;
    /** First example's text — already contains `{{cloze}}` markers. */
    exampleText: string | null;
  };
}

export interface FlashcardExercise extends ExerciseBase {
  kind: "flashcard";
  payload: FlashcardPayload;
}

/* ---------------------------------------------------------------------- *
 *  Multiple choice — pick the headword matching a definition.
 * ---------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------- *
 *  Audio recall — student hears the headword and types the spelling.
 *  Needs at least one audio ref on the source entry or its examples.
 * ---------------------------------------------------------------------- */

export interface AudioRecallPayload {
  /** The audio ref to play — passed through `<PronunciationControls>`. */
  audioRef: string;
  /** Accent label for the play button. */
  audioLabel: string;
  /** Canonical spelling — lowercased, whitespace-normalised. */
  expectedSpelling: string;
  /** Display form preserved for feedback ("Correct! The word is X."). */
  displayHeadword: string;
  /** Optional hint surface (POS + first translation) for kid-friendly UX. */
  hint?: { pos: string; gloss: string | null };
}

export interface AudioRecallExercise extends ExerciseBase {
  kind: "audio_recall";
  payload: AudioRecallPayload;
}

/* ---------------------------------------------------------------------- *
 *  Definition matching — drag-drop 4 headwords onto 4 definition slots.
 *  Needs `ctx.entryPool` with ≥ 4 entries that each carry a definition.
 * ---------------------------------------------------------------------- */

export interface DefinitionMatchItem {
  /** Stable id we round-trip through dnd-kit. */
  pairId: string;
  /** The headword chip. */
  headword: string;
  /** The definition card the user must drag the headword onto. */
  definition: string;
}

export interface DefinitionMatchPayload {
  items: DefinitionMatchItem[];
}

export interface DefinitionMatchExercise extends ExerciseBase {
  kind: "definition_match";
  payload: DefinitionMatchPayload;
}

/* ---------------------------------------------------------------------- *
 *  Sentence rebuild — drag word chips into the correct order.
 *  Returns null when the source has no example sentence.
 * ---------------------------------------------------------------------- */

export interface SentenceRebuildPayload {
  /** Tokens shuffled into the order the student starts from. */
  scrambled: string[];
  /** Canonical sentence tokens — what the student is rebuilding. */
  correctOrder: string[];
  /** The headword embedded somewhere in the sentence (optional hint). */
  headword: string;
}

export interface SentenceRebuildExercise extends ExerciseBase {
  kind: "sentence_rebuild";
  payload: SentenceRebuildPayload;
}

export type Exercise =
  | FlashcardExercise
  | MultipleChoiceExercise
  | AudioRecallExercise
  | DefinitionMatchExercise
  | SentenceRebuildExercise;

export type Answer =
  | { kind: "flashcard"; grade: SelfGrade }
  | { kind: "multiple_choice"; selectedIndex: number }
  | { kind: "audio_recall"; spelling: string }
  | {
      kind: "definition_match";
      assignments: Array<{ definitionPairId: string; headword: string }>;
    }
  | { kind: "sentence_rebuild"; tokens: string[] };

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
  /**
   * Pool of full entries for cross-entry exercises (definition_match).
   * Optional — most plugins only need the target entry. Adapters that
   * call `buildDeck` should pass the entire lesson set here.
   */
  entryPool?: ReadonlyArray<VocabEntryFull>;
  /** Learner-facing definition order preference. */
  definitionPriority?: DefinitionPriority;
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

export type BuildSkipReason = "build_returned_null" | "requires_flashcard_first";
