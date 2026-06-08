import { describe, expect, it, vi } from "vitest";
import {
  type MicrophonePermissionBridge,
  isMissingIpcHandlerError,
  latestMicrophonePermission,
  requestMicrophonePermissionForCapture,
} from "../../../src/ui/screens/student/pronunciation/microphonePermissionClient";

function bridge(overrides: Partial<MicrophonePermissionBridge>): MicrophonePermissionBridge {
  return {
    platform: "darwin",
    microphoneStatus: vi.fn(async () => permission({ status: "granted", granted: true })),
    requestMicrophone: vi.fn(async () => permission({ status: "granted", granted: true })),
    ...overrides,
  };
}

function permission(
  overrides: Partial<Awaited<ReturnType<MicrophonePermissionBridge["microphoneStatus"]>>> = {},
): Awaited<ReturnType<MicrophonePermissionBridge["microphoneStatus"]>> {
  return {
    platform: "darwin",
    status: "unknown",
    granted: false,
    readyForCapture: true,
    canPrompt: true,
    canOpenSettings: true,
    requiresSystemSettings: false,
    requiresRestart: false,
    reason: null,
    ...overrides,
  };
}

describe("microphonePermissionClient", () => {
  it("detects missing Electron invoke handlers by channel", () => {
    const error = new Error(
      "Error invoking remote method 'permissions.requestMicrophone': Error: No handler registered for 'permissions.requestMicrophone'",
    );

    expect(isMissingIpcHandlerError(error)).toBe(true);
    expect(isMissingIpcHandlerError(error, "permissions.requestMicrophone")).toBe(true);
    expect(isMissingIpcHandlerError(error, "permissions.microphoneStatus")).toBe(false);
  });

  it("falls back to browser capture flow when requestMicrophone IPC is unavailable", async () => {
    const client = bridge({
      requestMicrophone: vi.fn(async () => {
        throw new Error("No handler registered for 'permissions.requestMicrophone'");
      }),
    });

    await expect(requestMicrophonePermissionForCapture(client)).resolves.toMatchObject({
      platform: "darwin",
      status: "unknown",
      readyForCapture: true,
      canPrompt: true,
    });
  });

  it("does not swallow unrelated permission request errors", async () => {
    const client = bridge({
      requestMicrophone: vi.fn(async () => {
        throw new Error("permission database unavailable");
      }),
    });

    await expect(requestMicrophonePermissionForCapture(client)).rejects.toThrow(
      "permission database unavailable",
    );
  });

  it("uses the fallback snapshot when microphoneStatus IPC is unavailable", async () => {
    const fallback = permission({ status: "granted", granted: true });
    const client = bridge({
      microphoneStatus: vi.fn(async () => {
        throw new Error("No handler registered for 'permissions.microphoneStatus'");
      }),
    });

    await expect(latestMicrophonePermission(fallback, client)).resolves.toEqual(fallback);
  });
});
