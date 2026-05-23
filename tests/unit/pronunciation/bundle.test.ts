import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron's `app.getPath("userData")` via a stub before importing bundle.
vi.mock("electron", () => ({ app: { getPath: () => os.tmpdir() } }));

import {
  _internal as bundleInternal,
  loadAcousticBundle,
} from "../../../electron/pronunciation/bundle";

describe("loadAcousticBundle", () => {
  let dir: string;
  const modelId = "vendor/hubert-test";

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "capt-bundle-"));
    fs.mkdirSync(path.join(dir, "vendor", "hubert-test"), { recursive: true });
    bundleInternal.resetCache();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    bundleInternal.resetCache();
  });

  function writeManifest(extra: Record<string, unknown> = {}): void {
    fs.writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify({
        modelFamily: "hubert",
        modelId,
        sampleRate: 16_000,
        frameMs: 20,
        labels: {},
        ...extra,
      }),
    );
  }

  function writeFullVocab(): void {
    const arpabet = [
      "AA",
      "AE",
      "AH",
      "AO",
      "AW",
      "AY",
      "B",
      "CH",
      "D",
      "DH",
      "EH",
      "ER",
      "EY",
      "F",
      "G",
      "HH",
      "IH",
      "IY",
      "JH",
      "K",
      "L",
      "M",
      "N",
      "NG",
      "OW",
      "OY",
      "P",
      "R",
      "S",
      "SH",
      "T",
      "TH",
      "UH",
      "UW",
      "V",
      "W",
      "Y",
      "Z",
      "ZH",
    ];
    const vocab: Record<string, number> = { "<blank>": 0 };
    arpabet.forEach((label, idx) => {
      vocab[label] = idx + 1;
    });
    fs.writeFileSync(path.join(dir, modelId, "vocab.json"), JSON.stringify(vocab));
  }

  it("caches the manifest + vocab + architecture across calls", () => {
    writeManifest();
    writeFullVocab();
    fs.writeFileSync(
      path.join(dir, modelId, "config.json"),
      JSON.stringify({ model_type: "hubert" }),
    );

    const readSpy = vi.spyOn(fs, "readFileSync");
    const first = loadAcousticBundle(dir);
    expect(first).not.toBeNull();
    const initialReads = readSpy.mock.calls.length;
    expect(initialReads).toBeGreaterThan(0);

    const second = loadAcousticBundle(dir);
    expect(second).toBe(first);
    expect(readSpy.mock.calls.length).toBe(initialReads);

    readSpy.mockRestore();
  });

  it("returns null when the manifest file is missing", () => {
    expect(loadAcousticBundle(dir)).toBeNull();
  });

  it("returns null when the manifest declares the wrong family", () => {
    writeManifest({ modelFamily: "wav2vec2" });
    expect(loadAcousticBundle(dir)).toBeNull();
  });

  it("flags incomplete label coverage", () => {
    writeManifest();
    fs.writeFileSync(
      path.join(dir, modelId, "vocab.json"),
      JSON.stringify({ "<blank>": 0, F: 1, T: 2 }),
    );
    const bundle = loadAcousticBundle(dir);
    expect(bundle).not.toBeNull();
    expect(bundle?.coverage.ok).toBe(false);
    expect(bundle?.coverage.missing).toContain("AE");
  });

  it("rejects non-hubert config.json with explanatory reason", () => {
    writeManifest();
    writeFullVocab();
    fs.writeFileSync(
      path.join(dir, modelId, "config.json"),
      JSON.stringify({ model_type: "wav2vec2" }),
    );
    const bundle = loadAcousticBundle(dir);
    expect(bundle?.architecture.ok).toBe(false);
    expect(bundle?.architecture.reason).toContain("HuBERT");
  });
});
