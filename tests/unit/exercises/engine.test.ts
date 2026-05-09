import {
  type Exercise,
  buildDeck,
  defaultSessionSeed,
  getPlugin,
  gradeExercise,
} from "@/modules/exercises";
import { describe, expect, it } from "vitest";
import { makeEntries, makeEntry } from "./fixtures";

describe("buildDeck", () => {
  it("produces a flashcard + multiple-choice pair per entry when possible", () => {
    const result = buildDeck({
      entries: makeEntries(5),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-A",
    });
    // Each of the 5 entries can produce both kinds (5 entries gives 4 distractors).
    expect(result.exercises).toHaveLength(10);
    expect(result.skipped).toEqual([]);
  });

  it("skips multiple-choice when the distractor pool is too small", () => {
    const result = buildDeck({
      entries: makeEntries(2),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-B",
    });
    // 2 entries → 1 viable distractor each; multiple-choice is skipped.
    const kinds = result.exercises.map((e) => e.kind).sort();
    expect(kinds).toEqual(["flashcard", "flashcard"]);
    expect(result.skipped).toEqual([
      { entryId: 1, kind: "multiple_choice", reason: "build_returned_null" },
      { entryId: 2, kind: "multiple_choice", reason: "build_returned_null" },
    ]);
  });

  it("is deterministic for a given seed (same exercises, same order)", () => {
    const a = buildDeck({
      entries: makeEntries(8),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-determ",
    });
    const b = buildDeck({
      entries: makeEntries(8),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-determ",
    });
    expect(a.exercises.map((e) => e.id)).toEqual(b.exercises.map((e) => e.id));
  });

  it("changes order across different seeds", () => {
    const a = buildDeck({
      entries: makeEntries(8),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-X",
    });
    const b = buildDeck({
      entries: makeEntries(8),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-Y",
    });
    expect(a.exercises.map((e) => e.id)).not.toEqual(b.exercises.map((e) => e.id));
  });

  it("trims the deck to maxExercises", () => {
    const result = buildDeck({
      entries: makeEntries(5),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-trim",
      maxExercises: 3,
    });
    expect(result.exercises).toHaveLength(3);
  });

  it("returns an empty deck when entries is empty", () => {
    const result = buildDeck({
      entries: [],
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-empty",
    });
    expect(result.exercises).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("respects the kinds list (flashcard-only)", () => {
    const result = buildDeck({
      entries: makeEntries(3),
      kinds: ["flashcard"],
      sessionSeed: "seed-fc",
    });
    expect(result.exercises.every((e) => e.kind === "flashcard")).toBe(true);
  });
});

describe("getPlugin", () => {
  it("returns the right plugin for each kind", () => {
    expect(getPlugin("flashcard").kind).toBe("flashcard");
    expect(getPlugin("multiple_choice").kind).toBe("multiple_choice");
  });
});

describe("gradeExercise dispatcher", () => {
  it("routes flashcard answers to the flashcard plugin", () => {
    const fc = buildDeck({
      entries: [makeEntry()],
      kinds: ["flashcard"],
      sessionSeed: "x",
    }).exercises[0] as Exercise;
    const out = gradeExercise(fc, { kind: "flashcard", grade: "good" });
    expect(out.correct).toBe(true);
    expect(out.selfGrade).toBe("good");
  });

  it("throws on a kind mismatch (programmer error path)", () => {
    const fc = buildDeck({
      entries: [makeEntry()],
      kinds: ["flashcard"],
      sessionSeed: "x",
    }).exercises[0] as Exercise;
    expect(() => gradeExercise(fc, { kind: "multiple_choice", selectedIndex: 0 })).toThrow(
      /does not match/,
    );
  });
});

describe("defaultSessionSeed", () => {
  it("includes the lesson id and increments per call", () => {
    const a = defaultSessionSeed(42);
    expect(a).toMatch(/^lesson-42-\d+$/);
  });
});
