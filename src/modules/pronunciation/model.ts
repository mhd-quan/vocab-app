import { normalizeAcousticLabel } from "./labels";

export const PRONUNCIATION_MODEL_FAMILY = "hubert" as const;

export type PronunciationModelFamily = typeof PRONUNCIATION_MODEL_FAMILY;

export interface PronunciationModelManifest {
  schemaVersion?: string;
  modelFamily: PronunciationModelFamily;
  modelId: string;
  dtype?: string;
  sampleRate?: number;
  frameMs?: number;
  labels?: Record<string, string>;
  labelFormat?: "arpabet" | "ipa" | "mixed";
  note?: string;
}

export const REQUIRED_PRONUNCIATION_LABELS = [
  "AA",
  "AE",
  "AH",
  "AO",
  "AW",
  "AY",
  "B",
  "CH",
  "D",
  "DH",
  "EH",
  "ER",
  "EY",
  "F",
  "G",
  "HH",
  "IH",
  "IY",
  "JH",
  "K",
  "L",
  "M",
  "N",
  "NG",
  "OW",
  "OY",
  "P",
  "R",
  "S",
  "SH",
  "T",
  "TH",
  "UH",
  "UW",
  "V",
  "W",
  "Y",
  "Z",
  "ZH",
] as const;

export interface PronunciationLabelCoverage {
  ok: boolean;
  missing: string[];
}

export function isPronunciationModelManifest(value: unknown): value is PronunciationModelManifest {
  if (!isRecord(value)) return false;
  return (
    value.modelFamily === PRONUNCIATION_MODEL_FAMILY &&
    typeof value.modelId === "string" &&
    value.modelId.trim().length > 0
  );
}

export function normalizeLabelMap(
  labels: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [index, label] of Object.entries(labels ?? {})) {
    const normalized = normalizeAcousticLabel(label);
    if (normalized) out[index] = normalized;
  }
  return out;
}

export function pronunciationLabelCoverage(
  labels: Record<string, string>,
): PronunciationLabelCoverage {
  const available = new Set(Object.values(labels));
  const missing = REQUIRED_PRONUNCIATION_LABELS.filter((label) => !available.has(label));
  return { ok: missing.length === 0, missing };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
