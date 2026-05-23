import { z } from "zod";
import { defineProcedure } from "../procedure";

const lessonIdInput = z.object({ lessonId: z.number().int().positive() });
const idInput = z.object({ id: z.number().int().positive() });
const headwordInput = z.object({ headword: z.string().min(1).max(80) });

export const vocabProcedures = [
  defineProcedure({
    name: "vocab.listByLesson",
    input: lessonIdInput,
    handler: ({ lessonId }, ctx) => ctx.repos.vocab.listByLesson(lessonId),
  }),
  defineProcedure({
    name: "vocab.listFullByLesson",
    input: lessonIdInput,
    handler: ({ lessonId }, ctx) => ctx.repos.vocab.listFullByLesson(lessonId),
  }),
  defineProcedure({
    name: "vocab.countByLesson",
    input: lessonIdInput,
    handler: ({ lessonId }, ctx) => ctx.repos.vocab.countByLesson(lessonId),
  }),
  defineProcedure({
    name: "vocab.getById",
    input: idInput,
    handler: ({ id }, ctx) => ctx.repos.vocab.getById(id),
  }),
  defineProcedure({
    name: "vocab.examplesForHeadword",
    input: headwordInput,
    handler: ({ headword }, ctx) => ctx.repos.vocab.examplesForHeadword({ headword }),
  }),
];
