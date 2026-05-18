import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import { fromVocabEntry } from "../../../src/modules/exercises/sources";

const epoch = new Date(0);

export function makeEntry(overrides: Partial<VocabEntryFull> = {}): VocabEntryFull {
  const id = overrides.id ?? 1;
  return {
    id,
    lessonId: 100,
    sourceId: `entry-${id}`,
    headword: "relative",
    lemma: null,
    pos: "noun",
    ipa: "/ˈrelətɪv/",
    cefrLevel: "B1",
    frequencyRank: null,
    imageRef: null,
    audioRef: null,
    tags: ["family"],
    metadata: null,
    contentHash: "h",
    createdAt: epoch,
    updatedAt: epoch,
    senses: [
      {
        id: id * 10,
        entryId: id,
        ordinal: 0,
        definitionEn: "a member of your family",
        definitionVi: "người thân",
        register: "neutral",
        domain: null,
        notesMd: null,
      },
    ],
    examples: [
      {
        id: id * 10 + 1,
        entryId: id,
        senseId: null,
        ordinal: 0,
        text: "I have many {{relatives}} in Hanoi.",
        translation: "Tôi có nhiều họ hàng.",
        clozeTarget: "relatives",
        clozeHint: null,
        audioRef: null,
        sourceRef: null,
      },
    ],
    forms: [],
    collocations: [],
    relations: [],
    ...overrides,
  };
}

export function makeEntries(count: number, baseId = 1): VocabEntryFull[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry({
      id: baseId + i,
      sourceId: `entry-${baseId + i}`,
      headword: `word${baseId + i}`,
      pos: "noun",
      senses: [
        {
          id: (baseId + i) * 10,
          entryId: baseId + i,
          ordinal: 0,
          definitionEn: `definition for word${baseId + i}`,
          definitionVi: null,
          register: null,
          domain: null,
          notesMd: null,
        },
      ],
      examples: [],
    }),
  );
}

export function makeSource(overrides: Partial<VocabEntryFull> = {}) {
  return fromVocabEntry(makeEntry(overrides));
}

export function makeSources(count: number, baseId = 1) {
  return makeEntries(count, baseId).map(fromVocabEntry);
}
