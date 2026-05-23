import fs from "node:fs";
import path from "node:path";
import {
  type PronunciationLabelCoverage,
  type PronunciationModelManifest,
  isPronunciationModelManifest,
  normalizeAcousticLabel,
  normalizeLabelMap,
  pronunciationLabelCoverage,
} from "../../src/modules/pronunciation";
import { MANIFEST_FILE } from "./paths";

export interface AcousticBundle {
  modelPath: string;
  manifest: PronunciationModelManifest;
  labels: Record<string, string>;
  coverage: PronunciationLabelCoverage;
  architecture: { ok: boolean; reason?: string };
}

const bundleCache = new Map<string, AcousticBundle | null>();

/**
 * Load and verify an acoustic bundle once per `modelPath`. All file reads
 * (manifest, vocab.json, config.json) and label-coverage / architecture
 * checks are performed on first call; subsequent calls return the cached
 * result. Returns `null` when the bundle is missing or malformed in a way
 * that prevents loading (e.g. no manifest file). Use `coverage.ok` and
 * `architecture.ok` to detect partial-failure cases.
 */
export function loadAcousticBundle(modelPath: string | null): AcousticBundle | null {
  if (!modelPath) return null;
  if (bundleCache.has(modelPath)) return bundleCache.get(modelPath) ?? null;

  const manifest = readManifest(modelPath);
  if (!manifest) {
    bundleCache.set(modelPath, null);
    return null;
  }
  const labels = readLabelMap(modelPath, manifest);
  const coverage = pronunciationLabelCoverage(labels);
  const architecture = verifyHubertArchitecture(modelPath, manifest.modelId);

  const bundle: AcousticBundle = { modelPath, manifest, labels, coverage, architecture };
  bundleCache.set(modelPath, bundle);
  return bundle;
}

export function modelManifestExists(modelPath: string | null): boolean {
  if (!modelPath) return false;
  return fs.existsSync(path.join(modelPath, MANIFEST_FILE));
}

export function formatMissingLabels(labels: string[]): string {
  if (labels.length <= 10) return labels.join(", ");
  return `${labels.slice(0, 10).join(", ")} and ${labels.length - 10} more`;
}

function readManifest(modelPath: string): PronunciationModelManifest | null {
  const file = path.join(modelPath, MANIFEST_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return isPronunciationModelManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readLabelMap(
  modelPath: string,
  manifest: PronunciationModelManifest,
): Record<string, string> {
  const labels = normalizeLabelMap(manifest.labels);
  if (Object.keys(labels).length > 0) return labels;
  return labelsFromVocab(modelPath, manifest.modelId);
}

function labelsFromVocab(modelPath: string, modelId: string): Record<string, string> {
  const file = path.join(modelPath, ...modelId.split("/"), "vocab.json");
  if (!fs.existsSync(file)) return {};
  try {
    const vocab = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [label, index] of Object.entries(vocab)) {
      if (typeof index !== "number") continue;
      const normalized = normalizeAcousticLabel(label);
      if (normalized) out[String(index)] = normalized;
    }
    return out;
  } catch {
    return {};
  }
}

function verifyHubertArchitecture(
  modelPath: string | null,
  modelId: string | undefined,
): { ok: boolean; reason?: string } {
  if (!modelPath || !modelId) return { ok: true };
  const configFile = path.join(modelPath, ...modelId.split("/"), "config.json");
  if (!fs.existsSync(configFile)) return { ok: true };

  try {
    const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as { model_type?: unknown };
    const modelType = typeof config.model_type === "string" ? config.model_type : null;
    if (modelType === "hubert") return { ok: true };
    if (!modelType) {
      return {
        ok: false,
        reason: `CAPT bundle ${modelId}/config.json is missing model_type. HuBERT is required.`,
      };
    }
    return {
      ok: false,
      reason: `CAPT bundle ${modelId} declares model_type='${modelType}'. HuBERT is required.`,
    };
  } catch {
    return {
      ok: false,
      reason: `CAPT bundle ${modelId}/config.json could not be parsed.`,
    };
  }
}

export const _internal = {
  resetCache(): void {
    bundleCache.clear();
  },
  verifyHubertArchitecture,
};
