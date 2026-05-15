import type { CefrLevel, PartOfSpeech } from "./schema";

export interface DictionaryPackFile {
  name: string;
  bytes: number;
  role: "entries" | "audio" | "assets";
}

export interface DictionaryStatus {
  active: boolean;
  packPath: string | null;
  entryCount: number;
  sourceFile: string | null;
  files: DictionaryPackFile[];
  message: string | null;
}

export interface DictionarySearchResult {
  key: string;
  label: string;
  exact: boolean;
}

export interface DictionaryAudioRef {
  ref: string;
  label: string;
  accent: "uk" | "us" | "other";
}

export interface DictionarySense {
  definitionEn: string;
  labels: string[];
  examples: string[];
}

export interface DictionaryLessonEntry {
  id: number;
  headword: string;
  lemma: string | null;
  pos: PartOfSpeech;
  ipa: string | null;
  cefrLevel: CefrLevel | null;
  audioRef: string | null;
  bookCode: string;
  bookTitle: string;
  unitCode: string;
  unitTitle: string;
  unitOrdinal: number;
  lessonId: number;
  lessonTitle: string;
  senses: Array<{
    definitionEn: string | null;
    definitionVi: string | null;
  }>;
  examples: Array<{
    text: string;
    translation: string | null;
  }>;
}

export interface DictionaryEntry {
  key: string;
  headword: string;
  posLabel: string | null;
  posKey: PartOfSpeech;
  ipaUk: string | null;
  ipaUs: string | null;
  cefr: CefrLevel | null;
  labels: string[];
  senses: DictionarySense[];
  examples: string[];
  audio: DictionaryAudioRef[];
  source: {
    dictionary: "oald10";
    file: string;
  };
  lessonEntries: DictionaryLessonEntry[];
}

export interface DictionaryAudioAsset {
  dataUrl: string;
  mime: string;
}
