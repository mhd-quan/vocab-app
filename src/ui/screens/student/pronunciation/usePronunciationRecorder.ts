import { useCallback, useEffect, useRef, useState } from "react";

export interface RecordedPronunciationAudio {
  audioPcm: number[];
  sampleRate: number;
  durationMs: number;
}

export type PronunciationRecorderState = "idle" | "recording" | "ready" | "unsupported" | "error";

const MAX_RECORDING_MS = 5_000;

export function usePronunciationRecorder(maxDurationMs = MAX_RECORDING_MS) {
  const [state, setState] = useState<PronunciationRecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [recording, setRecording] = useState<RecordedPronunciationAudio | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteRef = useRef<GainNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    processorRef.current?.disconnect();
    muteRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    muteRef.current = null;
    sourceRef.current = null;

    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;

    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }, []);

  const finish = useCallback((): RecordedPronunciationAudio | null => {
    const context = audioContextRef.current;
    if (!context || chunksRef.current.length === 0) {
      cleanup();
      setState("error");
      setError("No microphone audio was captured.");
      return null;
    }

    const duration = Math.max(0, Date.now() - startedAtRef.current);
    const pcm = mergeChunks(chunksRef.current);
    const nextRecording = {
      audioPcm: Array.from(pcm),
      sampleRate: context.sampleRate,
      durationMs: duration,
    };
    cleanup();
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

    cleanup();
    setRecording(null);
    setError(null);
    setDurationMs(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      const context = new AudioContextCtor();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;

      processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(channel));
      };

      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);

      audioContextRef.current = context;
      streamRef.current = stream;
      sourceRef.current = source;
      processorRef.current = processor;
      muteRef.current = mute;
      startedAtRef.current = Date.now();
      setState("recording");

      intervalRef.current = window.setInterval(() => {
        setDurationMs(Math.max(0, Date.now() - startedAtRef.current));
      }, 120);
      timeoutRef.current = window.setTimeout(() => {
        finish();
      }, maxDurationMs);
      return true;
    } catch (err) {
      cleanup();
      setState("error");
      setError(err instanceof Error ? err.message : "Microphone permission was not granted.");
      return false;
    }
  }, [cleanup, finish, maxDurationMs, state]);

  const stop = useCallback(async (): Promise<RecordedPronunciationAudio | null> => {
    if (state !== "recording") return recording;
    return finish();
  }, [finish, recording, state]);

  const reset = useCallback(() => {
    cleanup();
    chunksRef.current = [];
    setDurationMs(0);
    setRecording(null);
    setError(null);
    setState("idle");
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

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
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}
