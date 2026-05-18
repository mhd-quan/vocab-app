import { type BuildContext, mulberry32, multipleChoicePlugin } from "@/modules/exercises";
import { describe, expect, it } from "vitest";
import { makeSource, makeSources } from "./fixtures";

function makeCtx(distractors: string[] = ["alpha", "beta", "gamma", "delta"]): BuildContext {
  return {
    distractorPool: distractors,
    rng: mulberry32(7),
    sessionSeed: "seed-mc",
  };
}

describe("multipleChoicePlugin.build", () => {
  it("returns null when there are no senses with EN definition", () => {
    const ex = multipleChoicePlugin.build(makeSource({ senses: [] }), makeCtx());
    expect(ex).toBeNull();
  });

  it("returns null when distractor pool is too small", () => {
    const ex = multipleChoicePlugin.build(makeSource(), makeCtx(["only-one"]));
    expect(ex).toBeNull();
  });

  it("excludes the target headword from distractors (case-insensitive)", () => {
    const ex = multipleChoicePlugin.build(
      makeSource(),
      makeCtx(["alpha", "Relative", "RELATIVE", "beta", "gamma"]),
    );
    expect(ex).not.toBeNull();
    const labels = ex?.payload.options.map((o) => o.text.toLowerCase()) ?? [];
    const targetCount = labels.filter((l) => l === "relative").length;
    expect(targetCount).toBe(1);
  });

  it("produces exactly 4 options with 1 correct", () => {
    const ex = multipleChoicePlugin.build(makeSource(), makeCtx());
    expect(ex?.payload.options).toHaveLength(4);
    expect(ex?.payload.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it("uses the EN definition as the prompt", () => {
    const ex = multipleChoicePlugin.build(makeSource(), makeCtx());
    expect(ex?.payload.prompt).toBe("a member of your family");
  });

  it("uses the VI definition as the prompt when definition priority is vi_first", () => {
    const ex = multipleChoicePlugin.build(makeSource(), {
      ...makeCtx(),
      definitionPriority: "vi_first",
    });
    expect(ex?.payload.prompt).toBe("người thân");
  });

  it("is deterministic for a fixed RNG seed", () => {
    const a = multipleChoicePlugin.build(makeSource(), makeCtx());
    const b = multipleChoicePlugin.build(makeSource(), makeCtx());
    expect(a?.payload.options.map((o) => o.text)).toEqual(b?.payload.options.map((o) => o.text));
  });

  it("keeps audio refs on source-backed options", () => {
    const [target, ...distractors] = makeSources(5);
    if (!target) throw new Error("fixture should include a target");
    const ex = multipleChoicePlugin.build(
      { ...target, audioRef: "oald://target__gb_1.mp3" },
      {
        ...makeCtx(),
        sourcePool: distractors.map((source, index) => ({
          ...source,
          audioRef: `oald://distractor_${index}__us_1.mp3`,
        })),
      },
    );
    const correct = ex?.payload.options.find((option) => option.correct);
    expect(correct?.audioRefs).toEqual([
      { ref: "oald://target__gb_1.mp3", label: "Audio", accent: "other" },
    ]);
  });
});

describe("multipleChoicePlugin.grade", () => {
  const ex = multipleChoicePlugin.build(makeSource(), makeCtx());
  if (!ex) throw new Error("fixture should produce a multiple-choice exercise");
  const correctIndex = ex.payload.options.findIndex((o) => o.correct);
  const wrongIndex = ex.payload.options.findIndex((o) => !o.correct);

  it("returns correct=true when the right option is picked", () => {
    const out = multipleChoicePlugin.grade(ex, {
      kind: "multiple_choice",
      selectedIndex: correctIndex,
    });
    expect(out.correct).toBe(true);
    expect(out.selectedIndex).toBe(correctIndex);
  });

  it("returns correct=false for any wrong index", () => {
    const out = multipleChoicePlugin.grade(ex, {
      kind: "multiple_choice",
      selectedIndex: wrongIndex,
    });
    expect(out.correct).toBe(false);
    expect(out.feedback).toMatch(/answer is/i);
  });

  it("returns correct=false for an out-of-range index", () => {
    const out = multipleChoicePlugin.grade(ex, {
      kind: "multiple_choice",
      selectedIndex: 99,
    });
    expect(out.correct).toBe(false);
  });
});
