import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import type {
  BuildContext,
  ExercisePlugin,
  FlashcardExercise,
  GradeOutcome,
  SelfGrade,
} from "./types";

/**
 * Self-graded flip card. Front shows the headword + POS + IPA; back shows
 * the EN/VI definitions and the first example. The student picks one of
 * four buttons (Again / Hard / Good / Easy) — those map directly to the
 * SRS update we'll wire in PR #8.
 *
 * Build returns null only when the entry has no senses at all; without a
 * back side a card is useless. Most other fields gracefully degrade.
 */
export const flashcardPlugin: ExercisePlugin<
  FlashcardExercise,
  { kind: "flashcard"; grade: SelfGrade }
> = {
  kind: "flashcard",

  build(entry: VocabEntryFull, ctx: BuildContext): FlashcardExercise | null {
    if (entry.senses.length === 0) return null;

    const senses = entry.senses.slice().sort((a, b) => a.ordinal - b.ordinal);
    const definitionsEn = senses
      .map((s) => s.definitionEn?.trim())
      .filter((s): s is string => Boolean(s));
    const definitionVi = senses.find((s) => s.definitionVi)?.definitionVi?.trim() ?? null;
    const exampleText =
      entry.examples.slice().sort((a, b) => a.ordinal - b.ordinal)[0]?.text ?? null;

    if (definitionsEn.length === 0 && !definitionVi) return null;

    return {
      id: `flashcard:${entry.id}:${ctx.sessionSeed}`,
      kind: "flashcard",
      entryId: entry.id,
      payload: {
        front: {
          headword: entry.headword,
          pos: entry.pos,
          ipa: entry.ipa ?? null,
        },
        back: {
          definitionsEn,
          definitionVi,
          exampleText,
        },
      },
    };
  },

  grade(_exercise, answer): GradeOutcome {
    return {
      correct: answer.grade === "good" || answer.grade === "easy",
      feedback: GRADE_FEEDBACK[answer.grade],
      selfGrade: answer.grade,
      selectedIndex: null,
    };
  },
};

const GRADE_FEEDBACK: Record<SelfGrade, string> = {
  again: "Marked for review — we'll come back to this one.",
  hard: "Got it, but it took some thinking.",
  good: "Nice — you knew it.",
  easy: "Easy! We'll show this less often.",
};
