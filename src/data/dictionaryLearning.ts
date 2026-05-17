import type {
  CefrLevel,
  DictionaryLearningStage,
  DictionaryLearningStatus,
  PartOfSpeech,
} from "./schema";

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
  /** UI grouping label derived from FSRS state. */
  status: DictionaryLearningStatus;
  /** Next exercise kind the dispatcher should render. */
  stage: DictionaryLearningStage;
  /* ----- FSRS-lite scheduling state, surfaced for tutor diagnostics ----- */
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  /* ----- Lifetime tallies + timestamps ----- */
  totalCorrect: number;
  totalWrong: number;
  lastReviewedAt: Date | null;
  nextDueAt: Date | null;
  updatedAt: Date;
}

export interface DictionaryLearningSummary {
  total: number;
  due: number;
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
