import { type OpenDialogOptions, dialog } from "electron";
import { z } from "zod";
import {
  DICTIONARY_PACK_PATH_KEY,
  dictionaryAsset,
  dictionaryAudio,
  dictionaryLookup,
  dictionarySearch,
  dictionaryStatus,
  resetDictionaryCache,
  validateDictionaryPackPath,
} from "../../dictionary";
import { dictionaryBatchLookup } from "../../dictionary/batch";
import { defineProcedure } from "../procedure";

const searchInput = z.object({
  query: z.string().default(""),
  limit: z.number().int().min(1).max(50).default(12),
});

const lookupInput = z.object({
  term: z.string().min(1),
});

const batchLookupInput = z.object({
  terms: z.array(z.string().min(1)).max(200),
});

const audioInput = z.object({
  ref: z.string().min(1),
});

const emptyInput = z.object({}).default({});

export const dictionaryProcedures = [
  defineProcedure({
    name: "dictionary.status",
    input: emptyInput,
    handler: (_, ctx) => dictionaryStatus(ctx.repos.settings.get<string>(DICTIONARY_PACK_PATH_KEY)),
  }),
  defineProcedure({
    name: "dictionary.search",
    input: searchInput,
    handler: ({ query, limit }, ctx) =>
      dictionarySearch(
        query ?? "",
        limit ?? 12,
        ctx.repos.settings.get<string>(DICTIONARY_PACK_PATH_KEY),
      ),
  }),
  defineProcedure({
    name: "dictionary.lookup",
    input: lookupInput,
    handler: ({ term }, ctx) => {
      const entry = dictionaryLookup(
        term,
        ctx.repos.settings.get<string>(DICTIONARY_PACK_PATH_KEY),
      );
      if (!entry) return null;
      return {
        ...entry,
        lessonEntries: ctx.repos.vocab.findDictionaryMatches({
          term,
          headword: entry.headword,
        }),
      };
    },
  }),
  defineProcedure({
    name: "dictionary.batchLookup",
    input: batchLookupInput,
    handler: ({ terms }, ctx) =>
      dictionaryBatchLookup(terms, ctx.repos.settings.get<string>(DICTIONARY_PACK_PATH_KEY)),
  }),
  defineProcedure({
    name: "dictionary.audio",
    input: audioInput,
    handler: ({ ref }, ctx) =>
      dictionaryAudio(ref, ctx.repos.settings.get<string>(DICTIONARY_PACK_PATH_KEY)),
  }),
  defineProcedure({
    name: "dictionary.asset",
    input: audioInput,
    handler: ({ ref }, ctx) =>
      dictionaryAsset(ref, ctx.repos.settings.get<string>(DICTIONARY_PACK_PATH_KEY)),
  }),
  defineProcedure({
    name: "dictionary.selectPackFolder",
    input: emptyInput,
    handler: async (_, ctx) => {
      const win = ctx.getMainWindow?.() ?? undefined;
      const options: OpenDialogOptions = {
        title: "Select dictionary pack folder",
        properties: ["openDirectory"],
      };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || !result.filePaths[0]) {
        return dictionaryStatus(ctx.repos.settings.get<string>(DICTIONARY_PACK_PATH_KEY));
      }
      const packPath = result.filePaths[0];
      validateDictionaryPackPath(packPath);
      ctx.repos.settings.set(DICTIONARY_PACK_PATH_KEY, packPath);
      resetDictionaryCache();
      return dictionaryStatus(packPath);
    },
  }),
  defineProcedure({
    name: "dictionary.clearPackFolder",
    input: emptyInput,
    handler: (_, ctx) => {
      ctx.repos.settings.delete(DICTIONARY_PACK_PATH_KEY);
      resetDictionaryCache();
      return dictionaryStatus(null);
    },
  }),
];
