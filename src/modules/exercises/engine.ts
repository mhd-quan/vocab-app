import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import { audioRecallPlugin } from "./audioRecall";
import { definitionMatchPlugin } from "./definitionMatch";
import { flashcardPlugin } from "./flashcard";
import { createLazyDeck } from "./lazyDeck";
import { multipleChoicePlugin } from "./multipleChoice";
import { sentenceRebuildPlugin } from "./sentenceRebuild";
import type {
  Answer,
  AnyExercisePlugin,
  BuildSkipReason,
  DefinitionPriority,
  Exercise,
  ExerciseKind,
  GradeOutcome,
} from "./types";

// Re-export the lazy API so callers have one import surface (`engine.ts`).
export { createLazyDeck } from "./lazyDeck";
export type { LazyDeck, LazyBuildOptions, SkipRecord } from "./lazyDeck";

/**
 * Plugin registry. Adding a new exercise kind = drop a new plugin file
 * and register it here — engine + UI dispatcher pick it up automatically.
 *
 * The cast is safe because every plugin satisfies `ExercisePlugin<E, A>`
 * for its own narrow types; the registry just erases that pair so we can
 * iterate over heterogeneous plugins.
 */
const PLUGINS: Record<ExerciseKind, AnyExercisePlugin> = {
  flashcard: flashcardPlugin as unknown as AnyExercisePlugin,
  multiple_choice: multipleChoicePlugin as unknown as AnyExercisePlugin,
  audio_recall: audioRecallPlugin as unknown as AnyExercisePlugin,
  definition_match: definitionMatchPlugin as unknown as AnyExercisePlugin,
  sentence_rebuild: sentenceRebuildPlugin as unknown as AnyExercisePlugin,
};

export function getPlugin(kind: ExerciseKind): AnyExercisePlugin {
  const plugin = PLUGINS[kind];
  if (!plugin) throw new Error(`No exercise plugin registered for kind: ${kind}`);
  return plugin;
}

export interface BuildDeckOptions {
  /** Source vocab entries — typically the lesson's `listFullByLesson` result. */
  entries: VocabEntryFull[];
  /** Which kinds to include, in interleave preference order. */
  kinds: ExerciseKind[];
  /**
   * Seed string. Two calls with the same seed + same input always produce
   * the same deck — handy for tests, snapshot comparison, and "replay
   * yesterday's session" features.
   */
  sessionSeed: string;
  /** Soft cap on deck size. Defaults to all generated exercises. */
  maxExercises?: number;
  /** Which language should be preferred when both EN and VI definitions exist. */
  definitionPriority?: DefinitionPriority;
  /** Defaults to true. Disable for predictable entry/plugin order. */
  shuffle?: boolean;
  /** Entries that already have progress for the active student. */
  seenEntryIds?: Iterable<number>;
  /** New entries must be introduced by flashcard before review kinds. */
  requireFlashcardForNew?: boolean;
}

export interface BuildDeckResult {
  exercises: Exercise[];
  /** Per-entry, per-kind reasons we skipped — surfaced in dev for debugging. */
  skipped: Array<{ entryId: number; kind: ExerciseKind; reason: BuildSkipReason }>;
}

/**
 * Generate an exercise deck deterministically from a seed.
 *
 * Eager wrapper around `createLazyDeck` — keeps a single source of truth
 * for intro-gating, deterministic shuffles, and the kind-diversity pass.
 * Callers that want streaming construction should import `createLazyDeck`
 * directly and use `peek` / `prefetch`.
 */
export function buildDeck(opts: BuildDeckOptions): BuildDeckResult {
  const lazy = createLazyDeck({
    entries: opts.entries,
    kinds: opts.kinds,
    sessionSeed: opts.sessionSeed,
    getPlugin,
    definitionPriority: opts.definitionPriority,
    shuffle: opts.shuffle,
    seenEntryIds: opts.seenEntryIds,
    requireFlashcardForNew: opts.requireFlashcardForNew,
    maxExercises: opts.maxExercises,
  });
  return lazy.materialize();
}

/**
 * Type-narrowing grade dispatcher. Validates that the answer kind matches
 * the exercise kind; throws otherwise (the UI layer is the only producer
 * of answers, and a mismatch there is a programmer error).
 */
export function gradeExercise(exercise: Exercise, answer: Answer): GradeOutcome {
  if (exercise.kind !== answer.kind) {
    throw new Error(`Answer kind '${answer.kind}' does not match exercise kind '${exercise.kind}'`);
  }
  const plugin = getPlugin(exercise.kind);
  // The kind check above guarantees the plugin's narrow grade type matches.
  return (plugin.grade as (e: Exercise, a: Answer) => GradeOutcome)(exercise, answer);
}

/** Default seed: timestamp + entry-set fingerprint. Keeps decks fresh across sessions. */
export function defaultSessionSeed(lessonId: number): string {
  return `lesson-${lessonId}-${Date.now()}`;
}
