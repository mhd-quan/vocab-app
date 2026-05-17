/**
 * Sentence rebuild — drag word chips into the correct order.
 *
 * Build rules:
 *   - Needs an example sentence on the entry (first non-empty wins).
 *   - The sentence is stripped of `{{cloze|…}}` markers (we use the
 *     filled form for ordering) and split on whitespace.
 *   - The scrambled order is a seeded shuffle. If the shuffle happens
 *     to land on the canonical order we re-shuffle once; on the rare
 *     coincidence twice (very short sentences) we accept it — better
 *     a tiny "no-op" exercise than a build failure.
 *   - Sentences shorter than 4 tokens are skipped — not enough payoff.
 *
 * Grade:
 *   Strict array equality (case-sensitive, punctuation included). Kids
 *   should reproduce the original ordering exactly.
 */
import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import { shuffle } from "./random";
import type { BuildContext, ExercisePlugin, GradeOutcome, SentenceRebuildExercise } from "./types";

const MIN_TOKENS = 4;
const MAX_TOKENS = 14; // keeps the chip strip manageable on small viewports

const CLOZE_PATTERN = /\{\{[^|}]+\|([^}]+)\}\}/g;
const CLOZE_PLAIN = /\{\{([^}]+)\}\}/g;

export const sentenceRebuildPlugin: ExercisePlugin<
  SentenceRebuildExercise,
  { kind: "sentence_rebuild"; tokens: string[] }
> = {
  kind: "sentence_rebuild",

  build(entry: VocabEntryFull, ctx: BuildContext): SentenceRebuildExercise | null {
    const sentence = pickExampleText(entry);
    if (!sentence) return null;
    const tokens = tokenise(sentence);
    if (tokens.length < MIN_TOKENS || tokens.length > MAX_TOKENS) return null;

    let scrambled = shuffle(tokens, ctx.rng);
    if (equalTokens(scrambled, tokens)) {
      scrambled = shuffle(scrambled, ctx.rng);
    }

    return {
      id: `sentence_rebuild:${entry.id}:${ctx.sessionSeed}`,
      kind: "sentence_rebuild",
      entryId: entry.id,
      payload: {
        scrambled,
        correctOrder: tokens,
        headword: entry.headword,
      },
    };
  },

  grade(exercise, answer): GradeOutcome {
    const correct = equalTokens(answer.tokens, exercise.payload.correctOrder);
    return {
      correct,
      feedback: correct
        ? "Right order — well done!"
        : `Not quite — the sentence is: "${exercise.payload.correctOrder.join(" ")}"`,
      selfGrade: null,
      selectedIndex: null,
    };
  },
};

function pickExampleText(entry: VocabEntryFull): string | null {
  for (const ex of entry.examples) {
    if (ex.text?.trim()) return ex.text.trim();
  }
  return null;
}

/**
 * Resolve `{{word|surface}}` to `surface` and `{{word}}` to `word`,
 * then split on whitespace. Punctuation stays attached to the
 * preceding token — kids drag word-by-word, not letter-by-letter.
 */
export function tokenise(sentence: string): string[] {
  const expanded = sentence
    .replace(CLOZE_PATTERN, (_match, surface: string) => surface)
    .replace(CLOZE_PLAIN, (_match, surface: string) => surface);
  return expanded
    .split(/\s+/)
    .map((tok) => tok.trim())
    .filter(Boolean);
}

function equalTokens(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
