import { describe, expect, it } from "vitest";
import {
  type RecorderPermissionSnapshot,
  describeRecorderError,
  isTransientCaptureAbort,
} from "../../../src/ui/screens/student/pronunciation/recorderErrors";

const grantedMacPermission: RecorderPermissionSnapshot = {
  platform: "darwin",
  status: "granted",
  granted: true,
  readyForCapture: true,
};

const grantedWindowsPermission: RecorderPermissionSnapshot = {
  platform: "win32",
  status: "unknown",
  granted: false,
  readyForCapture: true,
};

describe("recorder error classification", () => {
  it("detects Chromium abort strings as transient capture aborts", () => {
    expect(
      isTransientCaptureAbort(new DOMException("The user aborted a request.", "AbortError")),
    ).toBe(true);
    expect(isTransientCaptureAbort(new Error("AbortError: capture failed"))).toBe(true);
  });

  it("does not send granted macOS capture aborts back to the Settings toggle copy", () => {
    const message = describeRecorderError(
      new DOMException("The user aborted a request.", "AbortError"),
      { phase: "getUserMedia", permission: grantedMacPermission },
    );

    expect(message).toContain("macOS has granted microphone access");
    expect(message).toContain("quit and reopen Vocab App");
    expect(message).not.toContain("allow Vocab App");
  });

  it("keeps Windows desktop-app privacy guidance when capture aborts after preflight", () => {
    const message = describeRecorderError(new Error("The user aborted a request."), {
      phase: "getUserMedia",
      permission: grantedWindowsPermission,
    });

    expect(message).toContain("Windows reports microphone access is available");
    expect(message).toContain("desktop apps");
  });

  it("labels post-stream aborts as audio engine failures instead of permission failures", () => {
    const message = describeRecorderError(
      new DOMException("The user aborted a request.", "AbortError"),
      { phase: "audioWorklet", permission: grantedMacPermission },
    );

    expect(message).toContain("audio engine was interrupted");
    expect(message).toContain("loading audio processor");
    expect(message).not.toContain("Privacy & Security");
  });

  it("still reports explicit denials as microphone settings problems", () => {
    const message = describeRecorderError(
      new DOMException("Permission denied", "NotAllowedError"),
      {
        phase: "getUserMedia",
        permission: null,
      },
    );

    expect(message).toContain("Microphone access was denied");
    expect(message).toContain("Privacy & Security");
  });
});
