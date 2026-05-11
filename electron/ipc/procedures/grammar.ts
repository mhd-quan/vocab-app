import { z } from "zod";
import { defineProcedure } from "../procedure";

const lessonIdInput = z.object({ lessonId: z.number().int().positive() });
const idInput = z.object({ id: z.number().int().positive() });

export const grammarProcedures = [
  defineProcedure({
    name: "grammar.listByLesson",
    input: lessonIdInput,
    handler: ({ lessonId }, ctx) => ctx.repos.grammar.listByLesson(lessonId),
  }),
  defineProcedure({
    name: "grammar.listPracticeByLesson",
    input: lessonIdInput,
    handler: ({ lessonId }, ctx) => ctx.repos.grammar.listPracticeByLesson(lessonId),
  }),
  defineProcedure({
    name: "grammar.countByLesson",
    input: lessonIdInput,
    handler: ({ lessonId }, ctx) => ctx.repos.grammar.countByLesson(lessonId),
  }),
  defineProcedure({
    name: "grammar.getById",
    input: idInput,
    handler: ({ id }, ctx) => ctx.repos.grammar.getById(id),
  }),
];
