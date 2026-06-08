import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type PcmCaptureDiagnostic,
  startPcmCapture,
} from "../../../src/ui/screens/student/pronunciation/pcmCaptureEngine";
import type { RecorderPhase } from "../../../src/ui/screens/student/pronunciation/recorderErrors";

const originalMediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const originalAudioWorkletNode = globalThis.AudioWorkletNode;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalMediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", originalMediaDevicesDescriptor);
  }
  if (originalAudioWorkletNode) {
    Object.defineProperty(globalThis, "AudioWorkletNode", {
      configurable: true,
      value: originalAudioWorkletNode,
    });
  } else {
    Reflect.deleteProperty(globalThis, "AudioWorkletNode");
  }
});

describe("startPcmCapture", () => {
  it("uses the same-origin AudioWorklet backend when the module loads", async () => {
    const media = installGetUserMedia();
    const harness = makeAudioContextHarness({
      addModule: vi.fn(async () => undefined),
    });
    installAudioWorkletNode(harness.workletNodes);

    const chunks: Float32Array[] = [];
    const phases: RecorderPhase[] = [];
    const diagnostics: PcmCaptureDiagnostic[] = [];

    const session = await startPcmCapture({
      permission: permission(),
      AudioContextCtor: harness.AudioContextCtor,
      workletModule: workletModule(),
      onChunk: (chunk) => chunks.push(chunk),
      onPhase: (phase) => phases.push(phase),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(session.backend).toBe("audio-worklet");
    expect(harness.addModule).toHaveBeenCalledWith(
      "http://localhost:5173/pronunciation/pcm-capture-worklet.js",
    );
    expect(harness.source.connect).toHaveBeenCalledWith(harness.workletNodes[0]);

    harness.workletNodes[0]?.port.onmessage?.({
      data: new Float32Array([0.25, -0.5]),
    } as MessageEvent<Float32Array>);

    expect(chunks).toHaveLength(1);
    expect(Array.from(chunks[0] ?? [])).toEqual([0.25, -0.5]);
    expect(phases).toContain("audioWorklet");
    expect(diagnostics.map((diagnostic) => diagnostic.event)).toContain("worklet-module-loaded");

    await session.dispose();
    expect(media.track.stop).toHaveBeenCalledTimes(1);
    expect(harness.workletNodes[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(harness.contexts[0]?.state).toBe("closed");
  });

  it("falls back to ScriptProcessor PCM when the AudioWorklet module fails", async () => {
    installGetUserMedia();
    const harness = makeAudioContextHarness({
      addModule: vi.fn(async () => {
        throw new DOMException("Refused to load worklet module.", "AbortError");
      }),
    });
    installAudioWorkletNode(harness.workletNodes);

    const chunks: Float32Array[] = [];
    const diagnostics: PcmCaptureDiagnostic[] = [];

    const session = await startPcmCapture({
      permission: permission(),
      AudioContextCtor: harness.AudioContextCtor,
      workletModule: workletModule(),
      onChunk: (chunk) => chunks.push(chunk),
      onPhase: () => undefined,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(session.backend).toBe("script-processor");
    expect(harness.processors).toHaveLength(1);
    expect(harness.source.connect).toHaveBeenCalledWith(harness.processors[0]);
    expect(diagnostics.map((diagnostic) => diagnostic.event)).toEqual(
      expect.arrayContaining(["worklet-module-failed", "backend-selected"]),
    );

    const output = new Float32Array([1, 1]);
    harness.processors[0]?.onaudioprocess?.call(
      harness.processors[0] as unknown as ScriptProcessorNode,
      {
        inputBuffer: {
          getChannelData: () => new Float32Array([0.25, -0.5]),
        },
        outputBuffer: {
          getChannelData: () => output,
        },
      } as unknown as AudioProcessingEvent,
    );

    expect(Array.from(chunks[0] ?? [])).toEqual([0.25, -0.5]);
    expect(Array.from(output)).toEqual([0, 0]);

    await session.dispose();
    expect(harness.processors[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps transient getUserMedia retry behavior inside the capture module", async () => {
    const media = installGetUserMedia({
      firstError: new DOMException("The user aborted a request.", "AbortError"),
    });
    const harness = makeAudioContextHarness({ addModule: undefined });

    const session = await startPcmCapture({
      permission: permission(),
      AudioContextCtor: harness.AudioContextCtor,
      workletModule: workletModule(),
      onChunk: () => undefined,
      onPhase: () => undefined,
      onDiagnostic: () => undefined,
    });

    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
    expect(session.backend).toBe("script-processor");

    await session.dispose();
  });
});

function permission() {
  return {
    platform: "darwin" as const,
    status: "granted" as const,
    granted: true,
    readyForCapture: true,
    canPrompt: false,
    canOpenSettings: true,
    requiresSystemSettings: false,
    requiresRestart: false,
    reason: null,
  };
}

function workletModule() {
  return {
    url: "http://localhost:5173/pronunciation/pcm-capture-worklet.js",
    protocol: "http:",
    path: "pronunciation/pcm-capture-worklet.js",
  };
}

function installGetUserMedia(options: { firstError?: Error | DOMException } = {}) {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn();
  if (options.firstError) {
    getUserMedia.mockRejectedValueOnce(options.firstError);
  }
  getUserMedia.mockResolvedValue(stream);

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  return { getUserMedia, track, stream };
}

class FakeAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeScriptProcessor extends FakeAudioNode {
  onaudioprocess: ScriptProcessorNode["onaudioprocess"] = null;
}

class FakeAudioWorkletNode extends FakeAudioNode {
  port: {
    onmessage: ((event: MessageEvent<Float32Array>) => void) | null;
  } = { onmessage: null };
}

function installAudioWorkletNode(nodes: FakeAudioWorkletNode[]) {
  class TestAudioWorkletNode extends FakeAudioWorkletNode {
    constructor() {
      super();
      nodes.push(this);
    }
  }

  Object.defineProperty(globalThis, "AudioWorkletNode", {
    configurable: true,
    value: TestAudioWorkletNode,
  });
}

function makeAudioContextHarness({ addModule }: { addModule?: (url: string) => Promise<void> }) {
  const source = new FakeAudioNode();
  const destinationNode = new FakeAudioNode();
  const processors: FakeScriptProcessor[] = [];
  const workletNodes: FakeAudioWorkletNode[] = [];
  const contexts: Array<{ state: AudioContextState }> = [];
  const addModuleSpy = addModule ? vi.fn(addModule) : undefined;

  class FakeAudioContext {
    state: AudioContextState = "running";
    sampleRate = 48_000;
    destination = destinationNode as unknown as AudioDestinationNode;
    audioWorklet = addModuleSpy
      ? ({ addModule: addModuleSpy } as unknown as AudioWorklet)
      : undefined;

    constructor() {
      contexts.push(this);
    }

    createMediaStreamSource = vi.fn(() => source as unknown as MediaStreamAudioSourceNode);

    createScriptProcessor = vi.fn(() => {
      const processor = new FakeScriptProcessor();
      processors.push(processor);
      return processor as unknown as ScriptProcessorNode;
    });

    resume = vi.fn(async () => {
      this.state = "running";
    });

    close = vi.fn(async () => {
      this.state = "closed";
    });
  }

  return {
    AudioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    addModule: addModuleSpy,
    source,
    processors,
    workletNodes,
    contexts,
  };
}
