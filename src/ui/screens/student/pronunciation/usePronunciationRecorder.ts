import { useCallback, useEffect, useRef, useState } from "react";
import { PCM_WORKLET_SOURCE } from "./pcmWorklet";

export interface RecordedPronunciationAudio {
  audioPcm: Float32Array;
  sampleRate: number;
  durationMs: number;
}

export type PronunciationRecorderState = "idle" | "recording" | "ready" | "unsupported" | "error";

const MAX_RECORDING_MS = 10_000;
const DEFAULT_SAMPLE_RATE = 16_000;
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
    const sampleRate = context?.sampleRate ?? DEFAULT_SAMPLE_RATE;
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
    setDurationMs(0);
    chunksRef.current = [];

    // Tracked so the catch block can log which capture step failed —
    // macOS in particular surfaces AbortError from getUserMedia when the
    // Renderer helper bundle is missing NSMicrophoneUsageDescription,
    // and the raw message ("The user aborted a request.") is unhelpful
    // to the user without that context.
    let phase: "getUserMedia" | "AudioContext" | "audioWorklet" | "graph" = "getUserMedia";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      streamRef.current = stream;

      phase = "AudioContext";
      const context = new AudioContextCtor();
      audioContextRef.current = context;
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
      const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
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

      sourceRef.current = source;
      workletRef.current = node;
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
      console.warn("[capt-recorder] capture failed", { phase, ...errorMeta(err) });
      await cleanup();
      setState("error");
      setError(describeRecorderError(err, phase));
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

function describeRecorderError(err: unknown, phase: string): string {
  const name = err instanceof DOMException ? err.name : null;
  if (name === "NotAllowedError") {
    return "Microphone access was denied. Enable it in System Settings → Privacy & Security → Microphone, then try again.";
  }
  if (name === "NotFoundError") {
    return "No microphone was found. Plug in or select an input device, then try again.";
  }
  if (name === "OverconstrainedError") {
    return "The selected microphone does not support the requested format. Pick a different input device.";
  }
  if (name === "NotReadableError") {
    return "The microphone is busy. Close other apps that may be recording, then try again.";
  }
  if (name === "AbortError" || /the user aborted a request/i.test(messageOf(err))) {
    // On macOS this fires when the Renderer helper bundle is missing
    // NSMicrophoneUsageDescription, or when the OS revokes the request
    // mid-prompt. Either way, "user aborted" is misleading — the user
    // didn't do anything.
    return "Microphone capture was interrupted by the system. Open System Settings → Privacy & Security → Microphone, allow this app, then restart it.";
  }
  if (err instanceof Error && err.message) return `${err.message} (phase: ${phase})`;
  return `Microphone permission was not granted (phase: ${phase}).`;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "";
}

function errorMeta(err: unknown): {
  name: string | null;
  message: string;
  code?: number;
} {
  if (err instanceof DOMException) {
    return { name: err.name, message: err.message, code: err.code };
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { name: null, message: String(err) };
}
