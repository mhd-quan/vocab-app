import type { AppDatabase } from "../client";
import { type CurriculumRepository, createCurriculumRepository } from "./curriculum";
import { type ImportRepository, createImportRepository } from "./import";
import { type ProgressRepository, createProgressRepository } from "./progress";
import { type RewardsRepository, createRewardsRepository } from "./rewards";
import { type SettingsRepository, createSettingsRepository } from "./settings";
import { type StudentsRepository, createStudentsRepository } from "./students";
import { type VocabRepository, createVocabRepository } from "./vocab";

export interface Repositories {
  curriculum: CurriculumRepository;
  vocab: VocabRepository;
  students: StudentsRepository;
  settings: SettingsRepository;
  imports: ImportRepository;
  progress: ProgressRepository;
  rewards: RewardsRepository;
}

export function createRepositories(db: AppDatabase): Repositories {
  return {
    curriculum: createCurriculumRepository(db),
    vocab: createVocabRepository(db),
    students: createStudentsRepository(db),
    settings: createSettingsRepository(db),
    imports: createImportRepository(db),
    progress: createProgressRepository(db),
    rewards: createRewardsRepository(db),
  };
}

export {
  type CurriculumRepository,
  createCurriculumRepository,
  type UpsertBookInput,
  type UpsertLessonInput,
  type UpsertUnitInput,
} from "./curriculum";
export { type ImportRepository, createImportRepository } from "./import";
export {
  type DueItem,
  type DueLessonStats,
  type ProgressRepository,
  createProgressRepository,
  type RecordAnswerInput,
  type RecordAnswerResult,
} from "./progress";
export {
  type BuildStatsInput,
  type EvaluateInput,
  type RewardsRepository,
  createRewardsRepository,
} from "./rewards";
export { type SettingsRepository, createSettingsRepository } from "./settings";
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
