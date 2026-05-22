import type { AnyProcedure } from "../procedure";
import { authProcedures } from "./auth";
import { curriculumProcedures } from "./curriculum";
import { dictionaryProcedures } from "./dictionary";
import { dictionaryLearningProcedures } from "./dictionaryLearning";
import { evidenceProcedures } from "./evidence";
import { grammarProcedures } from "./grammar";
import { importsProcedures } from "./imports";
import { metaProcedures } from "./meta";
import { progressProcedures } from "./progress";
import { pronunciationProcedures } from "./pronunciation";
import { rewardsProcedures } from "./rewards";
import { settingsProcedures } from "./settings";
import { studentsProcedures } from "./students";
import { vocabProcedures } from "./vocab";

export const allProcedures: ReadonlyArray<AnyProcedure> = [
  ...metaProcedures,
  ...authProcedures,
  ...curriculumProcedures,
  ...dictionaryProcedures,
  ...dictionaryLearningProcedures,
  ...evidenceProcedures,
  ...grammarProcedures,
  ...vocabProcedures,
  ...studentsProcedures,
  ...settingsProcedures,
  ...importsProcedures,
  ...pronunciationProcedures,
  ...progressProcedures,
  ...rewardsProcedures,
] as ReadonlyArray<AnyProcedure>;

export {
  authProcedures,
  curriculumProcedures,
  dictionaryLearningProcedures,
  dictionaryProcedures,
  evidenceProcedures,
  grammarProcedures,
  importsProcedures,
  metaProcedures,
  pronunciationProcedures,
  progressProcedures,
  rewardsProcedures,
  settingsProcedures,
  studentsProcedures,
  vocabProcedures,
};
