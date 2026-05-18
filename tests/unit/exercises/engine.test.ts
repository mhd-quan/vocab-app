import {
  type Exercise,
  buildDeck,
  defaultSessionSeed,
  fromDictionaryItem,
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
    expect([...result.skipped].sort((a, b) => a.entryId - b.entryId)).toEqual([
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

  it("can keep source order when shuffle is disabled", () => {
    const result = buildDeck({
      entries: makeEntries(2),
      kinds: ["flashcard"],
      sessionSeed: "seed-no-shuffle",
      shuffle: false,
    });
    expect(result.exercises.map((e) => e.entryId)).toEqual([1, 2]);
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

  it("introduces unseen entries with flashcards before review exercises", () => {
    const result = buildDeck({
      entries: makeEntries(5),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-intro",
      seenEntryIds: [1, 2],
      requireFlashcardForNew: true,
      shuffle: false,
    });

    expect(result.exercises.map((e) => `${e.entryId}:${e.kind}`)).toEqual([
      "1:flashcard",
      "1:multiple_choice",
      "2:flashcard",
      "2:multiple_choice",
      "3:flashcard",
      "3:multiple_choice",
      "4:flashcard",
      "4:multiple_choice",
      "5:flashcard",
      "5:multiple_choice",
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("adds an intro flashcard before the selected review kind for unseen entries", () => {
    const result = buildDeck({
      entries: makeEntries(4),
      kinds: ["multiple_choice"],
      sessionSeed: "seed-new-mc",
      seenEntryIds: [],
      requireFlashcardForNew: true,
      shuffle: false,
    });

    expect(result.exercises.map((e) => e.kind)).toEqual([
      "flashcard",
      "multiple_choice",
      "flashcard",
      "multiple_choice",
      "flashcard",
      "multiple_choice",
      "flashcard",
      "multiple_choice",
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("builds the same plugins from personal dictionary sources", () => {
    const items = Array.from({ length: 4 }, (_, index) => dictionaryItem(index + 1));
    const result = buildDeck({
      sources: items.map(fromDictionaryItem),
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: "seed-personal",
      shuffle: false,
    });

    expect(result.exercises.map((exercise) => exercise.source.track)).toEqual([
      "personal",
      "personal",
      "personal",
      "personal",
      "personal",
      "personal",
      "personal",
      "personal",
    ]);
    expect(result.exercises.map((exercise) => exercise.kind)).toEqual([
      "flashcard",
      "multiple_choice",
      "flashcard",
      "multiple_choice",
      "flashcard",
      "multiple_choice",
      "flashcard",
      "multiple_choice",
    ]);
  });
});

describe("getPlugin", () => {
  it("returns the right plugin for each kind", () => {
    expect(getPlugin("flashcard").kind).toBe("flashcard");
    expect(getPlugin("multiple_choice").kind).toBe("multiple_choice");
  });
});

function dictionaryItem(id: number) {
  return {
    id,
    studentId: 1,
    dictionaryKey: `word-${id}`,
    headword: `word${id}`,
    pos: "noun" as const,
    ipa: null,
    cefrLevel: null,
    definitionEn: `definition for word${id}`,
    definitionVi: null,
    exampleText: `I use word${id} today.`,
    exampleTranslation: null,
    audioRef: null,
    status: "learning" as const,
    stage: "flashcard" as const,
    stability: 0,
    difficulty: 5,
    reps: 0,
    lapses: 0,
    totalCorrect: 0,
    totalWrong: 0,
    lastReviewedAt: null,
    nextDueAt: null,
    updatedAt: new Date(0),
  };
}

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
