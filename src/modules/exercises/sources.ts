import type { DictionaryLearningItemView } from "@/data/dictionaryLearning";
import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import type { ExerciseAudioRef, ExerciseSource } from "./types";

export function fromVocabEntry(entry: VocabEntryFull): ExerciseSource {
  return {
    id: entry.id,
    ref: {
      track: "curated",
      sourceKey: sourceKey("curated", entry.id),
      entryId: entry.id,
    },
    headword: entry.headword,
    pos: entry.pos,
    ipa: entry.ipa ?? null,
    cefrLevel: entry.cefrLevel ?? null,
    audioRef: entry.audioRef ?? null,
    audioRefs: normalizeAudioRefs(entry.audioRef ? [entry.audioRef] : []),
    senses: entry.senses.map((sense) => ({
      ordinal: sense.ordinal,
      definitionEn: sense.definitionEn ?? null,
      definitionVi: sense.definitionVi ?? null,
    })),
    examples: entry.examples.map((example) => ({
      ordinal: example.ordinal,
      text: example.text ?? null,
      translation: example.translation ?? null,
      audioRef: example.audioRef ?? null,
    })),
  };
}

export function fromDictionaryItem(item: DictionaryLearningItemView): ExerciseSource {
  return {
    id: item.id,
    ref: {
      track: "personal",
      sourceKey: sourceKey("personal", item.id),
      dictionaryItemId: item.id,
      dictionaryKey: item.dictionaryKey,
    },
    headword: item.headword,
    pos: item.pos,
    ipa: item.ipa,
    cefrLevel: item.cefrLevel,
    audioRef: item.audioRef,
    audioRefs: normalizeAudioRefs(item.audioRef ? [item.audioRef] : []),
    senses: [
      {
        ordinal: 0,
        definitionEn: item.definitionEn,
        definitionVi: item.definitionVi,
      },
    ],
    examples: item.exampleText
      ? [
          {
            ordinal: 0,
            text: item.exampleText,
            translation: item.exampleTranslation,
            audioRef: item.audioRef,
          },
        ]
      : [],
  };
}

export function sourceKey(track: ExerciseSource["ref"]["track"], id: number): string {
  return `${track}:${id}`;
}

function normalizeAudioRefs(refs: ReadonlyArray<string>): ExerciseAudioRef[] {
  const seen = new Set<string>();
  const out: ExerciseAudioRef[] = [];
  for (const ref of refs) {
    const trimmed = ref.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push({
      ref: trimmed,
      label: "Audio",
      accent: "other",
    });
  }
  return out;
}
