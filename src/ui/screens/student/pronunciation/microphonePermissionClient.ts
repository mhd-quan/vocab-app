import { api } from "@/lib/api";

export type MicrophonePermissionView = Awaited<ReturnType<typeof api.permissions.microphoneStatus>>;

export interface MicrophonePermissionBridge {
  platform: MicrophonePermissionView["platform"] | "test";
  microphoneStatus: () => Promise<MicrophonePermissionView>;
  requestMicrophone: () => Promise<MicrophonePermissionView>;
}

const MISSING_HANDLER_PATTERN = /No handler registered for ['"]([^'"]+)['"]/i;

export const rendererMicrophonePermissionBridge: MicrophonePermissionBridge = {
  platform: api.app.platform,
  microphoneStatus: () => api.permissions.microphoneStatus(),
  requestMicrophone: () => api.permissions.requestMicrophone(),
};

export async function requestMicrophonePermissionForCapture(
  bridge: MicrophonePermissionBridge = rendererMicrophonePermissionBridge,
): Promise<MicrophonePermissionView> {
  try {
    return await bridge.requestMicrophone();
  } catch (error) {
    if (!isMissingIpcHandlerError(error, "permissions.requestMicrophone")) throw error;
    console.warn(
      "[capt-recorder] permissions.requestMicrophone IPC handler is unavailable; falling back to browser capture permission flow.",
      { ...missingIpcHandlerMeta(error), platform: bridge.platform },
    );
    return fallbackMicrophonePermission(bridge.platform);
  }
}

export async function latestMicrophonePermission(
  fallback: MicrophonePermissionView | null,
  bridge: MicrophonePermissionBridge = rendererMicrophonePermissionBridge,
): Promise<MicrophonePermissionView | null> {
  try {
    return await bridge.microphoneStatus();
  } catch (error) {
    if (!isMissingIpcHandlerError(error, "permissions.microphoneStatus")) return fallback;
    console.warn(
      "[capt-recorder] permissions.microphoneStatus IPC handler is unavailable; using last known microphone permission snapshot.",
      { ...missingIpcHandlerMeta(error), platform: bridge.platform },
    );
    return fallback ?? fallbackMicrophonePermission(bridge.platform);
  }
}

export function isMissingIpcHandlerError(error: unknown, channel?: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(MISSING_HANDLER_PATTERN);
  if (!match) return false;
  return channel ? match[1] === channel : true;
}

function fallbackMicrophonePermission(
  platform: MicrophonePermissionBridge["platform"],
): MicrophonePermissionView {
  return {
    platform: platform === "test" ? "linux" : platform,
    status: "unknown",
    granted: false,
    readyForCapture: true,
    canPrompt: true,
    canOpenSettings: platform === "darwin" || platform === "win32",
    requiresSystemSettings: false,
    requiresRestart: false,
    reason: null,
  };
}

function missingIpcHandlerMeta(error: unknown): { message: string; channel: string | null } {
  const message = error instanceof Error ? error.message : String(error);
  return {
    message,
    channel: message.match(MISSING_HANDLER_PATTERN)?.[1] ?? null,
  };
}
