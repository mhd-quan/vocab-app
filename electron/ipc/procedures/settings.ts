import { z } from "zod";
import { SETTINGS_KEYS } from "../../../src/modules/settings/keys";
import { applyScreenshotPolicy } from "../../windowPolicy";
import { defineProcedure } from "../procedure";

const keyInput = z.object({ key: z.string().min(1).max(120) });
const setInput = z.object({
  key: z.string().min(1).max(120),
  value: z.unknown(),
});

export const settingsProcedures = [
  defineProcedure({
    name: "settings.get",
    input: keyInput,
    handler: ({ key }, ctx) => ctx.repos.settings.get(key) ?? null,
  }),
  defineProcedure({
    name: "settings.set",
    input: setInput,
    handler: ({ key, value }, ctx) => {
      ctx.repos.settings.set(key, value);
      if (key === SETTINGS_KEYS.screenshotsEnabled) {
        applyScreenshotPolicy(ctx.getMainWindow?.(), value === true);
      }
      return { ok: true } as const;
    },
  }),
  defineProcedure({
    name: "settings.delete",
    input: keyInput,
    handler: ({ key }, ctx) => {
      ctx.repos.settings.delete(key);
      if (key === SETTINGS_KEYS.screenshotsEnabled) {
        applyScreenshotPolicy(ctx.getMainWindow?.(), false);
      }
      return { ok: true } as const;
    },
  }),
  defineProcedure({
    name: "settings.getAll",
    input: z.void(),
    handler: (_input, ctx) => ctx.repos.settings.getAll(),
  }),
];
