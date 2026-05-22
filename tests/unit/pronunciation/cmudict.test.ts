import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _internal, cmudictLookup, cmudictPath } from "../../../electron/pronunciation/cmudict";

describe("cmudict loader", () => {
  let tmpRoot: string;
  let savedCwd: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cmudict-"));
    fs.mkdirSync(path.join(tmpRoot, "assets", "cmudict"), { recursive: true });
    savedCwd = process.cwd();
    process.chdir(tmpRoot);
    _internal.resetCache();
  });

  afterEach(() => {
    process.chdir(savedCwd);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    _internal.resetCache();
  });

  function writeDict(content: string): void {
    fs.writeFileSync(path.join(tmpRoot, "assets", "cmudict", "cmudict-0.7b.txt"), content);
  }

  it("parses lowercase words and returns the phoneme string", () => {
    writeDict("fantastic F AE1 N T AE2 S T IH0 K\n");
    expect(cmudictLookup("fantastic")).toBe("F AE1 N T AE2 S T IH0 K");
    expect(cmudictLookup("FANTASTIC")).toBe("F AE1 N T AE2 S T IH0 K");
  });

  it("keeps only the first variant when a word has multiple pronunciations", () => {
    writeDict(["read R IY1 D", "read(2) R EH1 D"].join("\n"));
    expect(cmudictLookup("read")).toBe("R IY1 D");
  });

  it("skips comment lines starting with three semicolons", () => {
    writeDict([";;; comment header", "family F AE1 M AH0 L IY0"].join("\n"));
    expect(cmudictLookup("family")).toBe("F AE1 M AH0 L IY0");
  });

  it("strips inline pound-sign comments from the phoneme tail", () => {
    writeDict("aalborg AO1 L B AO0 R G # place, danish\n");
    expect(cmudictLookup("aalborg")).toBe("AO1 L B AO0 R G");
  });

  it("returns null for unknown words", () => {
    writeDict("hello HH AH0 L OW1\n");
    expect(cmudictLookup("nopesuch")).toBeNull();
  });

  it("returns null when the dictionary file is not present", () => {
    expect(cmudictPath()).toBeNull();
    expect(cmudictLookup("anything")).toBeNull();
  });
});
