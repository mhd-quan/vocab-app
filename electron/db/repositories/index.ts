import type { AppDatabase } from "../client";
import { type CurriculumRepository, createCurriculumRepository } from "./curriculum";
import { type SettingsRepository, createSettingsRepository } from "./settings";
import { type StudentsRepository, createStudentsRepository } from "./students";
import { type VocabRepository, createVocabRepository } from "./vocab";

export interface Repositories {
  curriculum: CurriculumRepository;
  vocab: VocabRepository;
  students: StudentsRepository;
  settings: SettingsRepository;
}

export function createRepositories(db: AppDatabase): Repositories {
  return {
    curriculum: createCurriculumRepository(db),
    vocab: createVocabRepository(db),
    students: createStudentsRepository(db),
    settings: createSettingsRepository(db),
  };
}

export { createCurriculumRepository, type CurriculumRepository } from "./curriculum";
export { createSettingsRepository, type SettingsRepository } from "./settings";
export { createStudentsRepository, type StudentsRepository } from "./students";
export {
  createVocabRepository,
  type VocabEntryFull,
  type VocabRepository,
} from "./vocab";
