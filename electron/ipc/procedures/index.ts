import type { AnyProcedure } from "../procedure";
import { authProcedures } from "./auth";
import { curriculumProcedures } from "./curriculum";
import { metaProcedures } from "./meta";
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
] as ReadonlyArray<AnyProcedure>;

export {
  authProcedures,
  curriculumProcedures,
  metaProcedures,
  settingsProcedures,
  studentsProcedures,
  vocabProcedures,
};
