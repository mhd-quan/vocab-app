import { z } from "zod";
import { getDatabasePath } from "../../db";
import { defineProcedure } from "../procedure";

export const metaProcedures = [
  defineProcedure({
    name: "meta.ping",
    input: z.void(),
    handler: () => "pong" as const,
  }),
  defineProcedure({
    name: "meta.appInfo",
    input: z.void(),
    handler: () => ({
      name: "vocab-app",
      version: "0.2.0",
      schemaTablesExpected: 20,
      dbPath: getDatabasePath(),
    }),
  }),
];
