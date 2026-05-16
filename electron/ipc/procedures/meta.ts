import { z } from "zod";
import { APP_IDENTIFIER, APP_VERSION } from "../../../src/application/appInfo";
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
      name: APP_IDENTIFIER,
      version: APP_VERSION,
      schemaTablesExpected: 28,
      dbPath: getDatabasePath(),
    }),
  }),
];
