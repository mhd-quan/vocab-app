import type {
  CefrLevel,
  DictionaryLearningStage,
  DictionaryLearningStatus,
  PartOfSpeech,
} from "./schema";

export interface DictionaryLearningAudioRef {
  ref: string;
  label: string;
  accent: "uk" | "us" | "other";
}

export interface DictionaryLearningItemView {
  id: number;
  studentId: number;
  dictionaryKey: string;
  headword: string;
  pos: PartOfSpeech;
  ipa: string | null;
  cefrLevel: CefrLevel | null;
  definitionEn: string;
  definitionVi: string | null;
  exampleText: string | null;
  exampleTranslation: string | null;
  audioRef: string | null;
  audioRefs: DictionaryLearningAudioRef[];
  status: DictionaryLearningStatus;
  stage: DictionaryLearningStage;
  correctInCycle: number;
  shortTermCorrect: number;
  totalCorrect: number;
  totalWrong: number;
  score: number;
  lastReviewedAt: Date | null;
  nextDueAt: Date | null;
  updatedAt: Date;
}

export interface DictionaryLearningSummary {
  total: number;
  due: number;
  new?: number;
  learning: number;
  shortTerm: number;
  longTerm: number;
  averageScore: number;
}

export interface DictionarySearchHistoryItem {
  id: number;
  query: string;
  dictionaryKey: string | null;
  headword: string | null;
  createdAt: Date;
}

export interface DictionaryLearningReviewResult {
  item: DictionaryLearningItemView;
  reset: boolean;
  promoted: "short_term" | "long_term" | null;
}
