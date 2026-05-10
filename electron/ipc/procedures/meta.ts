import { z } from "zod";
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
      version: "0.0.1",
      schemaTablesExpected: 20,
    }),
  }),
];
