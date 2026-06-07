import { z } from "zod";
import packageJson from "../../../package.json";
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
      name: packageJson.name,
      version: packageJson.version,
      schemaTablesExpected: 26,
      dbPath: getDatabasePath(),
    }),
  }),
  defineProcedure({
    name: "meta.srsArchiveStatus",
    input: z.void(),
    handler: (_, ctx) => {
      // `acknowledged` lives in app_settings under `srs_archive_acknowledged`
      // (seeded by migration 0004). Default to `false` so a fresh install
      // shows the banner once, then flips to true on first dismiss.
      const ack = ctx.repos.settings.get<boolean>("srs_archive_acknowledged") === true;
      const legacyRowCount = ctx.repos.srs.legacyArchiveCount();
      return { acknowledged: ack, legacyRowCount };
    },
  }),
];
