import {
  cyrb53,
  mulberry32,
  rngFromSeed,
  sampleWithoutReplacement,
  shuffle,
} from "@/modules/exercises";
import { describe, expect, it } from "vitest";

describe("cyrb53", () => {
  it("is deterministic for a given input", () => {
    expect(cyrb53("hello")).toBe(cyrb53("hello"));
  });

  it("differs between unequal inputs", () => {
    expect(cyrb53("abc")).not.toBe(cyrb53("abd"));
  });

  it("returns a 32-bit unsigned int", () => {
    const value = cyrb53("anything");
    expect(value).toBe(value >>> 0);
  });
});

describe("mulberry32", () => {
  it("produces deterministic streams from the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 8; i++) {
      expect(a()).toBe(b());
    }
  });

  it("returns numbers in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rngFromSeed", () => {
  it("produces matching sequences for matching seed strings", () => {
    const a = rngFromSeed("session-7");
    const b = rngFromSeed("session-7");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("diverges between different seeds", () => {
    const a = rngFromSeed("session-7");
    const b = rngFromSeed("session-8");
    expect(a()).not.toBe(b());
  });
});

describe("shuffle", () => {
  it("returns a new array (does not mutate input)", () => {
    const input = [1, 2, 3, 4];
    const out = shuffle(input, mulberry32(1));
    expect(input).toEqual([1, 2, 3, 4]);
    expect(out).not.toBe(input);
  });

  it("preserves the multiset of items", () => {
    const out = shuffle([1, 2, 3, 4, 5], mulberry32(99));
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic given the same RNG seed", () => {
    const a = shuffle([1, 2, 3, 4, 5], mulberry32(7));
    const b = shuffle([1, 2, 3, 4, 5], mulberry32(7));
    expect(a).toEqual(b);
  });

  it("handles empty + single-item arrays", () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
    expect(shuffle(["only"], mulberry32(1))).toEqual(["only"]);
  });
});

describe("sampleWithoutReplacement", () => {
  it("returns exactly `count` distinct items", () => {
    const out = sampleWithoutReplacement([1, 2, 3, 4, 5, 6], 3, mulberry32(11));
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });

  it("returns all items when count >= pool size", () => {
    const out = sampleWithoutReplacement(["a", "b"], 5, mulberry32(11));
    expect(out.slice().sort()).toEqual(["a", "b"]);
  });
});
