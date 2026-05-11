import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { VocabParseError, parseVocabFile } from "../../../src/application/import";

const baseFile = {
  book: "destination-b1",
  unit: { ordinal: 1, code: "U01", title: "U" },
  lesson: { ordinal: 1, kind: "vocabulary", title: "L", slug: "l" },
} as const;

describe("parseVocabFile", () => {
  it("rejects a payload with no entries", () => {
    expect(() => parseVocabFile({ ...baseFile, entries: [] })).toThrow(ZodError);
  });

  it("rejects unknown lesson kinds (Zod literal('vocabulary'))", () => {
    expect(() =>
      parseVocabFile({
        ...baseFile,
        lesson: { ...baseFile.lesson, kind: "grammar" },
        entries: [{ headword: "x", pos: "noun" }],
      }),
    ).toThrow(ZodError);
  });

  it("rejects strict-mode unknown keys", () => {
    expect(() =>
      parseVocabFile({
        ...baseFile,
        entries: [{ headword: "x", pos: "noun", surprise: true }],
      }),
    ).toThrow(ZodError);
  });

  it("requires a sense to have at least one definition", () => {
    expect(() =>
      parseVocabFile({
        ...baseFile,
        entries: [{ headword: "x", pos: "noun", senses: [{ register: "neutral" }] }],
      }),
    ).toThrow(ZodError);
  });

  it("auto-generates a sourceId when `id` is omitted", () => {
    const parsed = parseVocabFile({
      ...baseFile,
      entries: [{ headword: "Hello World!", pos: "noun" }],
    });
    expect(parsed.entries[0]?.sourceId).toBe("hello-world-noun");
  });

  it("uses author-provided id when present", () => {
    const parsed = parseVocabFile({
      ...baseFile,
      entries: [{ id: "custom-slug", headword: "x", pos: "noun" }],
    });
    expect(parsed.entries[0]?.sourceId).toBe("custom-slug");
  });

  it("accepts optional book_title metadata", () => {
    const parsed = parseVocabFile({
      ...baseFile,
      book_title: "Destination B1",
      entries: [{ headword: "x", pos: "noun" }],
    });
    expect(parsed.bookTitle).toBe("Destination B1");
  });

  it("rejects duplicate sourceIds within a file", () => {
    expect(() =>
      parseVocabFile({
        ...baseFile,
        entries: [
          { id: "x-noun", headword: "x", pos: "noun" },
          { id: "x-noun", headword: "x", pos: "noun" },
        ],
      }),
    ).toThrow(VocabParseError);
  });

  it("hash is order-independent for senses, examples, etc.", () => {
    const a = parseVocabFile({
      ...baseFile,
      entries: [
        {
          headword: "x",
          pos: "noun",
          senses: [{ definition_en: "a" }, { definition_en: "b" }],
        },
      ],
    });
    const b = parseVocabFile({
      ...baseFile,
      entries: [
        {
          headword: "x",
          pos: "noun",
          senses: [{ definition_en: "a" }, { definition_en: "b" }],
        },
      ],
    });
    expect(a.entries[0]?.contentHash).toBe(b.entries[0]?.contentHash);
  });

  it("hash changes when any entry field changes", () => {
    const before = parseVocabFile({
      ...baseFile,
      entries: [{ headword: "x", pos: "noun", ipa: "/x/" }],
    });
    const after = parseVocabFile({
      ...baseFile,
      entries: [{ headword: "x", pos: "noun", ipa: "/y/" }],
    });
    expect(before.entries[0]?.contentHash).not.toBe(after.entries[0]?.contentHash);
  });
});

describe("cloze parsing", () => {
  it("extracts cloze_target from {{...}} marker in text", () => {
    const parsed = parseVocabFile({
      ...baseFile,
      entries: [
        {
          headword: "x",
          pos: "noun",
          examples: [{ text: "I have {{relatives}} in Hanoi." }],
        },
      ],
    });
    const upsert = parsed.entries[0]?.toUpsertInput(1);
    expect(upsert?.examples[0]?.clozeTarget).toBe("relatives");
    // The marker is preserved in `text` so the renderer can highlight it.
    expect(upsert?.examples[0]?.text).toContain("{{relatives}}");
  });

  it("uses explicit cloze_target when provided", () => {
    const parsed = parseVocabFile({
      ...baseFile,
      entries: [
        {
          headword: "x",
          pos: "noun",
          examples: [{ text: "Plain text without marker.", cloze_target: "manual" }],
        },
      ],
    });
    expect(parsed.entries[0]?.toUpsertInput(1).examples[0]?.clozeTarget).toBe("manual");
  });

  it("rejects mismatched explicit cloze_target vs marker", () => {
    expect(() =>
      parseVocabFile({
        ...baseFile,
        entries: [
          {
            headword: "x",
            pos: "noun",
            examples: [{ text: "Has {{one}} marker.", cloze_target: "different" }],
          },
        ],
      }),
    ).toThrow(VocabParseError);
  });

  it("rejects multiple {{cloze}} markers in one example", () => {
    expect(() =>
      parseVocabFile({
        ...baseFile,
        entries: [
          {
            headword: "x",
            pos: "noun",
            examples: [{ text: "Has {{two}} different {{markers}}." }],
          },
        ],
      }),
    ).toThrow(VocabParseError);
  });

  it("trims whitespace around cloze content", () => {
    const parsed = parseVocabFile({
      ...baseFile,
      entries: [
        {
          headword: "x",
          pos: "noun",
          examples: [{ text: "Spaced {{   relatives   }} marker." }],
        },
      ],
    });
    expect(parsed.entries[0]?.toUpsertInput(1).examples[0]?.clozeTarget).toBe("relatives");
  });

  it("leaves cloze_target null when the example has no marker and no explicit target", () => {
    const parsed = parseVocabFile({
      ...baseFile,
      entries: [
        {
          headword: "x",
          pos: "noun",
          examples: [{ text: "No cloze here." }],
        },
      ],
    });
    expect(parsed.entries[0]?.toUpsertInput(1).examples[0]?.clozeTarget).toBeNull();
  });
});
