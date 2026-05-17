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
import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import type { AudioRecallExercise, BuildContext, ExercisePlugin, GradeOutcome } from "./types";

export const audioRecallPlugin: ExercisePlugin<
  AudioRecallExercise,
  { kind: "audio_recall"; spelling: string }
> = {
  kind: "audio_recall",

  build(entry: VocabEntryFull, ctx: BuildContext): AudioRecallExercise | null {
    const audioRef = pickAudioRef(entry);
    if (!audioRef) return null;
    if (!entry.headword.trim()) return null;

    const firstSense = entry.senses[0];
    const gloss = firstSense?.definitionVi?.trim() || firstSense?.definitionEn?.trim() || null;

    return {
      id: `audio_recall:${entry.id}:${ctx.sessionSeed}`,
      kind: "audio_recall",
      entryId: entry.id,
      payload: {
        audioRef,
        audioLabel: "🔊 Listen",
        expectedSpelling: normaliseSpelling(entry.headword),
        displayHeadword: entry.headword,
        hint: gloss
          ? {
              pos: entry.pos,
              gloss,
            }
          : { pos: entry.pos, gloss: null },
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

function pickAudioRef(entry: VocabEntryFull): string | null {
  if (entry.audioRef?.trim()) return entry.audioRef;
  for (const ex of entry.examples) {
    if (ex.audioRef?.trim()) return ex.audioRef;
  }
  return null;
}

/** Lowercase, replace hyphens with spaces, collapse whitespace, trim. */
export function normaliseSpelling(input: string): string {
  return input.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
}
