import {
  type BuildContext,
  mulberry32,
  sentenceRebuildPlugin,
  tokenise,
} from "@/modules/exercises";
import { describe, expect, it } from "vitest";
import { makeEntry } from "./fixtures";

const ctx: BuildContext = {
  distractorPool: [],
  rng: mulberry32(7),
  sessionSeed: "seed-7",
};

function buildExercise() {
  const ex = sentenceRebuildPlugin.build(makeEntry(), ctx);
  if (!ex) throw new Error("Expected sentence rebuild fixture to build an exercise");
  return ex;
}

describe("sentenceRebuildPlugin.build", () => {
  it("builds when the example has ≥ 4 tokens", () => {
    const ex = sentenceRebuildPlugin.build(makeEntry(), ctx);
    expect(ex).not.toBeNull();
    expect(ex?.kind).toBe("sentence_rebuild");
    expect(ex?.payload.correctOrder).toEqual(["I", "have", "many", "relatives", "in", "Hanoi."]);
    expect(ex?.payload.headword).toBe("relative");
    expect(ex?.payload.scrambled.length).toBe(ex?.payload.correctOrder.length);
  });

  it("returns null when the entry has no example sentence", () => {
    const ex = sentenceRebuildPlugin.build(makeEntry({ examples: [] }), ctx);
    expect(ex).toBeNull();
  });

  it("skips sentences shorter than 4 tokens", () => {
    const ex = sentenceRebuildPlugin.build(
      makeEntry({
        examples: [
          {
            id: 1,
            entryId: 1,
            senseId: null,
            ordinal: 0,
            text: "Hi there.",
            translation: null,
            clozeTarget: null,
            clozeHint: null,
            audioRef: null,
            sourceRef: null,
          },
        ],
      }),
      ctx,
    );
    expect(ex).toBeNull();
  });
});

describe("sentenceRebuildPlugin.grade", () => {
  it("correct when tokens match in order", () => {
    const ex = buildExercise();
    const grade = sentenceRebuildPlugin.grade(ex, {
      kind: "sentence_rebuild",
      tokens: ex.payload.correctOrder,
    });
    expect(grade.correct).toBe(true);
  });

  it("incorrect when order is wrong", () => {
    const ex = buildExercise();
    const grade = sentenceRebuildPlugin.grade(ex, {
      kind: "sentence_rebuild",
      tokens: [...ex.payload.correctOrder].reverse(),
    });
    expect(grade.correct).toBe(false);
  });
});

describe("tokenise", () => {
  it("expands {{x|surface}} markers to surface", () => {
    expect(tokenise("I have many {{relative|relatives}} here.")).toEqual([
      "I",
      "have",
      "many",
      "relatives",
      "here.",
    ]);
  });

  it("expands {{x}} bare markers to x", () => {
    expect(tokenise("Walk to {{school}} today.")).toEqual(["Walk", "to", "school", "today."]);
  });

  it("collapses runs of whitespace", () => {
    expect(tokenise("a  b\tc")).toEqual(["a", "b", "c"]);
  });
});
