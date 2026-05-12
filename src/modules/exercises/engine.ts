import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import { flashcardPlugin } from "./flashcard";
import { multipleChoicePlugin } from "./multipleChoice";
import { rngFromSeed, shuffle } from "./random";
import type {
  Answer,
  AnyExercisePlugin,
  BuildContext,
  BuildSkipReason,
  DefinitionPriority,
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
 * Strategy: for each entry, ask each requested plugin to build an
 * exercise. Collect the successes, shuffle with the seeded RNG so adjacent
 * items aren't always the same kind, and trim to `maxExercises`.
 *
 * When `requireFlashcardForNew` is enabled, entries missing from
 * `seenEntryIds` are put through a flashcard-only intro phase. This
 * keeps a brand-new word's first contact explanatory before the student
 * sees recall/recognition drills.
 */
export function buildDeck(opts: BuildDeckOptions): BuildDeckResult {
  const rng = rngFromSeed(opts.sessionSeed);
  const distractorPool = opts.entries.map((e) => e.headword);
  const seenEntryIds = new Set(opts.seenEntryIds ?? []);
  const shouldGateNewEntries = opts.requireFlashcardForNew === true;

  const introExercises: Exercise[] = [];
  const reviewExercises: Exercise[] = [];
  const skipped: BuildDeckResult["skipped"] = [];

  const buildForKind = (entry: VocabEntryFull, kind: ExerciseKind): Exercise | null => {
    const plugin = getPlugin(kind);
    const ctx: BuildContext = {
      distractorPool,
      definitionPriority: opts.definitionPriority ?? "en_first",
      rng,
      sessionSeed: opts.sessionSeed,
    };
    return plugin.build(entry, ctx);
  };

  for (const entry of opts.entries) {
    const isNewEntry = shouldGateNewEntries && !seenEntryIds.has(entry.id);
    if (isNewEntry) {
      const flashcard = buildForKind(entry, "flashcard");
      if (flashcard) {
        introExercises.push(flashcard);
      } else {
        skipped.push({ entryId: entry.id, kind: "flashcard", reason: "build_returned_null" });
      }

      for (const kind of opts.kinds) {
        if (kind !== "flashcard") {
          skipped.push({ entryId: entry.id, kind, reason: "requires_flashcard_first" });
        }
      }
      continue;
    }

    for (const kind of opts.kinds) {
      const exercise = buildForKind(entry, kind);
      if (exercise) {
        reviewExercises.push(exercise);
      } else {
        skipped.push({ entryId: entry.id, kind, reason: "build_returned_null" });
      }
    }
  }

  const ordered =
    opts.shuffle === false
      ? [...introExercises, ...reviewExercises]
      : [...shuffle(introExercises, rng), ...shuffle(reviewExercises, rng)];
  const trimmed =
    typeof opts.maxExercises === "number" && opts.maxExercises >= 0
      ? ordered.slice(0, opts.maxExercises)
      : ordered;

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
