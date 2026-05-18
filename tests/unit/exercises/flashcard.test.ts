import { type BuildContext, flashcardPlugin, mulberry32 } from "@/modules/exercises";
import { describe, expect, it } from "vitest";
import { makeSource } from "./fixtures";

const ctx: BuildContext = {
  distractorPool: [],
  rng: mulberry32(1),
  sessionSeed: "seed-1",
};

describe("flashcardPlugin.build", () => {
  it("returns a flashcard for an entry with sense + IPA + example", () => {
    const ex = flashcardPlugin.build(makeSource(), ctx);
    expect(ex).not.toBeNull();
    expect(ex?.kind).toBe("flashcard");
    expect(ex?.entryId).toBe(1);
    expect(ex?.id).toBe("flashcard:curated:1:seed-1");
    expect(ex?.payload.front.headword).toBe("relative");
    expect(ex?.payload.front.ipa).toBe("/ˈrelətɪv/");
    expect(ex?.payload.back.definitionsEn).toEqual(["a member of your family"]);
    expect(ex?.payload.back.definitionVi).toBe("người thân");
    expect(ex?.payload.back.definitionPriority).toBe("en_first");
    expect(ex?.payload.back.exampleText).toContain("{{relatives}}");
  });

  it("returns null when the entry has no senses", () => {
    const ex = flashcardPlugin.build(makeSource({ senses: [] }), ctx);
    expect(ex).toBeNull();
  });

  it("returns null when senses have neither EN nor VI definitions", () => {
    const ex = flashcardPlugin.build(
      makeSource({
        senses: [
          {
            id: 99,
            entryId: 1,
            ordinal: 0,
            definitionEn: null,
            definitionVi: null,
            register: null,
            domain: null,
            notesMd: null,
          },
        ],
      }),
      ctx,
    );
    expect(ex).toBeNull();
  });

  it("collects all EN definitions in ordinal order", () => {
    const ex = flashcardPlugin.build(
      makeSource({
        senses: [
          {
            id: 1,
            entryId: 1,
            ordinal: 1,
            definitionEn: "second",
            definitionVi: null,
            register: null,
            domain: null,
            notesMd: null,
          },
          {
            id: 2,
            entryId: 1,
            ordinal: 0,
            definitionEn: "first",
            definitionVi: null,
            register: null,
            domain: null,
            notesMd: null,
          },
        ],
      }),
      ctx,
    );
    expect(ex?.payload.back.definitionsEn).toEqual(["first", "second"]);
  });

  it("uses the lowest-ordinal example for the back", () => {
    const ex = flashcardPlugin.build(
      makeSource({
        examples: [
          {
            id: 2,
            entryId: 1,
            senseId: null,
            ordinal: 1,
            text: "second example",
            translation: null,
            clozeTarget: null,
            clozeHint: null,
            audioRef: null,
            sourceRef: null,
          },
          {
            id: 1,
            entryId: 1,
            senseId: null,
            ordinal: 0,
            text: "first example",
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
    expect(ex?.payload.back.exampleText).toBe("first example");
  });
});

describe("flashcardPlugin.grade", () => {
  const ex = flashcardPlugin.build(makeSource(), ctx);
  if (!ex) throw new Error("fixture should produce a flashcard");

  it("marks 'good' and 'easy' as correct", () => {
    expect(flashcardPlugin.grade(ex, { kind: "flashcard", grade: "good" }).correct).toBe(true);
    expect(flashcardPlugin.grade(ex, { kind: "flashcard", grade: "easy" }).correct).toBe(true);
  });

  it("marks 'again' and 'hard' as incorrect", () => {
    expect(flashcardPlugin.grade(ex, { kind: "flashcard", grade: "again" }).correct).toBe(false);
    expect(flashcardPlugin.grade(ex, { kind: "flashcard", grade: "hard" }).correct).toBe(false);
  });

  it("preserves the self-grade in the outcome", () => {
    expect(flashcardPlugin.grade(ex, { kind: "flashcard", grade: "good" }).selfGrade).toBe("good");
  });
});
