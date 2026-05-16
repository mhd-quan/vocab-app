import { z } from "zod";
import { dictionaryLearningStages } from "../../../src/data/schema";
import { DICTIONARY_PACK_PATH_KEY, dictionaryLookup } from "../../dictionary";
import { defineProcedure } from "../procedure";

const studentInput = z.object({
  studentId: z.number().int().positive(),
});

const recordSearchInput = studentInput.extend({
  query: z.string().min(1),
});

const recordLookupInput = recordSearchInput.extend({
  dictionaryKey: z.string().min(1),
});

const listInput = studentInput.extend({
  limit: z.number().int().min(1).max(50).optional(),
});

const reviewInput = studentInput.extend({
  itemId: z.number().int().positive(),
  stage: z.enum(dictionaryLearningStages),
  correct: z.boolean(),
  answer: z.string().optional().nullable(),
  expected: z.string().optional().nullable(),
  sessionId: z.number().int().positive().optional().nullable(),
});

export const dictionaryLearningProcedures = [
  defineProcedure({
    name: "dictionaryLearning.recordSearch",
    input: recordSearchInput,
    handler: (input, ctx) => ctx.repos.dictionaryLearning.recordSearch(input),
  }),
  defineProcedure({
    name: "dictionaryLearning.recordLookup",
    input: recordLookupInput,
    handler: ({ studentId, query, dictionaryKey }, ctx) => {
      const entry = dictionaryLookup(
        dictionaryKey,
        ctx.repos.settings.get<string>(DICTIONARY_PACK_PATH_KEY),
      );
      if (!entry) throw new Error("Dictionary entry not found");
      return ctx.repos.dictionaryLearning.recordLookup({
        studentId,
        query,
        entry: {
          ...entry,
          lessonEntries: ctx.repos.vocab.findDictionaryMatches({
            term: dictionaryKey,
            headword: entry.headword,
          }),
        },
      });
    },
  }),
  defineProcedure({
    name: "dictionaryLearning.summary",
    input: studentInput,
    handler: ({ studentId }, ctx) => ctx.repos.dictionaryLearning.summary(studentId),
  }),
  defineProcedure({
    name: "dictionaryLearning.recentSearches",
    input: listInput,
    handler: ({ studentId, limit }, ctx) =>
      ctx.repos.dictionaryLearning.recentSearches(studentId, limit),
  }),
  defineProcedure({
    name: "dictionaryLearning.listItems",
    input: studentInput,
    handler: ({ studentId }, ctx) => ctx.repos.dictionaryLearning.listItems(studentId),
  }),
  defineProcedure({
    name: "dictionaryLearning.practiceQueue",
    input: listInput,
    handler: ({ studentId, limit }, ctx) =>
      ctx.repos.dictionaryLearning.practiceQueue(studentId, limit),
  }),
  defineProcedure({
    name: "dictionaryLearning.recordReview",
    input: reviewInput,
    handler: (input, ctx) => ctx.repos.dictionaryLearning.recordReview(input),
  }),
];
