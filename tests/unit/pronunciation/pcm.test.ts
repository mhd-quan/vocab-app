import { describe, expect, it } from "vitest";
import {
  clampInPlace,
  preparePcmForModel,
  resampleLinear,
} from "../../../electron/pronunciation/pcm";

describe("pcm utilities", () => {
  it("clamps Float32Array samples to [-1, 1] in place", () => {
    const buf = new Float32Array([0, 0.5, -0.5, 1.5, -2, Number.NaN, Number.POSITIVE_INFINITY]);
    const out = clampInPlace(buf);
    expect(out).toBe(buf); // mutates in place
    expect(Array.from(out)).toEqual([0, 0.5, -0.5, 1, -1, 0, 0]);
  });

  it("returns the same buffer when sample rate already matches", () => {
    const buf = new Float32Array([0.1, 0.2, 0.3]);
    const out = resampleLinear(buf, 16_000, 16_000);
    expect(out).toBe(buf);
  });

  it("linearly interpolates when downsampling", () => {
    const buf = new Float32Array([0, 1, 0, 1, 0, 1, 0, 1]);
    const out = resampleLinear(buf, 32_000, 16_000);
    expect(out.length).toBe(4);
    expect(out[0]).toBe(0);
  });

  it("preserves total energy roughly when upsampling", () => {
    const buf = new Float32Array([0.2, 0.4, 0.6, 0.8]);
    const out = resampleLinear(buf, 16_000, 32_000);
    expect(out.length).toBeGreaterThan(buf.length);
    // First and last samples carry through within Float32 precision.
    expect(out[0]).toBeCloseTo(0.2, 5);
    expect(out[out.length - 1] ?? 0).toBeCloseTo(0.8, 5);
  });

  it("preparePcmForModel resamples then clamps in a single pass", () => {
    const buf = new Float32Array([0.5, 1.5, -1.5]);
    const out = preparePcmForModel(buf, 24_000, 16_000);
    expect(out.length).toBe(2);
    for (const sample of out) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });
});
