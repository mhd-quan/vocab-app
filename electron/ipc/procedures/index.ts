import type { AnyProcedure } from "../procedure";
import { authProcedures } from "./auth";
import { curriculumProcedures } from "./curriculum";
import { importsProcedures } from "./imports";
import { metaProcedures } from "./meta";
import { progressProcedures } from "./progress";
import { settingsProcedures } from "./settings";
import { studentsProcedures } from "./students";
import { vocabProcedures } from "./vocab";

export const allProcedures: ReadonlyArray<AnyProcedure> = [
  ...metaProcedures,
  ...authProcedures,
  ...curriculumProcedures,
  ...vocabProcedures,
  ...studentsProcedures,
  ...settingsProcedures,
  ...importsProcedures,
  ...progressProcedures,
] as ReadonlyArray<AnyProcedure>;

export {
  authProcedures,
  curriculumProcedures,
  importsProcedures,
  metaProcedures,
  progressProcedures,
  settingsProcedures,
  studentsProcedures,
  vocabProcedures,
};
