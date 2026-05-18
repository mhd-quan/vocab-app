/**
 * Definition matching — drag 4 headwords onto 4 definition slots.
 *
 * Build rules:
 *   - Requires `ctx.sourcePool` with at least 4 sources (target + 3
 *     distractors) that each have a usable definition.
 *   - Definitions are pulled per `ctx.definitionPriority`. We dedupe by
 *     headword to avoid pairing the same word twice when an entry has
 *     multiple POS variants.
 *   - The 4 pairs are shuffled within the payload (so the order of
 *     `items` ≠ the matching order); each `pairId` is the truth-link.
 *
 * Grade:
 *   The student's `assignments` are a list `{ definitionPairId, headword }`.
 *   We count exact matches. Full credit only when all four match — this
 *   keeps the SRS rating crisp (correct ⇒ rating=3, miss ⇒ rating=1).
 */
import { sampleWithoutReplacement, shuffle } from "./random";
import type {
  BuildContext,
  DefinitionMatchExercise,
  DefinitionMatchItem,
  ExercisePlugin,
  ExerciseSource,
  GradeOutcome,
} from "./types";

const PAIR_COUNT = 4;

export const definitionMatchPlugin: ExercisePlugin<
  DefinitionMatchExercise,
  {
    kind: "definition_match";
    assignments: Array<{ definitionPairId: string; headword: string }>;
  }
> = {
  kind: "definition_match",

  build(source: ExerciseSource, ctx: BuildContext): DefinitionMatchExercise | null {
    const pool = ctx.sourcePool ?? [];
    const priority = ctx.definitionPriority ?? "en_first";

    const targetDef = pickDefinition(source, priority);
    if (!targetDef) return null;

    // Candidate distractors: every other entry in the pool with a usable
    // definition and a distinct headword.
    const targetLower = source.headword.toLowerCase();
    const candidates: Array<{ source: ExerciseSource; def: string }> = [];
    const seen = new Set<string>([targetLower]);
    for (const candidate of pool) {
      const headLower = candidate.headword.toLowerCase();
      if (seen.has(headLower)) continue;
      const def = pickDefinition(candidate, priority);
      if (!def) continue;
      seen.add(headLower);
      candidates.push({ source: candidate, def });
    }
    if (candidates.length < PAIR_COUNT - 1) return null;

    const distractors = sampleWithoutReplacement(candidates, PAIR_COUNT - 1, ctx.rng);
    const pairs: DefinitionMatchItem[] = [
      {
        pairId: source.ref.sourceKey,
        headword: source.headword,
        definition: targetDef,
      },
      ...distractors.map(({ source: d, def }) => ({
        pairId: d.ref.sourceKey,
        headword: d.headword,
        definition: def,
      })),
    ];

    return {
      id: `definition_match:${source.ref.sourceKey}:${ctx.sessionSeed}`,
      kind: "definition_match",
      entryId: source.id,
      source: source.ref,
      payload: { items: shuffle(pairs, ctx.rng) },
    };
  },

  grade(exercise, answer): GradeOutcome {
    const expected = new Map(exercise.payload.items.map((it) => [it.pairId, it.headword]));
    let correctCount = 0;
    for (const a of answer.assignments) {
      const expectedHeadword = expected.get(a.definitionPairId);
      if (expectedHeadword && expectedHeadword.toLowerCase() === a.headword.toLowerCase()) {
        correctCount++;
      }
    }
    const correct = correctCount === exercise.payload.items.length;
    return {
      correct,
      feedback: correct
        ? "All four matched — nice."
        : `You matched ${correctCount} of ${exercise.payload.items.length}. Try again!`,
      selfGrade: null,
      selectedIndex: null,
    };
  },
};

function pickDefinition(source: ExerciseSource, priority: "en_first" | "vi_first"): string | null {
  const senses = source.senses;
  if (senses.length === 0) return null;
  const primary = senses[0];
  if (!primary) return null;
  const en = primary.definitionEn?.trim() ?? null;
  const vi = primary.definitionVi?.trim() ?? null;
  if (priority === "vi_first") return vi || en;
  return en || vi;
}
