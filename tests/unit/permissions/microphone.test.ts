import { describe, expect, it } from "vitest";
import { describeMicrophonePermission } from "../../../electron/permissions/microphone";

describe("describeMicrophonePermission", () => {
  it("marks macOS not-determined access as promptable but not ready", () => {
    const state = describeMicrophonePermission("not-determined", "darwin");

    expect(state).toMatchObject({
      platform: "darwin",
      status: "not-determined",
      granted: false,
      readyForCapture: false,
      canPrompt: true,
      requiresSystemSettings: false,
    });
  });

  it("marks macOS denied access as settings-only and restart-sensitive", () => {
    const state = describeMicrophonePermission("denied", "darwin");

    expect(state.readyForCapture).toBe(false);
    expect(state.canOpenSettings).toBe(true);
    expect(state.requiresSystemSettings).toBe(true);
    expect(state.requiresRestart).toBe(true);
    expect(state.reason).toContain("System Settings");
  });

  it("marks Windows denied access as blocked by system settings", () => {
    const state = describeMicrophonePermission("denied", "win32");

    expect(state.readyForCapture).toBe(false);
    expect(state.canOpenSettings).toBe(true);
    expect(state.requiresSystemSettings).toBe(true);
    expect(state.requiresRestart).toBe(false);
    expect(state.reason).toContain("Windows Settings");
  });

  it("allows browser capture attempts when non-macOS status is unknown", () => {
    const state = describeMicrophonePermission("unknown", "win32");

    expect(state.granted).toBe(false);
    expect(state.readyForCapture).toBe(true);
    expect(state.reason).toContain("browser capture flow");
  });
});
