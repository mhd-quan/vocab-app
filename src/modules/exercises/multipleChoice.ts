import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import { sampleWithoutReplacement, shuffle } from "./random";
import type {
  BuildContext,
  ExercisePlugin,
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

  build(entry: VocabEntryFull, ctx: BuildContext): MultipleChoiceExercise | null {
    const prompt = entry.senses
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal)
      .find((s) => s.definitionEn)
      ?.definitionEn?.trim();
    if (!prompt) return null;

    const targetLower = entry.headword.toLowerCase();
    const distractors = ctx.distractorPool.filter((h) => h.toLowerCase() !== targetLower);
    if (distractors.length < REQUIRED_DISTRACTORS) return null;

    const picks = sampleWithoutReplacement(distractors, REQUIRED_DISTRACTORS, ctx.rng);
    const options: MultipleChoiceOption[] = shuffle(
      [{ text: entry.headword, correct: true }, ...picks.map((text) => ({ text, correct: false }))],
      ctx.rng,
    );

    return {
      id: `multiple_choice:${entry.id}:${ctx.sessionSeed}`,
      kind: "multiple_choice",
      entryId: entry.id,
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
