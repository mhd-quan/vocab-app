import { describe, expect, it } from "vitest";
import { pcmWorkletModuleUrl } from "../../../src/ui/screens/student/pronunciation/pcmWorklet";

describe("pcmWorkletModuleUrl", () => {
  it("loads the AudioWorklet from the renderer origin in dev", () => {
    expect(pcmWorkletModuleUrl("http://localhost:5173/student/practice").url).toBe(
      "http://localhost:5173/pronunciation/pcm-capture-worklet.js",
    );
  });

  it("loads beside the built renderer index for packaged file URLs", () => {
    expect(
      pcmWorkletModuleUrl("file:///Applications/Vocab%20App.app/Contents/main_window/index.html")
        .url,
    ).toBe(
      "file:///Applications/Vocab%20App.app/Contents/main_window/pronunciation/pcm-capture-worklet.js",
    );
  });
});
