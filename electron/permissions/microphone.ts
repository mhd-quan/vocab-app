import { shell, systemPreferences } from "electron";

export type MicrophonePermissionStatus =
  | "not-determined"
  | "granted"
  | "denied"
  | "restricted"
  | "unknown";

export interface MicrophonePermissionState {
  platform: NodeJS.Platform;
  status: MicrophonePermissionStatus;
  granted: boolean;
  readyForCapture: boolean;
  canPrompt: boolean;
  canOpenSettings: boolean;
  requiresSystemSettings: boolean;
  requiresRestart: boolean;
  reason: string | null;
}

export function getMicrophonePermissionStatus(): MicrophonePermissionState {
  return describeMicrophonePermission(readNativeMicrophoneStatus(), process.platform);
}

export async function requestMicrophonePermission(): Promise<MicrophonePermissionState> {
  if (process.platform === "darwin") {
    const current = readNativeMicrophoneStatus();
    if (current === "not-determined") {
      try {
        await systemPreferences.askForMediaAccess("microphone");
      } catch {
        return describeMicrophonePermission("unknown", process.platform);
      }
    }
  }

  return getMicrophonePermissionStatus();
}

export async function openMicrophonePermissionSettings(): Promise<{ opened: boolean }> {
  const url = microphoneSettingsUrl(process.platform);
  if (!url) return { opened: false };
  await shell.openExternal(url);
  return { opened: true };
}

export function describeMicrophonePermission(
  status: MicrophonePermissionStatus,
  platform: NodeJS.Platform,
): MicrophonePermissionState {
  const granted = status === "granted";
  const blocked = status === "denied" || status === "restricted";
  const canPrompt = platform === "darwin" && status === "not-determined";
  const canOpenSettings = platform === "darwin" || platform === "win32";

  return {
    platform,
    status,
    granted,
    readyForCapture: granted || (!blocked && platform !== "darwin"),
    canPrompt,
    canOpenSettings,
    requiresSystemSettings: blocked,
    requiresRestart: platform === "darwin" && blocked,
    reason: reasonFor(status, platform),
  };
}

function readNativeMicrophoneStatus(): MicrophonePermissionStatus {
  if (process.platform !== "darwin" && process.platform !== "win32") {
    return "unknown";
  }

  try {
    return systemPreferences.getMediaAccessStatus("microphone");
  } catch {
    return "unknown";
  }
}

function microphoneSettingsUrl(platform: NodeJS.Platform): string | null {
  if (platform === "darwin") {
    return "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
  }
  if (platform === "win32") {
    return "ms-settings:privacy-microphone";
  }
  return null;
}

function reasonFor(status: MicrophonePermissionStatus, platform: NodeJS.Platform): string | null {
  if (status === "granted") return null;
  if (status === "not-determined" && platform === "darwin") {
    return "macOS has not been asked for microphone access yet.";
  }
  if (status === "denied" && platform === "darwin") {
    return "macOS is blocking microphone access for Vocab App. Enable it in System Settings, then restart the app.";
  }
  if (status === "denied" && platform === "win32") {
    return "Windows is blocking microphone access for desktop apps. Enable microphone access in Windows Settings, then try again.";
  }
  if (status === "restricted") {
    return "Microphone access is restricted by the operating system or device policy.";
  }
  return "Microphone permission status is unknown. The app will ask through the browser capture flow.";
}
