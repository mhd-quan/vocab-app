import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _internal } from "../../../electron/pronunciation/runtime";

const { verifyHubertArchitecture } = _internal;

describe("verifyHubertArchitecture", () => {
  let dir: string;
  let modelId: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "capt-arch-"));
    modelId = "vendor/hubert-test";
    fs.mkdirSync(path.join(dir, "vendor", "hubert-test"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("accepts model_type=hubert", () => {
    fs.writeFileSync(
      path.join(dir, modelId, "config.json"),
      JSON.stringify({ model_type: "hubert" }),
    );
    expect(verifyHubertArchitecture(dir, modelId)).toEqual({ ok: true });
  });

  it("rejects model_type=wav2vec2 with explanatory reason", () => {
    fs.writeFileSync(
      path.join(dir, modelId, "config.json"),
      JSON.stringify({ model_type: "wav2vec2" }),
    );
    const result = verifyHubertArchitecture(dir, modelId);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("HuBERT");
    expect(result.reason).toContain("wav2vec2");
  });

  it("rejects bundles missing model_type", () => {
    fs.writeFileSync(path.join(dir, modelId, "config.json"), JSON.stringify({}));
    const result = verifyHubertArchitecture(dir, modelId);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("model_type");
  });

  it("is lenient when config.json is absent", () => {
    expect(verifyHubertArchitecture(dir, modelId)).toEqual({ ok: true });
  });

  it("rejects malformed config.json", () => {
    fs.writeFileSync(path.join(dir, modelId, "config.json"), "{ not json");
    const result = verifyHubertArchitecture(dir, modelId);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("could not be parsed");
  });

  it("returns ok when modelPath or modelId is missing", () => {
    expect(verifyHubertArchitecture(null, modelId)).toEqual({ ok: true });
    expect(verifyHubertArchitecture(dir, undefined)).toEqual({ ok: true });
  });
});
