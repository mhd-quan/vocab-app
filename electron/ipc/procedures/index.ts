import type { AnyProcedure } from "../procedure";
import { authProcedures } from "./auth";
import { curriculumProcedures } from "./curriculum";
import { dictionaryProcedures } from "./dictionary";
import { grammarProcedures } from "./grammar";
import { importsProcedures } from "./imports";
import { metaProcedures } from "./meta";
import { progressProcedures } from "./progress";
import { rewardsProcedures } from "./rewards";
import { settingsProcedures } from "./settings";
import { studentsProcedures } from "./students";
import { vocabProcedures } from "./vocab";

export const allProcedures: ReadonlyArray<AnyProcedure> = [
  ...metaProcedures,
  ...authProcedures,
  ...curriculumProcedures,
  ...dictionaryProcedures,
  ...grammarProcedures,
  ...vocabProcedures,
  ...studentsProcedures,
  ...settingsProcedures,
  ...importsProcedures,
  ...progressProcedures,
  ...rewardsProcedures,
] as ReadonlyArray<AnyProcedure>;

export {
  authProcedures,
  curriculumProcedures,
  dictionaryProcedures,
  grammarProcedures,
  importsProcedures,
  metaProcedures,
  progressProcedures,
  rewardsProcedures,
  settingsProcedures,
  studentsProcedures,
  vocabProcedures,
};
