import type { PcmCaptureDiagnostic } from "./pcmCaptureEngine";

export async function reportMicrophoneCaptureDiagnostic(
  diagnostic: PcmCaptureDiagnostic,
): Promise<void> {
  const level = isWarningDiagnostic(diagnostic) ? "warn" : "debug";
  console[level]("[capt-recorder]", diagnostic);

  const logDiagnostic = window.api.permissions.logMicrophoneCaptureDiagnostic;
  if (!logDiagnostic) return;

  try {
    await logDiagnostic(diagnostic);
  } catch (error) {
    console.warn("[capt-recorder] failed to forward capture diagnostic", error);
  }
}

function isWarningDiagnostic(diagnostic: PcmCaptureDiagnostic): boolean {
  return diagnostic.event.endsWith("failed");
}
