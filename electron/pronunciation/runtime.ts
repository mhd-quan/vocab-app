import {
  type PronunciationAnalyzeInput,
  type PronunciationAssessment,
  type PronunciationExecutionProvider,
  type PronunciationRuntimeStatus,
  type PronunciationScoringPolicy,
  assessPronunciationFromFrames,
  buildPhrasePronunciationTarget,
  buildPronunciationTarget,
  ctcViterbiAlign,
  deterministicAcousticFrames,
  scoreStress,
} from "../../src/modules/pronunciation";
import {
  _internal as bundleInternal,
  formatMissingLabels,
  loadAcousticBundle,
  modelManifestExists,
} from "./bundle";
import { cmudictLookup } from "./cmudict";
import { hasTransformersRuntime } from "./dependencies";
import { cancelPending, disposeInferenceClient, infer, warmupInference } from "./inferenceClient";
import { findModelPath } from "./paths";
import { tryLoadWasmAligner, wasmLoadFailureReason } from "./wasm/loader";

const wasmAligner = tryLoadWasmAligner();
if (!wasmAligner) {
  const reason = wasmLoadFailureReason();
  if (reason) console.info("[capt] WASM Viterbi unavailable, using JS fallback:", reason);
}

export async function pronunciationStatus(): Promise<PronunciationRuntimeStatus> {
  const baseStatus = baseRuntimeStatus();
  const bundle = loadAcousticBundle(baseStatus.modelPath);

  if (!baseStatus.modelPresent) {
    return {
      ...baseStatus,
      available: false,
      backend: "deterministic",
      reason:
        "No offline HuBERT CAPT model bundle found. Install capt-models/manifest.json plus ONNX model files.",
    };
  }

  if (!bundle) {
    return {
      ...baseStatus,
      available: false,
      backend: "deterministic",
      reason: "CAPT model manifest must declare modelFamily=hubert and a local modelId.",
    };
  }

  if (!bundle.coverage.ok) {
    return {
      ...baseStatus,
      available: false,
      backend: "deterministic",
      modelId: bundle.manifest.modelId,
      reason: `HuBERT CAPT model labels are missing required English phonemes: ${formatMissingLabels(
        bundle.coverage.missing,
      )}.`,
    };
  }

  if (!bundle.architecture.ok) {
    return {
      ...baseStatus,
      available: false,
      backend: "deterministic",
      modelId: bundle.manifest.modelId,
      reason: bundle.architecture.reason ?? "CAPT bundle does not declare a HuBERT architecture.",
    };
  }

  const dependenciesReady = await hasTransformersRuntime(baseStatus.platform, baseStatus.arch);
  if (!dependenciesReady) {
    return {
      ...baseStatus,
      available: false,
      backend: "deterministic",
      modelId: bundle.manifest.modelId,
      reason: "CAPT runtime dependencies or native binaries are not installed for this platform.",
    };
  }

  return {
    ...baseStatus,
    modelId: bundle.manifest.modelId,
    available: true,
    backend: "transformers-js",
    reason: null,
  };
}

export function pronunciationTarget(input: { text: string; ipa?: string | null }) {
  return buildTargetForText(input.text, input.ipa);
}

export async function assessPronunciation(
  input: PronunciationAnalyzeInput,
  policy?: Partial<PronunciationScoringPolicy> | null,
): Promise<
  | { ok: true; assessment: PronunciationAssessment; status: PronunciationRuntimeStatus }
  | { ok: false; status: PronunciationRuntimeStatus; reason: string }
