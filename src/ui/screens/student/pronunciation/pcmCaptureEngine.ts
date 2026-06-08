import type { MicrophonePermissionView } from "./microphonePermissionClient";
import { PCM_WORKLET_PROCESSOR_NAME, type PcmWorkletModuleUrl } from "./pcmWorklet";
import { type RecorderPhase, isTransientCaptureAbort, recorderErrorMeta } from "./recorderErrors";

export type PcmCaptureBackend = "audio-worklet" | "script-processor";

export type PcmCaptureDiagnosticEvent =
  | "stream-started"
  | "context-created"
  | "context-resumed"
  | "worklet-module-loading"
  | "worklet-module-loaded"
  | "worklet-module-failed"
  | "backend-selected"
  | "capture-failed"
  | "capture-disposed";

export interface PcmCaptureDiagnostic {
  event: PcmCaptureDiagnosticEvent;
  phase: RecorderPhase;
  backend?: PcmCaptureBackend;
  permission?: MicrophonePermissionView | null;
  context?: {
    state: string | null;
    sampleRate: number | null;
  };
  worklet?: {
    protocol: string;
    path: string;
  };
  error?: ReturnType<typeof recorderErrorMeta>;
  detail?: string;
  atIso: string;
}

export interface PcmCaptureSession {
  backend: PcmCaptureBackend;
  sampleRate: number;
  dispose: () => Promise<void>;
}

interface ConnectedPcmBackend {
  backend: PcmCaptureBackend;
  worklet: AudioWorkletNode | null;
  scriptProcessor: ScriptProcessorNode | null;
}

export interface StartPcmCaptureInput {
  permission: MicrophonePermissionView;
  AudioContextCtor: typeof AudioContext;
  workletModule: PcmWorkletModuleUrl;
  onChunk: (chunk: Float32Array) => void;
  onPhase: (phase: RecorderPhase) => void;
  onDiagnostic?: (event: PcmCaptureDiagnostic) => void;
}

const SCRIPT_PROCESSOR_BUFFER_SIZE = 2048;

export async function startPcmCapture({
  permission,
  AudioContextCtor,
  workletModule,
  onChunk,
  onPhase,
  onDiagnostic,
}: StartPcmCaptureInput): Promise<PcmCaptureSession> {
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  let scriptProcessor: ScriptProcessorNode | null = null;

  const emit = (
    event: Omit<PcmCaptureDiagnostic, "atIso" | "permission"> & {
      permission?: MicrophonePermissionView | null;
    },
  ) => {
    onDiagnostic?.({
      permission,
      ...event,
      atIso: new Date().toISOString(),
    });
  };

  const dispose = async () => {
    if (worklet) {
      worklet.port.onmessage = null;
      safeDisconnect(worklet);
      worklet = null;
    }
    if (scriptProcessor) {
      scriptProcessor.onaudioprocess = null;
      safeDisconnect(scriptProcessor);
      scriptProcessor = null;
    }
    if (source) {
      safeDisconnect(source);
      source = null;
    }
    for (const track of stream?.getTracks() ?? []) {
      track.stop();
    }
    stream = null;

    const contextToClose = context;
    context = null;
    if (contextToClose && contextToClose.state !== "closed") {
      try {
        await contextToClose.close();
      } catch {
        // Context shutdown can race renderer teardown; capture is already disposed.
      }
    }

    emit({
      event: "capture-disposed",
      phase: "graph",
      context: {
        state: contextToClose?.state ?? null,
        sampleRate: contextToClose?.sampleRate ?? null,
      },
    });
  };

  try {
    onPhase("getUserMedia");
    stream = await getMicrophoneStream(permission);
    emit({ event: "stream-started", phase: "getUserMedia" });

    onPhase("AudioContext");
    context = new AudioContextCtor();
    emit({
      event: "context-created",
      phase: "AudioContext",
      context: { state: context.state, sampleRate: context.sampleRate },
    });
    if (context.state === "suspended") {
      await context.resume();
      emit({
        event: "context-resumed",
        phase: "AudioContext",
        context: { state: context.state, sampleRate: context.sampleRate },
      });
    }

    onPhase("graph");
    source = context.createMediaStreamSource(stream);

    const connected = await connectBestPcmBackend({
      context,
      source,
      workletModule,
      onChunk,
      onPhase,
      emit,
    });
    worklet = connected.worklet;
    scriptProcessor = connected.scriptProcessor;

    return {
      backend: connected.backend,
      sampleRate: context.sampleRate,
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}

async function connectBestPcmBackend({
  context,
  source,
  workletModule,
  onChunk,
  onPhase,
  emit,
}: {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  workletModule: PcmWorkletModuleUrl;
  onChunk: (chunk: Float32Array) => void;
  onPhase: (phase: RecorderPhase) => void;
  emit: (
    event: Omit<PcmCaptureDiagnostic, "atIso" | "permission"> & {
      permission?: MicrophonePermissionView | null;
    },
  ) => void;
}): Promise<ConnectedPcmBackend> {
  if (context.audioWorklet) {
    onPhase("audioWorklet");
    emit({
      event: "worklet-module-loading",
      phase: "audioWorklet",
      backend: "audio-worklet",
      context: { state: context.state, sampleRate: context.sampleRate },
      worklet: { protocol: workletModule.protocol, path: workletModule.path },
    });

    try {
      await context.audioWorklet.addModule(workletModule.url);
      emit({
        event: "worklet-module-loaded",
        phase: "audioWorklet",
        backend: "audio-worklet",
        context: { state: context.state, sampleRate: context.sampleRate },
        worklet: { protocol: workletModule.protocol, path: workletModule.path },
      });

      onPhase("graph");
      const node = new AudioWorkletNode(context, PCM_WORKLET_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      node.port.onmessage = (event) => {
        if (event.data instanceof Float32Array && event.data.length > 0) {
          onChunk(event.data);
        }
      };
      source.connect(node);
      node.connect(context.destination);
      emit({
        event: "backend-selected",
        phase: "graph",
        backend: "audio-worklet",
        context: { state: context.state, sampleRate: context.sampleRate },
      });
      return { backend: "audio-worklet", worklet: node, scriptProcessor: null };
    } catch (error) {
      emit({
        event: "worklet-module-failed",
        phase: "audioWorklet",
        backend: "audio-worklet",
        context: { state: context.state, sampleRate: context.sampleRate },
        worklet: { protocol: workletModule.protocol, path: workletModule.path },
        error: recorderErrorMeta(error),
      });
    }
  }

  onPhase("scriptProcessor");
  const processor = createScriptProcessor(context);
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    if (input.length > 0) {
      onChunk(new Float32Array(input));
    }
    event.outputBuffer.getChannelData(0).fill(0);
  };
  source.connect(processor);
  processor.connect(context.destination);
  emit({
    event: "backend-selected",
    phase: "scriptProcessor",
    backend: "script-processor",
    context: { state: context.state, sampleRate: context.sampleRate },
    detail: context.audioWorklet
      ? "AudioWorklet module failed; using main-thread PCM fallback."
      : "AudioWorklet is unavailable; using main-thread PCM fallback.",
  });
  return { backend: "script-processor", worklet: null, scriptProcessor: processor };
}

function createScriptProcessor(context: AudioContext): ScriptProcessorNode {
  if (typeof context.createScriptProcessor !== "function") {
    throw new Error("AudioWorklet failed and ScriptProcessorNode is unavailable.");
  }
  return context.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, 1, 1);
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

function safeDisconnect(node: AudioNode): void {
  try {
    node.disconnect();
  } catch {
    // Already disconnected.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
