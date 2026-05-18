import { type BuildContext, definitionMatchPlugin, mulberry32 } from "@/modules/exercises";
import { describe, expect, it } from "vitest";
import { makeSource, makeSources } from "./fixtures";

function buildCtx(pool: ReturnType<typeof makeSources>): BuildContext {
  return {
    distractorPool: pool.map((e) => e.headword),
    sourcePool: pool,
    rng: mulberry32(3),
    sessionSeed: "seed-3",
  };
}

function firstEntry(pool: ReturnType<typeof makeSources>) {
  const entry = pool[0];
  if (!entry) throw new Error("Expected fixture pool to contain at least one entry");
  return entry;
}

function buildExercise(pool: ReturnType<typeof makeSources>) {
  const target = firstEntry(pool);
  const ex = definitionMatchPlugin.build(target, buildCtx(pool));
  if (!ex) throw new Error("Expected definition match fixture to build an exercise");
  return ex;
}

describe("definitionMatchPlugin.build", () => {
  it("returns null when the pool has fewer than 4 distinct definitions", () => {
    const pool = makeSources(2);
    const target = firstEntry(pool);
    const ex = definitionMatchPlugin.build(target, buildCtx(pool));
    expect(ex).toBeNull();
  });

  it("builds a 4-item exercise with the target included", () => {
    const pool = makeSources(8);
    const target = firstEntry(pool);
    const ex = definitionMatchPlugin.build(target, buildCtx(pool));
    expect(ex).not.toBeNull();
    expect(ex?.payload.items).toHaveLength(4);
    if (!ex) throw new Error("Expected definition match exercise to build");
    const pairIds = ex.payload.items.map((i) => i.pairId);
    expect(ex.payload.headwords).toHaveLength(4);
    expect(new Set(ex.payload.headwords)).toEqual(new Set(ex.payload.items.map((i) => i.headword)));
    expect(pairIds).toContain(target.ref.sourceKey);
    // All 4 unique
    expect(new Set(pairIds).size).toBe(4);
  });

  it("shuffles headword chips independently from definition rows", () => {
    const pool = makeSources(8);
    const ex = buildExercise(pool);
    expect(ex.payload.headwords).not.toEqual(ex.payload.items.map((i) => i.headword));
  });

  it("dedupes by headword — two pool entries with the same headword count once", () => {
    const base = makeSources(5);
    // Force entries[1] to share the target's headword so the builder
    // should drop it as a duplicate and either build with 4 distinct
    // remaining headwords or return null if the pool falls short.
    const target = firstEntry(base);
    const colliding = makeSource({
      id: 999,
      headword: target.headword,
      senses: [
        {
          id: 9990,
          entryId: 999,
          ordinal: 0,
          definitionEn: "another definition with same headword",
          definitionVi: null,
          register: null,
          domain: null,
          notesMd: null,
        },
      ],
      examples: [],
    });
    const pool = [target, colliding, ...base.slice(1)];
    const ex = definitionMatchPlugin.build(target, buildCtx(pool));
    if (ex) {
      const headwords = ex.payload.items.map((i) => i.headword.toLowerCase());
      expect(new Set(headwords).size).toBe(headwords.length);
    }
  });
});

describe("definitionMatchPlugin.grade", () => {
  it("returns correct=true only when all four assignments match", () => {
    const pool = makeSources(8);
    const ex = buildExercise(pool);
    const allCorrect = ex.payload.items.map((item) => ({
      definitionPairId: item.pairId,
      headword: item.headword,
    }));
    expect(
      definitionMatchPlugin.grade(ex, { kind: "definition_match", assignments: allCorrect })
        .correct,
    ).toBe(true);
  });

  it("returns correct=false when any assignment is swapped", () => {
    const pool = makeSources(8);
    const ex = buildExercise(pool);
    const items = ex.payload.items;
    const swapped = items.map((item, i) => {
      const nextItem = items[(i + 1) % items.length];
      if (!nextItem) throw new Error("Expected definition match exercise to contain pairs");
      return {
        definitionPairId: item.pairId,
        headword: nextItem.headword,
      };
    });
    const result = definitionMatchPlugin.grade(ex, {
      kind: "definition_match",
      assignments: swapped,
    });
    expect(result.correct).toBe(false);
    expect(result.feedback).toMatch(/of 4/);
  });
});
