/**
 * Audio recall — "hear the word, type the spelling".
 *
 * Build rules:
 *   - Requires `entry.audioRef` OR at least one `examples[*].audioRef`.
 *   - Expected spelling is `entry.headword` normalised to lowercase +
 *     single-spaced; `displayHeadword` keeps the original casing for
 *     post-grade feedback.
 *   - Optional hint surfaces POS and the first available translation —
 *     useful for 8-year-olds who may know the word in Vietnamese but
 *     can't spell it cold.
 *
 * Grade:
 *   Case-insensitive, whitespace-collapsed string compare. Hyphens are
 *   treated as spaces so "ice-cream" ≈ "ice cream" (curricular YAML is
 *   inconsistent on this).
 */
import type {
  AudioRecallExercise,
  BuildContext,
  ExercisePlugin,
  ExerciseSource,
  GradeOutcome,
} from "./types";

export const audioRecallPlugin: ExercisePlugin<
  AudioRecallExercise,
  { kind: "audio_recall"; spelling: string }
> = {
  kind: "audio_recall",

  build(source: ExerciseSource, ctx: BuildContext): AudioRecallExercise | null {
    const audioRef = pickAudioRef(source);
    if (!audioRef) return null;
    if (!source.headword.trim()) return null;

    const firstSense = source.senses[0];
    const gloss = firstSense?.definitionVi?.trim() || firstSense?.definitionEn?.trim() || null;

    return {
      id: `audio_recall:${source.ref.sourceKey}:${ctx.sessionSeed}`,
      kind: "audio_recall",
      entryId: source.id,
      source: source.ref,
      payload: {
        audioRef,
        audioLabel: "🔊 Listen",
        expectedSpelling: normaliseSpelling(source.headword),
        displayHeadword: source.headword,
        hint: gloss
          ? {
              pos: source.pos,
              gloss,
            }
          : { pos: source.pos, gloss: null },
      },
    };
  },

  grade(exercise, answer): GradeOutcome {
    const expected = exercise.payload.expectedSpelling;
    const actual = normaliseSpelling(answer.spelling);
    const correct = actual === expected;
    return {
      correct,
      feedback: correct
        ? `Right — "${exercise.payload.displayHeadword}".`
        : `Not quite — the word is "${exercise.payload.displayHeadword}".`,
      selfGrade: null,
      selectedIndex: null,
    };
  },
};

function pickAudioRef(source: ExerciseSource): string | null {
  if (source.audioRef?.trim()) return source.audioRef;
  for (const ex of source.examples) {
    if (ex.audioRef?.trim()) return ex.audioRef;
  }
  return null;
}

/** Lowercase, replace hyphens with spaces, collapse whitespace, trim. */
export function normaliseSpelling(input: string): string {
  return input.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
}
