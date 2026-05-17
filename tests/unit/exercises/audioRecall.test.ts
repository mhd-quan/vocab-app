import {
  type BuildContext,
  audioRecallPlugin,
  mulberry32,
  normaliseSpelling,
} from "@/modules/exercises";
import { describe, expect, it } from "vitest";
import { makeEntry } from "./fixtures";

const ctx: BuildContext = {
  distractorPool: [],
  rng: mulberry32(1),
  sessionSeed: "seed-1",
};

describe("audioRecallPlugin.build", () => {
  it("returns null when entry has no audio anywhere", () => {
    const ex = audioRecallPlugin.build(makeEntry({ audioRef: null, examples: [] }), ctx);
    expect(ex).toBeNull();
  });

  it("uses entry.audioRef when present", () => {
    const ex = audioRecallPlugin.build(makeEntry({ audioRef: "sound://relative_uk_1" }), ctx);
    expect(ex).not.toBeNull();
    expect(ex?.payload.audioRef).toBe("sound://relative_uk_1");
    expect(ex?.payload.expectedSpelling).toBe("relative");
    expect(ex?.payload.displayHeadword).toBe("relative");
  });

  it("falls back to first example.audioRef when entry has no audioRef", () => {
    const ex = audioRecallPlugin.build(
      makeEntry({
        audioRef: null,
        examples: [
          {
            id: 1,
            entryId: 1,
            senseId: null,
            ordinal: 0,
            text: "Hi.",
            translation: null,
            clozeTarget: null,
            clozeHint: null,
            audioRef: "sound://relative_example",
            sourceRef: null,
          },
        ],
      }),
      ctx,
    );
    expect(ex?.payload.audioRef).toBe("sound://relative_example");
  });

  it("emits a Vietnamese hint when available", () => {
    const ex = audioRecallPlugin.build(makeEntry({ audioRef: "x" }), ctx);
    expect(ex?.payload.hint?.gloss).toBe("người thân");
    expect(ex?.payload.hint?.pos).toBe("noun");
  });
});

describe("audioRecallPlugin.grade", () => {
  function buildExercise() {
    const ex = audioRecallPlugin.build(
      makeEntry({ audioRef: "sound://relative", headword: "Ice-cream" }),
      ctx,
    );
    if (!ex) throw new Error("Expected audio recall fixture to build an exercise");
    return ex;
  }

  it("grades correctly for exact match (ignoring case)", () => {
    const ex = buildExercise();
    const grade = audioRecallPlugin.grade(ex, { kind: "audio_recall", spelling: "Ice-cream" });
    expect(grade.correct).toBe(true);
  });

  it("grades correctly when hyphen replaced by space", () => {
    const ex = buildExercise();
    const grade = audioRecallPlugin.grade(ex, { kind: "audio_recall", spelling: "ice cream" });
    expect(grade.correct).toBe(true);
  });

  it("grades incorrectly for misspellings", () => {
    const ex = buildExercise();
    const grade = audioRecallPlugin.grade(ex, { kind: "audio_recall", spelling: "icecreams" });
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toContain("Ice-cream");
  });
});

describe("normaliseSpelling", () => {
  it("lowercases, normalises hyphens, collapses spaces", () => {
    expect(normaliseSpelling("  Ice-CREAM  cone")).toBe("ice cream cone");
  });
});
