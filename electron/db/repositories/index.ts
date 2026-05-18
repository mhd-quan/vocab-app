import type { AppDatabase } from "../client";
import { type CurriculumRepository, createCurriculumRepository } from "./curriculum";
import {
  type DictionaryLearningRepository,
  createDictionaryLearningRepository,
} from "./dictionaryLearning";
import { type EvidenceRepository, createEvidenceRepository } from "./evidence";
import { type GrammarRepository, createGrammarRepository } from "./grammar";
import { type ImportRepository, createImportRepository } from "./import";
import { type ProgressRepository, createProgressRepository } from "./progress";
import { type RewardsRepository, createRewardsRepository } from "./rewards";
import { type SettingsRepository, createSettingsRepository } from "./settings";
import { type SrsRepository, createSrsRepository } from "./srs";
import { type StudentsRepository, createStudentsRepository } from "./students";
import { type VocabRepository, createVocabRepository } from "./vocab";

export interface Repositories {
  curriculum: CurriculumRepository;
  dictionaryLearning: DictionaryLearningRepository;
  grammar: GrammarRepository;
  vocab: VocabRepository;
  students: StudentsRepository;
  settings: SettingsRepository;
  imports: ImportRepository;
  progress: ProgressRepository;
  rewards: RewardsRepository;
  srs: SrsRepository;
  evidence: EvidenceRepository;
}

export function createRepositories(db: AppDatabase): Repositories {
  return {
    curriculum: createCurriculumRepository(db),
    dictionaryLearning: createDictionaryLearningRepository(db),
    grammar: createGrammarRepository(db),
    vocab: createVocabRepository(db),
    students: createStudentsRepository(db),
    settings: createSettingsRepository(db),
    imports: createImportRepository(db),
    progress: createProgressRepository(db),
    rewards: createRewardsRepository(db),
    srs: createSrsRepository(db),
    evidence: createEvidenceRepository(db),
  };
}

export {
  type CurriculumRepository,
  createCurriculumRepository,
  type UpsertBookInput,
  type UpsertLessonInput,
  type UpsertUnitInput,
} from "./curriculum";
export {
  createDictionaryLearningRepository,
  type DictionaryLearningRepository,
  type RecordLookupInput,
  type RecordReviewInput,
  type RecordSearchInput,
} from "./dictionaryLearning";
export {
  type EvidenceRepository,
  createEvidenceRepository,
  type RecordEvidenceEventInput,
  type SessionEvidenceSummaryRow,
  type StudentEvidenceOverview,
  type StudentEvidenceTimeline,
  type TutorEvidenceOverviewRow,
} from "./evidence";
export {
  createGrammarRepository,
  type GrammarTopicForPractice,
  type GrammarRepository,
  type UpsertGrammarTopicInput,
  type UpsertGrammarTopicResult,
} from "./grammar";
export { type ImportRepository, createImportRepository } from "./import";
export {
  type DailyActivityCell,
  type DueItem,
  type DueLessonStats,
  type ProgressRepository,
  createProgressRepository,
  type RecentSessionRow,
  type RecordAnswerInput,
  type RecordContentAnswerInput,
  type RecordAnswerResult,
  type TutorOverviewRow,
  type WeakItem,
} from "./progress";
export {
  type BuildStatsInput,
  type EvaluateInput,
  type RewardsRepository,
  createRewardsRepository,
} from "./rewards";
export { type SettingsRepository, createSettingsRepository } from "./settings";
export { type SrsArchiveStatus, type SrsRepository, createSrsRepository } from "./srs";
export { type StudentsRepository, createStudentsRepository } from "./students";
export {
  type CollocationInput,
  createVocabRepository,
  type ExampleInput,
  type FormInput,
  type RelationInput,
  type SenseInput,
  type UpsertVocabEntryInput,
  type UpsertVocabEntryResult,
  type VocabEntryFull,
  type VocabRepository,
} from "./vocab";
