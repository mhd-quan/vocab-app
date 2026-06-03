export type RecorderPhase = "getUserMedia" | "AudioContext" | "audioWorklet" | "graph";

export interface RecorderPermissionSnapshot {
  platform: string;
  status: string;
  granted: boolean;
  readyForCapture: boolean;
}

export interface RecorderErrorContext {
  phase: RecorderPhase;
  permission: RecorderPermissionSnapshot | null;
}

export function describeRecorderError(err: unknown, context: RecorderErrorContext): string {
  const meta = recorderErrorMeta(err);
  if (meta.name === "NotAllowedError") {
    return "Microphone access was denied. Enable it in System Settings -> Privacy & Security -> Microphone, then try again.";
  }
  if (meta.name === "NotFoundError") {
    return "No microphone was found. Plug in or select an input device, then try again.";
  }
  if (meta.name === "OverconstrainedError") {
    return "The selected microphone does not support the requested format. Pick a different input device.";
  }
  if (meta.name === "NotReadableError") {
    return "The microphone is busy. Close other apps that may be recording, then try again.";
  }
  if (isTransientCaptureAbort(err)) {
    return describeCaptureAbort(context);
  }
  if (err instanceof Error && err.message) return `${err.message} (${phaseLabel(context.phase)}).`;
  return `Microphone capture failed (${phaseLabel(context.phase)}).`;
}

export function isTransientCaptureAbort(err: unknown): boolean {
  const meta = recorderErrorMeta(err);
  return meta.name === "AbortError" || /the user aborted a request|aborterror/i.test(meta.message);
}

export function recorderErrorMeta(err: unknown): {
  name: string | null;
  message: string;
  code?: number;
} {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return { name: err.name, message: err.message, code: err.code };
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { name: null, message: String(err) };
}

function describeCaptureAbort({ phase, permission }: RecorderErrorContext): string {
  if (phase !== "getUserMedia") {
    return `Microphone access is available, but the audio engine was interrupted while preparing capture (${phaseLabel(phase)}). Restart Vocab App and try again.`;
  }

  if (permission?.platform === "darwin" && permission.granted) {
    return "macOS has granted microphone access, but the capture request was aborted. If you changed microphone access while Vocab App was open, quit and reopen Vocab App once, then try again.";
  }

  if (permission?.platform === "win32" && permission.readyForCapture) {
    return "Windows reports microphone access is available, but the capture request was interrupted. Check that microphone access for desktop apps is enabled, then try again.";
  }

  if (permission?.readyForCapture) {
    return "Microphone access is available, but the capture request was interrupted before audio started. Restart Vocab App and try again.";
  }

  return "Microphone capture was interrupted by the system. Open microphone privacy settings, allow Vocab App, then restart it.";
}

function phaseLabel(phase: RecorderPhase): string {
  if (phase === "getUserMedia") return "starting microphone stream";
  if (phase === "AudioContext") return "starting audio engine";
  if (phase === "audioWorklet") return "loading audio processor";
  return "connecting audio graph";
}
