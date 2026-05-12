import {
  classifyVocabEntry,
  countVocabSections,
  filterVocabEntriesBySections,
  parseStudySectionParam,
} from "@/modules/studySections";
import { describe, expect, it } from "vitest";

describe("studySections", () => {
  const entries = [
    { id: 1, pos: "noun", tags: ["vocabulary"], metadata: null },
    { id: 2, pos: "phrasal_verb", tags: ["phrasal-verb"], metadata: null },
    { id: 3, pos: "collocation", tags: ["collocation"], metadata: null },
    { id: 4, pos: "pattern", tags: ["word_pattern"], metadata: null },
    {
      id: 5,
      pos: "verb",
      tags: ["word-formation"],
      metadata: { related_forms: [{ form: "adaptation", pos: "noun" }] },
    },
  ];

  const entryAt = (index: number) => {
    const entry = entries[index];
    if (!entry) throw new Error(`Missing fixture at index ${index}`);
    return entry;
  };

  it("classifies entries into learner-facing section ids", () => {
    expect(classifyVocabEntry(entryAt(0))).toEqual(["vocabulary"]);
    expect(classifyVocabEntry(entryAt(1))).toEqual(["phrasal_verbs"]);
    expect(classifyVocabEntry(entryAt(2))).toEqual(["phrases_collocations"]);
    expect(classifyVocabEntry(entryAt(3))).toEqual(["word_patterns"]);
    expect(classifyVocabEntry(entryAt(4))).toEqual(["word_formation"]);
  });

  it("filters by one or more selected sections", () => {
    expect(
      filterVocabEntriesBySections(entries, ["phrasal_verbs"]).map((entry) => entry.id),
    ).toEqual([2]);
    expect(
      filterVocabEntriesBySections(entries, ["word_patterns", "word_formation"]).map(
        (entry) => entry.id,
      ),
    ).toEqual([4, 5]);
  });

  it("counts sections and parses URL search params defensively", () => {
    expect(countVocabSections(entries).word_formation).toBe(1);
    expect(parseStudySectionParam("vocabulary,unknown,word_patterns")).toEqual([
      "vocabulary",
      "word_patterns",
    ]);
  });
});
