import { z } from "zod";
import { defineProcedure } from "../procedure";

const listRunsInput = z.object({
  limit: z.number().int().positive().max(500).optional(),
});

const listItemsInput = z.object({
  runId: z.number().int().positive(),
});

export const importsProcedures = [
  defineProcedure({
    name: "imports.listRuns",
    input: listRunsInput,
    handler: ({ limit }, ctx) => ctx.repos.imports.listRuns(limit),
  }),
  defineProcedure({
    name: "imports.listItems",
    input: listItemsInput,
    handler: ({ runId }, ctx) => ctx.repos.imports.listItems(runId),
  }),
];