> {
  const startedAt = Date.now();
  const status = await pronunciationStatus();
  if (!status.available) {
    return { ok: false, status, reason: status.reason ?? "Pronunciation model is unavailable." };
  }
  const bundle = loadAcousticBundle(status.modelPath);
  if (!bundle) {
    return {
      ok: false,
      status: { ...status, available: false, reason: "CAPT model bundle disappeared." },
      reason: "CAPT model bundle disappeared.",
    };
  }

  try {
    const audioPcm = input.audioPcm;
    if (!audioPcm) {
      throw new Error("No PCM audio was supplied for pronunciation analysis.");
    }
    const sampleRate = input.sampleRate ?? bundle.manifest.sampleRate ?? 16_000;
    const pcm = audioPcm instanceof Float32Array ? audioPcm : Float32Array.from(audioPcm);
    const inferStart = Date.now();
    const { frames, labels, provider, durationMs } = await infer(
      bundle,
      status.executionProvider,
      pcm,
      sampleRate,
    );
    const usedStatus: PronunciationRuntimeStatus = { ...status, executionProvider: provider };
    console.info("[capt] infer", {
      modelId: bundle.manifest.modelId,
      provider,
      frames: frames.length,
      labels: labels.labels.length,
      workerMs: durationMs,
      totalMs: Date.now() - inferStart,
    });
    const assessment = assessPronunciationFromFrames({
      input,
      frames,
      labels,
      runtime: usedStatus,
      startedAt,
      policy,
      buildTargetOptions: { lookup: cmudictLookup },
      align: wasmAligner?.ctcAlignWasm,
    });
    return {
      ok: true,
      status: usedStatus,
      assessment: {
        ...assessment,
        target: buildTargetForText(input.targetText, input.ipa),
        durationMs: Math.max(0, Date.now() - startedAt),
        modelUsed: true,
        feedback: [
          ...assessment.feedback,
          `Model: ${bundle.manifest.modelId} · ${provider.toUpperCase()}`,
        ],
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "CAPT model inference failed.";
    console.warn("[capt] infer failed:", reason);
    return {
      ok: false,
      status: { ...status, available: false, reason },
      reason,
    };
  }
}

export async function warmupPronunciation(): Promise<{ ok: boolean; reason?: string }> {
  const status = await pronunciationStatus();
  if (!status.available) {
    return { ok: false, reason: status.reason ?? "Pronunciation model is unavailable." };
  }
  const bundle = loadAcousticBundle(status.modelPath);
  if (!bundle) {
    return { ok: false, reason: "CAPT model bundle disappeared." };
  }
  try {
    await warmupInference(bundle, status.executionProvider);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "CAPT warmup failed.";
    return { ok: false, reason };
  }
}

export function cancelPronunciationInflight(): { cancelled: number } {
  return { cancelled: cancelPending() };
}

export async function disposePronunciationRuntime(): Promise<void> {
  await disposeInferenceClient();
}

export function previewPronunciation(input: PronunciationAnalyzeInput): PronunciationAssessment {
  const target = buildTargetForText(input.targetText, input.ipa);
  const runtime: PronunciationRuntimeStatus = {
    available: true,
    backend: "deterministic",
    executionProvider: "cpu",
    modelFamily: "hubert",
    modelId: null,
    platform: process.platform,
    arch: process.arch,
    modelPath: null,
    modelPresent: false,
    localOnly: true,
    reason: "Deterministic alignment preview; no acoustic model was used.",
  };
  const { frames, labels } = deterministicAcousticFrames(target.phonemes);
  return assessPronunciationFromFrames({
    input,
    frames,
    labels,
    runtime,
    enforcePolicy: false,
  });
}

function baseRuntimeStatus(): PronunciationRuntimeStatus {
  const modelPath = findModelPath();
  const bundle = loadAcousticBundle(modelPath);
  const executionProvider = defaultProvider();
  return {
    available: false,
    backend: "deterministic",
    executionProvider,
    modelFamily: bundle?.manifest.modelFamily ?? "hubert",
    modelId: bundle?.manifest.modelId ?? null,
    platform: process.platform,
    arch: process.arch,
    modelPath,
    modelPresent: modelManifestExists(modelPath),
    localOnly: true,
    reason: null,
  };
}

function defaultProvider(): PronunciationExecutionProvider {
  // macOS used to default to CoreML, but onnxruntime-node crashes natively
  // when compiling the bundled HuBERT model with `device: "coreml"`
  // ("Failed to create a working directory appropriate for URL: file:///tmp/").
  // CPU runs the same bundle cleanly, so we stay on CPU until we add an
  // isolated provider probe that can blacklist CoreML for the session.
  if (process.platform === "win32") return "directml";
  return "cpu";
}

export const _internal = {
  ctcViterbiAlign,
  scoreStress,
  buildPronunciationTarget,
  loadAcousticBundle,
  verifyHubertArchitecture: bundleInternal.verifyHubertArchitecture,
};

function buildTargetForText(text: string, ipa?: string | null) {
  const builder =
    text.trim().split(/\s+/).filter(Boolean).length > 1
      ? buildPhrasePronunciationTarget
      : buildPronunciationTarget;
  return builder(text, ipa, { lookup: cmudictLookup });
}
