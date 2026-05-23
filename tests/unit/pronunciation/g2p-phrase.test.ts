import { buildPhrasePronunciationTarget } from "@/modules/pronunciation";
import { describe, expect, it } from "vitest";

const lookup = (entries: Record<string, string>) => (word: string) => entries[word] ?? null;

describe("phrase pronunciation target", () => {
  it("concatenates per-word phonemes and records phoneme ranges", () => {
    const target = buildPhrasePronunciationTarget("I want to go", null, {
      lookup: lookup({
        i: "AY1",
        want: "W AO1 N T",
        to: "T UW1",
        go: "G OW1",
      }),
    });
    expect(target.phonemes).toEqual(["AY", "W", "AO", "N", "T", "T", "UW", "G", "OW"]);
    expect(target.source).toBe("cmudict");
    expect(target.words).toHaveLength(4);
    expect(target.words?.[0]).toEqual({
      text: "I",
      phonemeRange: [0, 1],
      source: "cmudict",
    });
    expect(target.words?.[3]?.phonemeRange).toEqual([7, 9]);
  });

  it("short-circuits to single-word builder when only one word is supplied", () => {
    const target = buildPhrasePronunciationTarget("relative", null, {
      lookup: lookup({ relative: "R EH1 L AH0 T IH0 V" }),
    });
    expect(target.words).toBeUndefined();
    expect(target.phonemes.length).toBeGreaterThan(0);
    expect(target.source).toBe("cmudict");
  });

  it("marks the target as mixed when word sources diverge", () => {
    const target = buildPhrasePronunciationTarget("hello xyzzy", null, {
      lookup: lookup({ hello: "HH AH0 L OW1" }),
    });
    expect(target.source).toBe("mixed");
    expect(target.words?.map((w) => w.source)).toEqual(["cmudict", "heuristic"]);
  });

  it("ignores phrase IPA hints whose token count diverges from the word count", () => {
    const target = buildPhrasePronunciationTarget("I want", "/aɪ/", {
      lookup: lookup({
        i: "AY1",
        want: "W AO1 N T",
      }),
    });
    // Token-count mismatch (1 vs 2): IPA hint dropped; both words come from CMU.
    expect(target.words).toHaveLength(2);
    expect(target.source).toBe("cmudict");
  });
});
