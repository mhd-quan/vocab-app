import type { BrowserWindow } from "electron";

/**
 * Electron's content-protection flag blocks screen capture where the OS
 * supports it. The tutor-facing setting uses the positive wording
 * "Allow screenshots", so the native flag is the inverse.
 */
export function applyScreenshotPolicy(
  win: BrowserWindow | null | undefined,
  screenshotsEnabled: boolean,
): void {
  win?.setContentProtection(!screenshotsEnabled);
}
