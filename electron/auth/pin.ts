import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 32;
const SCRYPT_COST = 16384;

const HASH_PREFIX = "scrypt$1$";

/**
 * One-way hash a tutor PIN. The output is a self-describing string in the
 * form `scrypt$1$<saltHex>$<keyHex>` so we can change parameters later
 * without breaking already-stored hashes.
 *
 * Uses Node's built-in crypto so we avoid the native bcrypt rebuild dance.
 */
export function hashPin(pin: string): string {
  if (!pin || pin.length < 4) {
    throw new Error("PIN must be at least 4 characters");
  }
  const salt = randomBytes(SALT_BYTES);
  const key = scryptSync(pin, salt, KEY_BYTES, { N: SCRYPT_COST });
  return `${HASH_PREFIX}${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Constant-time PIN verification. Returns false for any malformed input
 * rather than throwing — callers treat that as a failed attempt.
 */
export function verifyPin(pin: string, stored: string): boolean {
  if (typeof stored !== "string" || !stored.startsWith(HASH_PREFIX)) {
    return false;
  }
  const remainder = stored.slice(HASH_PREFIX.length);
  const sep = remainder.indexOf("$");
  if (sep < 0) return false;

  const saltHex = remainder.slice(0, sep);
  const keyHex = remainder.slice(sep + 1);
  if (!saltHex || !keyHex) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }
  if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) {
    return false;
  }

  const actual = scryptSync(pin, salt, expected.length, { N: SCRYPT_COST });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Visual sanity check — does this look like a hash we produced? */
export function isHashedPin(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(HASH_PREFIX);
}

export const PIN_HASH_PREFIX = HASH_PREFIX;
