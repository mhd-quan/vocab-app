import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import { flashcardPlugin } from "./flashcard";
import { multipleChoicePlugin } from "./multipleChoice";
import { rngFromSeed, shuffle } from "./random";
import type {
  Answer,
  AnyExercisePlugin,
  BuildContext,
  Exercise,
  ExerciseKind,
  GradeOutcome,
} from "./types";

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
}

export interface BuildDeckResult {
  exercises: Exercise[];
  /** Per-entry, per-kind reasons we skipped — surfaced in dev for debugging. */
  skipped: Array<{ entryId: number; kind: ExerciseKind; reason: "build_returned_null" }>;
}

/**
 * Generate an exercise deck deterministically from a seed.
 *
 * Strategy: for each entry, ask each requested plugin to build an
 * exercise. Collect the successes, shuffle once with the seeded RNG so
 * adjacent items aren't always the same kind, and trim to `maxExercises`.
 */
export function buildDeck(opts: BuildDeckOptions): BuildDeckResult {
  const rng = rngFromSeed(opts.sessionSeed);
  const distractorPool = opts.entries.map((e) => e.headword);

  const exercises: Exercise[] = [];
  const skipped: BuildDeckResult["skipped"] = [];

  for (const entry of opts.entries) {
    for (const kind of opts.kinds) {
      const plugin = getPlugin(kind);
      const ctx: BuildContext = {
        distractorPool,
        rng,
        sessionSeed: opts.sessionSeed,
      };
      const exercise = plugin.build(entry, ctx);
      if (exercise) {
        exercises.push(exercise);
      } else {
        skipped.push({ entryId: entry.id, kind, reason: "build_returned_null" });
      }
    }
  }

  const shuffled = shuffle(exercises, rng);
  const trimmed =
    typeof opts.maxExercises === "number" && opts.maxExercises >= 0
      ? shuffled.slice(0, opts.maxExercises)
      : shuffled;

  return { exercises: trimmed, skipped };
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
