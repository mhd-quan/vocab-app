import { describe, expect, it } from "vitest";
import { PIN_HASH_PREFIX, hashPin, isHashedPin, verifyPin } from "../../../electron/auth/pin";

describe("hashPin", () => {
  it("rejects PINs shorter than 4 chars", () => {
    expect(() => hashPin("123")).toThrow();
    expect(() => hashPin("")).toThrow();
  });

  it("produces a self-describing hash with the expected prefix", () => {
    const hash = hashPin("1234");
    expect(hash.startsWith(PIN_HASH_PREFIX)).toBe(true);
    expect(isHashedPin(hash)).toBe(true);
  });

  it("uses a unique salt per hash (same PIN → different hashes)", () => {
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toBe(b);
  });
});

describe("verifyPin", () => {
  it("returns true for the correct PIN", () => {
    const hash = hashPin("1234");
    expect(verifyPin("1234", hash)).toBe(true);
  });

  it("returns false for the wrong PIN", () => {
    const hash = hashPin("1234");
    expect(verifyPin("4321", hash)).toBe(false);
    expect(verifyPin("12345", hash)).toBe(false);
    expect(verifyPin("", hash)).toBe(false);
  });

  it("returns false for a malformed stored hash", () => {
    expect(verifyPin("1234", "")).toBe(false);
    expect(verifyPin("1234", "scrypt$1$nope")).toBe(false);
    expect(verifyPin("1234", "bcrypt$xxx$yyy")).toBe(false);
    expect(verifyPin("1234", "scrypt$1$00$00")).toBe(false);
  });

  it("isHashedPin returns false for non-hashed values", () => {
    expect(isHashedPin(undefined)).toBe(false);
    expect(isHashedPin(null)).toBe(false);
    expect(isHashedPin(42)).toBe(false);
    expect(isHashedPin("plain text")).toBe(false);
    expect(isHashedPin(hashPin("1234"))).toBe(true);
  });
});
