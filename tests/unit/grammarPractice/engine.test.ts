import { buildGrammarDeck, gradeGrammarExercise, normalizeAnswer } from "@/modules/grammarPractice";
import { describe, expect, it } from "vitest";
import type { GrammarTopicForPractice } from "../../../electron/db/repositories/grammar";

const epoch = new Date(0);

function topic(metadata: Record<string, unknown>): GrammarTopicForPractice {
  return {
    id: 10,
    lessonId: 20,
    sourceId: "present-simple",
    slug: "present-simple",
    title: "Present simple",
    summaryMd: "Habits and routines.",
    explanationMd: null,
    difficulty: 1,
    tags: ["tense"],
    metadata,
    contentHash: "hash",
    createdAt: epoch,
    updatedAt: epoch,
    contentItemId: 30,
  };
}

describe("grammar practice engine", () => {
  it("builds mixed grammar exercises from topic activities", () => {
    const deck = buildGrammarDeck({
      topics: [
        topic({
          activities: [
            {
              kind: "fill_blank",
              sentence: "She {{goes}} to school every day.",
              explanation: "Third person singular takes -s.",
            },
            {
              kind: "choice",
              question: "He usually ___ at 7.",
              options: [
                { text: "go", correct: false },
                { text: "goes", correct: true },
              ],
            },
            {
              kind: "order",
              tokens: ["does", "not", "like", "coffee", "He"],
              answer: "He does not like coffee",
            },
          ],
        }),
      ],
      sessionSeed: "fixed",
      shuffle: false,
    });

    expect(deck.skipped).toEqual([]);
    expect(deck.exercises.map((exercise) => exercise.kind)).toEqual([
      "grammar_fill_blank",
      "grammar_choice",
      "grammar_order",
    ]);
    expect(deck.exercises[0]?.contentItemId).toBe(30);
  });

  it("grades text answers with forgiving case, spacing, and final punctuation", () => {
    expect(normalizeAnswer("  He goes. ")).toBe("he goes");
    const deck = buildGrammarDeck({
      topics: [
        topic({
          activities: [
            {
              kind: "rewrite",
              prompt: "I watch TV after dinner.",
              instruction: "Rewrite with he.",
              answer: "He watches TV after dinner.",
            },
          ],
        }),
      ],
      sessionSeed: "fixed",
      shuffle: false,
    });

    const exercise = deck.exercises[0];
    if (!exercise) throw new Error("exercise not built");
    const outcome = gradeGrammarExercise(exercise, {
      kind: "grammar_rewrite",
      text: "he watches tv after dinner",
    });

    expect(outcome.correct).toBe(true);
  });

  it("falls back to legacy checks as rewrite exercises", () => {
    const deck = buildGrammarDeck({
      topics: [
        topic({
          checks: [
            {
              prompt: "I study -> she ...",
              answer: "She studies.",
            },
          ],
        }),
      ],
      sessionSeed: "fixed",
      shuffle: false,
    });

    expect(deck.exercises).toHaveLength(1);
    expect(deck.exercises[0]?.kind).toBe("grammar_rewrite");
  });
});
