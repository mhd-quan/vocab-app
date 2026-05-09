import { z } from "zod";
import { lessonKinds } from "../../../src/data/schema";
import { defineProcedure } from "../procedure";

const idInput = z.object({ id: z.number().int().positive() });
const codeInput = z.object({ code: z.string().min(1) });
const bookIdInput = z.object({ bookId: z.number().int().positive() });
const unitIdInput = z.object({
  unitId: z.number().int().positive(),
  kind: z.enum(lessonKinds).optional(),
});

export const curriculumProcedures = [
  defineProcedure({
    name: "curriculum.listBooks",
    input: z.void(),
    handler: (_input, ctx) => ctx.repos.curriculum.listBooks(),
  }),
  defineProcedure({
    name: "curriculum.getBookById",
    input: idInput,
    handler: ({ id }, ctx) => ctx.repos.curriculum.getBookById(id),
  }),
  defineProcedure({
    name: "curriculum.getBookByCode",
    input: codeInput,
    handler: ({ code }, ctx) => ctx.repos.curriculum.getBookByCode(code),
  }),
  defineProcedure({
    name: "curriculum.listUnitsByBook",
    input: bookIdInput,
    handler: ({ bookId }, ctx) => ctx.repos.curriculum.listUnitsByBook(bookId),
  }),
  defineProcedure({
    name: "curriculum.getUnitById",
    input: idInput,
    handler: ({ id }, ctx) => ctx.repos.curriculum.getUnitById(id),
  }),
  defineProcedure({
    name: "curriculum.listLessonsByUnit",
    input: unitIdInput,
    handler: ({ unitId, kind }, ctx) => ctx.repos.curriculum.listLessonsByUnit(unitId, kind),
  }),
  defineProcedure({
    name: "curriculum.getLessonById",
    input: idInput,
    handler: ({ id }, ctx) => ctx.repos.curriculum.getLessonById(id),
  }),
];
