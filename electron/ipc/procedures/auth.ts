import { z } from "zod";
import { hashPin, isHashedPin, verifyPin } from "../../auth/pin";
import { defineProcedure } from "../procedure";

const TUTOR_PIN_KEY = "tutor_pin_hash";

const pinSchema = z.string().min(4, "PIN must be at least 4 characters").max(32, "PIN is too long");

const setupInput = z.object({ pin: pinSchema });
const verifyInput = z.object({ pin: pinSchema });
const changeInput = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
});

export const authProcedures = [
  defineProcedure({
    name: "auth.hasPin",
    input: z.void(),
    handler: (_input, ctx) => {
      const stored = ctx.repos.settings.get<string>(TUTOR_PIN_KEY);
      return isHashedPin(stored);
    },
  }),

  defineProcedure({
    name: "auth.setupPin",
    input: setupInput,
    handler: ({ pin }, ctx) => {
      const existing = ctx.repos.settings.get<string>(TUTOR_PIN_KEY);
      if (isHashedPin(existing)) {
        throw new Error("Tutor PIN already set; use auth.changePin instead");
      }
      ctx.repos.settings.set(TUTOR_PIN_KEY, hashPin(pin));
      return { ok: true } as const;
    },
  }),

  defineProcedure({
    name: "auth.verifyPin",
    input: verifyInput,
    handler: ({ pin }, ctx) => {
      const stored = ctx.repos.settings.get<string>(TUTOR_PIN_KEY);
      if (!isHashedPin(stored)) {
        return { ok: false, reason: "no_pin" } as const;
      }
      const ok = verifyPin(pin, stored);
      return ok ? ({ ok: true } as const) : ({ ok: false, reason: "invalid" } as const);
    },
  }),

  defineProcedure({
    name: "auth.changePin",
    input: changeInput,
    handler: ({ currentPin, newPin }, ctx) => {
      const stored = ctx.repos.settings.get<string>(TUTOR_PIN_KEY);
      if (!isHashedPin(stored) || !verifyPin(currentPin, stored)) {
        throw new Error("Current PIN is incorrect");
      }
      ctx.repos.settings.set(TUTOR_PIN_KEY, hashPin(newPin));
      return { ok: true } as const;
    },
  }),
];

export const TUTOR_PIN_SETTINGS_KEY = TUTOR_PIN_KEY;
