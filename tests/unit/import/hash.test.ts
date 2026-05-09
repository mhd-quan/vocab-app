import { describe, expect, it } from "vitest";
import { canonicalJson, hashContent } from "../../../src/application/import/hash";

describe("canonicalJson", () => {
  it("sorts keys at every level", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ outer: { z: 1, a: 2 }, alpha: 3 })).toBe(
      '{"alpha":3,"outer":{"a":2,"z":1}}',
    );
  });

  it("preserves array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("omits undefined fields, like JSON.stringify", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("encodes primitives faithfully", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("hi")).toBe('"hi"');
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(42)).toBe("42");
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow();
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("hashContent", () => {
  it("is deterministic regardless of key order", () => {
    const a = hashContent({ a: 1, b: 2, c: { x: 1, y: 2 } });
    const b = hashContent({ c: { y: 2, x: 1 }, b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("changes when content changes", () => {
    expect(hashContent({ a: 1 })).not.toBe(hashContent({ a: 2 }));
  });

  it("differentiates between [1,2] and [2,1]", () => {
    expect(hashContent([1, 2])).not.toBe(hashContent([2, 1]));
  });
});
