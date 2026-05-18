import { sampleWithoutReplacement, shuffle } from "./random";
import type {
  BuildContext,
  ExerciseAudioRef,
  ExercisePlugin,
  ExerciseSource,
  ExerciseSourceSense,
  GradeOutcome,
  MultipleChoiceExercise,
  MultipleChoiceOption,
} from "./types";

const OPTION_COUNT = 4;
const REQUIRED_DISTRACTORS = OPTION_COUNT - 1;

/**
 * "Pick the headword that matches this definition" — auto-graded.
 *
 * Needs an EN definition for the prompt and at least 3 distinct
 * distractor headwords (case-insensitive) to fill the option set.
 * Returns null when either is missing — the engine just skips the
 * entry for this kind, leaving the deck smaller rather than failing.
 */
export const multipleChoicePlugin: ExercisePlugin<
  MultipleChoiceExercise,
  { kind: "multiple_choice"; selectedIndex: number }
> = {
  kind: "multiple_choice",

  build(source: ExerciseSource, ctx: BuildContext): MultipleChoiceExercise | null {
    const senses = source.senses.slice().sort((a, b) => a.ordinal - b.ordinal);
    const prompt = selectPrompt(senses, ctx.definitionPriority ?? "en_first");
    if (!prompt) return null;

    const targetLower = source.headword.toLowerCase();
    const sourceCandidates = distinctOptionSources(ctx.sourcePool ?? [], targetLower);

    const picks =
      sourceCandidates.length >= REQUIRED_DISTRACTORS
        ? sampleWithoutReplacement(sourceCandidates, REQUIRED_DISTRACTORS, ctx.rng).map((source) =>
            optionFromSource(source),
          )
        : sampleWithoutReplacement(
            ctx.distractorPool.filter((h) => h.toLowerCase() !== targetLower),
            REQUIRED_DISTRACTORS,
            ctx.rng,
          ).map((text) => ({ text, correct: false }));
    if (picks.length < REQUIRED_DISTRACTORS) return null;
    const options: MultipleChoiceOption[] = shuffle(
      [optionFromSource(source, true), ...picks],
      ctx.rng,
    );

    return {
      id: `multiple_choice:${source.ref.sourceKey}:${ctx.sessionSeed}`,
      kind: "multiple_choice",
      entryId: source.id,
      source: source.ref,
      payload: { prompt, options },
    };
  },

  grade(exercise, answer): GradeOutcome {
    const option = exercise.payload.options[answer.selectedIndex];
    const correct = option?.correct === true;
    return {
      correct,
      feedback: correct
        ? `Right — ${exercise.payload.options.find((o) => o.correct)?.text ?? ""}.`
        : `Not quite — the answer is ${
            exercise.payload.options.find((o) => o.correct)?.text ?? "?"
          }.`,
      selfGrade: null,
      selectedIndex: answer.selectedIndex,
    };
  },
};

function distinctOptionSources(
  pool: ReadonlyArray<ExerciseSource>,
  targetLower: string,
): ExerciseSource[] {
  const seen = new Set<string>([targetLower]);
  const out: ExerciseSource[] = [];
  for (const source of pool) {
    const key = source.headword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

function optionFromSource(source: ExerciseSource, correct = false): MultipleChoiceOption {
  const refs = normalizedRefs(source);
  return {
    text: source.headword,
    correct,
    ...(refs.length > 0 ? { audioRefs: refs } : {}),
  };
}

function normalizedRefs(source: ExerciseSource): ExerciseAudioRef[] {
  if (source.audioRefs && source.audioRefs.length > 0) return source.audioRefs;
  if (source.audioRef?.trim()) {
    return [{ ref: source.audioRef, label: "Audio", accent: "other" }];
  }
  return [];
}

function selectPrompt(
  senses: ExerciseSourceSense[],
  priority: "en_first" | "vi_first",
): string | null {
  const preferred =
    priority === "vi_first"
      ? senses.find((s) => s.definitionVi)?.definitionVi?.trim()
      : senses.find((s) => s.definitionEn)?.definitionEn?.trim();
  if (preferred) return preferred;

  return priority === "vi_first"
    ? (senses.find((s) => s.definitionEn)?.definitionEn?.trim() ?? null)
    : (senses.find((s) => s.definitionVi)?.definitionVi?.trim() ?? null);
}
