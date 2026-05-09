import type { AnyProcedure } from "../procedure";
import { curriculumProcedures } from "./curriculum";
import { metaProcedures } from "./meta";
import { settingsProcedures } from "./settings";
import { studentsProcedures } from "./students";
import { vocabProcedures } from "./vocab";

export const allProcedures: ReadonlyArray<AnyProcedure> = [
  ...metaProcedures,
  ...curriculumProcedures,
  ...vocabProcedures,
  ...studentsProcedures,
  ...settingsProcedures,
] as ReadonlyArray<AnyProcedure>;

export {
  curriculumProcedures,
  metaProcedures,
  settingsProcedures,
  studentsProcedures,
  vocabProcedures,
};
