import { api } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { PCM_WORKLET_SOURCE } from "./pcmWorklet";
import {
  type RecorderPhase,
  describeRecorderError,
  isTransientCaptureAbort,
  recorderErrorMeta,
} from "./recorderErrors";

export interface RecordedPronunciationAudio {
  audioPcm: Float32Array;
  sampleRate: number;
  durationMs: number;
}

export type PronunciationRecorderState = "idle" | "recording" | "ready" | "unsupported" | "error";
type MicrophonePermissionView = Awaited<ReturnType<typeof api.permissions.microphoneStatus>>;

const MAX_RECORDING_MS = 10_000;
const FALLBACK_SAMPLE_RATE = 16_000;
const PROCESSOR_NAME = "pcm-capture";

let cachedWorkletUrl: string | null = null;

function workletUrl(): string {
  if (cachedWorkletUrl) return cachedWorkletUrl;
  const blob = new Blob([PCM_WORKLET_SOURCE], { type: "application/javascript" });
  cachedWorkletUrl = URL.createObjectURL(blob);
  return cachedWorkletUrl;
}

export function usePronunciationRecorder(maxDurationMs = MAX_RECORDING_MS) {
  const [state, setState] = useState<PronunciationRecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [recording, setRecording] = useState<RecordedPronunciationAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<MicrophonePermissionView | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
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

    const worklet = workletRef.current;
    if (worklet) {
      worklet.port.onmessage = null;
      worklet.disconnect();
    }
    sourceRef.current?.disconnect();
    workletRef.current = null;
    sourceRef.current = null;

    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;

    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // ignore — context may already be closing/closed
      }
    }
  }, []);

  const finish = useCallback(async (): Promise<RecordedPronunciationAudio | null> => {
    const context = audioContextRef.current;
    const sampleRate = context?.sampleRate ?? FALLBACK_SAMPLE_RATE;
    if (!context || chunksRef.current.length === 0) {
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
      const permission = await api.permissions.requestMicrophone();
      activePermission = permission;
      setPermission(permission);
      if (!permission.readyForCapture) {
        setState("error");
        setError(permission.reason ?? "Microphone access is not available.");
        return false;
      }

      const stream = await getMicrophoneStream(permission);
      streamRef.current = stream;
      phase = "AudioContext";
      const context = new AudioContextCtor();
      audioContextRef.current = context;
      if (context.state === "suspended") {
        await context.resume();
      }
      if (!context.audioWorklet) {
        await cleanup();
        setState("unsupported");
        setError("AudioWorklet is not supported in this environment.");
        return false;
      }

      phase = "audioWorklet";
      await context.audioWorklet.addModule(workletUrl());
      phase = "graph";
      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      workletRef.current = node;
      node.port.onmessage = (event) => {
        if (event.data instanceof Float32Array && event.data.length > 0) {
          chunksRef.current.push(event.data);
        }
      };
      source.connect(node);
      // The node needs an output sink to keep its render quantum running;
      // routing through `destination` keeps things consistent across
      // browsers without playing back the mic (output channel is silent
      // since we never write to `outputs` in the processor).
      node.connect(context.destination);

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

async function getMicrophoneStream(permission: MicrophonePermissionView): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = { audio: true, video: false };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (!shouldRetryGetUserMedia(err, permission)) throw err;
  }

  await delay(200);
  return navigator.mediaDevices.getUserMedia(constraints);
}

function shouldRetryGetUserMedia(err: unknown, permission: MicrophonePermissionView): boolean {
  if (!isTransientCaptureAbort(err)) return false;
  if (permission.status === "denied" || permission.status === "restricted") return false;
  return permission.readyForCapture;
}

async function latestMicrophonePermission(
  fallback: MicrophonePermissionView | null,
): Promise<MicrophonePermissionView | null> {
  try {
    return await api.permissions.microphoneStatus();
  } catch {
    return fallback;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
