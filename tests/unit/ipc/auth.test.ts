import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { allProcedures } from "../../../electron/ipc";
import { TUTOR_PIN_SETTINGS_KEY } from "../../../electron/ipc/procedures/auth";
import { freshDb } from "../../helpers";

function findProcedure(name: string) {
  const proc = allProcedures.find((p) => p.name === name);
  if (!proc) throw new Error(`Procedure ${name} not registered`);
  return proc;
}

async function call<T>(name: string, input: unknown, ctx: { repos: Repositories }): Promise<T> {
  const proc = findProcedure(name);
  const parsed = proc.inputSchema.parse(input);
  return (await proc.handler(parsed, ctx)) as T;
}

describe("auth.* procedures", () => {
  let db: AppDatabase;
  let ctx: { repos: Repositories };

  beforeEach(() => {
    const fresh = freshDb();
    db = fresh.db;
    ctx = { repos: fresh.repos };
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("hasPin returns false on a fresh DB", async () => {
    expect(await call<boolean>("auth.hasPin", undefined, ctx)).toBe(false);
  });

  it("setupPin stores a hash and flips hasPin to true", async () => {
    await call("auth.setupPin", { pin: "1234" }, ctx);
    expect(await call<boolean>("auth.hasPin", undefined, ctx)).toBe(true);
    const stored = ctx.repos.settings.get<string>(TUTOR_PIN_SETTINGS_KEY);
    expect(typeof stored).toBe("string");
    expect(stored).not.toBe("1234");
    expect(stored?.startsWith("scrypt$1$")).toBe(true);
  });

  it("setupPin throws when a PIN already exists", async () => {
    await call("auth.setupPin", { pin: "1234" }, ctx);
    await expect(call("auth.setupPin", { pin: "9999" }, ctx)).rejects.toThrow(/already set/i);
  });

  it("verifyPin returns ok for the correct PIN", async () => {
    await call("auth.setupPin", { pin: "1234" }, ctx);
    const result = await call<{ ok: boolean }>("auth.verifyPin", { pin: "1234" }, ctx);
    expect(result.ok).toBe(true);
  });

  it("verifyPin reports invalid for the wrong PIN", async () => {
    await call("auth.setupPin", { pin: "1234" }, ctx);
    const result = await call<{ ok: false; reason: string }>(
      "auth.verifyPin",
      { pin: "4321" },
      ctx,
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("verifyPin reports no_pin when none configured", async () => {
    const result = await call<{ ok: false; reason: string }>(
      "auth.verifyPin",
      { pin: "1234" },
      ctx,
    );
    expect(result).toEqual({ ok: false, reason: "no_pin" });
  });

  it("changePin requires the correct current PIN", async () => {
    await call("auth.setupPin", { pin: "1234" }, ctx);
    await expect(
      call("auth.changePin", { currentPin: "wrong", newPin: "5678" }, ctx),
    ).rejects.toThrow(/incorrect/i);
  });

  it("changePin rotates the stored hash when the current PIN matches", async () => {
    await call("auth.setupPin", { pin: "1234" }, ctx);
    const before = ctx.repos.settings.get<string>(TUTOR_PIN_SETTINGS_KEY);
    await call("auth.changePin", { currentPin: "1234", newPin: "5678" }, ctx);
    const after = ctx.repos.settings.get<string>(TUTOR_PIN_SETTINGS_KEY);
    expect(after).not.toBe(before);
    expect((await call<{ ok: boolean }>("auth.verifyPin", { pin: "5678" }, ctx)).ok).toBe(true);
    expect((await call<{ ok: boolean }>("auth.verifyPin", { pin: "1234" }, ctx)).ok).toBe(false);
  });

  it("Zod input validation rejects PINs shorter than 4 chars", () => {
    const proc = findProcedure("auth.setupPin");
    expect(() => proc.inputSchema.parse({ pin: "12" })).toThrow();
  });
});
