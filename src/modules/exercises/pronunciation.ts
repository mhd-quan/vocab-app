import type {
  BuildContext,
  ExerciseAudioRef,
  ExercisePlugin,
  ExerciseSource,
  GradeOutcome,
  PronunciationAttempt,
  PronunciationExercise,
} from "./types";

/**
 * "Say the word — we'll score it" — auto-graded against the runtime
 * pronunciation policy.
 *
 * The actual scoring runs in the UI (the card calls
 * `api.pronunciation.assess` and packs the result into the answer), so
 * `grade()` stays sync and just maps the precomputed pass flag onto the
 * outcome. Failing attempts set `needsRetry` so the SessionPlayer holds
 * the card; persistence still fires every attempt (FSRS counts the
 * lapse).
 *
 * Build returns null when the source has neither an audio reference nor
 * an IPA — without one, the student has nothing to imitate.
 */

const PASSING_SCORE = 70;

export const pronunciationPlugin: ExercisePlugin<
  PronunciationExercise,
  { kind: "pronunciation"; attempt: PronunciationAttempt }
> = {
  kind: "pronunciation",

  build(source: ExerciseSource, ctx: BuildContext): PronunciationExercise | null {
    const referenceAudio = normalizedAudioRefs(source);
    if (referenceAudio.length === 0 && !source.ipa) return null;

    return {
      id: `pronunciation:${source.ref.sourceKey}:${ctx.sessionSeed}`,
      kind: "pronunciation",
      entryId: source.id,
      source: source.ref,
      payload: {
        headword: source.headword,
        ipa: source.ipa,
        referenceAudio,
        passingScore: PASSING_SCORE,
      },
    };
  },

  grade(exercise, answer): GradeOutcome {
    const { attempt } = answer;
    const cutoff = exercise.payload.passingScore;
    const passed = attempt.passed;
    const score = Math.round(attempt.overallScore);
    return {
      correct: passed,
      feedback: passed ? `Nice — ${score}/100.` : `Try again — ${score}/100 (need ${cutoff}+).`,
      selfGrade: null,
      selectedIndex: null,
      needsRetry: !passed,
    };
  },
};

function normalizedAudioRefs(source: ExerciseSource): ExerciseAudioRef[] {
  if (source.audioRefs && source.audioRefs.length > 0) return source.audioRefs;
  if (source.audioRef?.trim()) {
    return [{ ref: source.audioRef, label: "Audio", accent: "other" }];
  }
  return [];
}
