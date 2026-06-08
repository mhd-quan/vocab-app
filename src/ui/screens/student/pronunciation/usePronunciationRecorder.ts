import { useCallback, useEffect, useRef, useState } from "react";
import { reportMicrophoneCaptureDiagnostic } from "./captureDiagnostics";
import {
  type MicrophonePermissionView,
  latestMicrophonePermission,
  requestMicrophonePermissionForCapture,
} from "./microphonePermissionClient";
import { type PcmCaptureSession, startPcmCapture } from "./pcmCaptureEngine";
import { pcmWorkletModuleUrl } from "./pcmWorklet";
import { type RecorderPhase, describeRecorderError, recorderErrorMeta } from "./recorderErrors";

export interface RecordedPronunciationAudio {
  audioPcm: Float32Array;
  sampleRate: number;
  durationMs: number;
}

export type PronunciationRecorderState = "idle" | "recording" | "ready" | "unsupported" | "error";

const MAX_RECORDING_MS = 10_000;
const FALLBACK_SAMPLE_RATE = 16_000;

export function usePronunciationRecorder(maxDurationMs = MAX_RECORDING_MS) {
  const [state, setState] = useState<PronunciationRecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [recording, setRecording] = useState<RecordedPronunciationAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<MicrophonePermissionView | null>(null);

  const captureRef = useRef<PcmCaptureSession | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const cleanup = useCallback(async () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const capture = captureRef.current;
    captureRef.current = null;
    if (capture) {
      try {
        await capture.dispose();
      } catch {
        // ignore — the capture graph may already be closing/closed
      }
    }
  }, []);

  const finish = useCallback(async (): Promise<RecordedPronunciationAudio | null> => {
    const capture = captureRef.current;
    const sampleRate = capture?.sampleRate ?? FALLBACK_SAMPLE_RATE;
    if (!capture || chunksRef.current.length === 0) {
      await cleanup();
      setState("error");
      setError("No microphone audio was captured.");
      return null;
    }

    const duration = Math.max(0, Date.now() - startedAtRef.current);
    const pcm = mergeChunks(chunksRef.current);
    chunksRef.current = [];
    const nextRecording: RecordedPronunciationAudio = {
      audioPcm: pcm,
      sampleRate,
      durationMs: duration,
    };
    await cleanup();
    setDurationMs(duration);
    setRecording(nextRecording);
    setState("ready");
    return nextRecording;
  }, [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    if (state === "recording") return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setError("Microphone capture is not available in this environment.");
      return false;
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      setState("unsupported");
      setError("AudioContext is not available in this environment.");
      return false;
    }

    await cleanup();
    setRecording(null);
    setError(null);
    setPermission(null);
    setDurationMs(0);
    chunksRef.current = [];

    // Tracked so the catch block can report the actual failing layer. macOS
    // and Chromium both surface several unrelated capture failures as the
    // same AbortError string.
    let phase: RecorderPhase = "getUserMedia";
    let activePermission: MicrophonePermissionView | null = null;
    try {
      const permission = await requestMicrophonePermissionForCapture();
      activePermission = permission;
      setPermission(permission);
      if (!permission.readyForCapture) {
        setState("error");
        setError(permission.reason ?? "Microphone access is not available.");
        return false;
      }

      const capture = await startPcmCapture({
        permission,
        AudioContextCtor,
        workletModule: pcmWorkletModuleUrl(),
        onChunk: (chunk) => chunksRef.current.push(chunk),
        onPhase: (nextPhase) => {
          phase = nextPhase;
        },
        onDiagnostic: (diagnostic) => {
          void reportMicrophoneCaptureDiagnostic(diagnostic);
        },
      });
      captureRef.current = capture;
      startedAtRef.current = Date.now();
      setState("recording");

      intervalRef.current = window.setInterval(() => {
        setDurationMs(Math.max(0, Date.now() - startedAtRef.current));
      }, 120);
      timeoutRef.current = window.setTimeout(() => {
        void finish();
      }, maxDurationMs);
      return true;
    } catch (err) {
      activePermission = await latestMicrophonePermission(activePermission);
      void reportMicrophoneCaptureDiagnostic({
        event: "capture-failed",
        phase,
        permission: activePermission,
        error: recorderErrorMeta(err),
        atIso: new Date().toISOString(),
      });
      console.warn("[capt-recorder] capture failed", {
        phase,
        permission: activePermission,
        ...recorderErrorMeta(err),
      });
      await cleanup();
      setPermission(activePermission);
      setState("error");
      setError(describeRecorderError(err, { phase, permission: activePermission }));
      return false;
    }
  }, [cleanup, finish, maxDurationMs, state]);

  const stop = useCallback(async (): Promise<RecordedPronunciationAudio | null> => {
    if (state !== "recording") return recording;
    return finish();
  }, [finish, recording, state]);

  const reset = useCallback(async () => {
    await cleanup();
    chunksRef.current = [];
    setDurationMs(0);
    setRecording(null);
    setError(null);
    setPermission(null);
    setState("idle");
  }, [cleanup]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  return {
    state,
    durationMs,
    recording,
    error,
    permission,
    maxDurationMs,
    start,
    stop,
    reset,
  };
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  if (chunks.length === 1) return chunks[0] ?? new Float32Array();
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}
