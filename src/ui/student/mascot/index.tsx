import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

// Asset registry --------------------------------------------------------------
//
// Vite resolves every `assets/mascot/<id>/<expression>.png` into a hashed URL
// at build time. The glob is the single seam that lets us add a 7th mascot or
// a new expression without touching component code.

const ASSET_URLS = import.meta.glob<string>("../../../../assets/mascot/*/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

export const MASCOT_IDS = ["1", "2", "3", "4", "5", "6"] as const;
export type MascotId = (typeof MASCOT_IDS)[number];

export const MASCOT_EXPRESSIONS = [
  "main",
  "adorable",
  "celebrating",
  "excited",
  "motivated",
  "afraik_to_look",
  "angry",
  "bruised",
  "crying_inward",
  "disapointed",
  "exhausted",
  "panicked",
  "sad",
] as const;
export type MascotExpression = (typeof MASCOT_EXPRESSIONS)[number];

export type MascotVariant = "idle" | "cheer" | "concern" | "focus";

export interface MascotDefinition {
  id: MascotId;
  name: string;
  tagline: string;
  main: string;
}

const MASCOT_NAMES: Record<MascotId, { name: string; tagline: string }> = {
  "1": { name: "Mango", tagline: "Sunny streak keeper" },
  "2": { name: "Sprout", tagline: "Calm and curious" },
  "3": { name: "Cloud", tagline: "Soft pep-talker" },
  "4": { name: "Drift", tagline: "Playful word surfer" },
  "5": { name: "Star", tagline: "Quiet daydreamer" },
  "6": { name: "Coral", tagline: "Bold review buddy" },
};

const ASSETS: Record<MascotId, Record<MascotExpression, string>> = buildAssetTable();

export const MASCOTS: readonly MascotDefinition[] = MASCOT_IDS.map((id) => ({
  id,
  name: MASCOT_NAMES[id].name,
  tagline: MASCOT_NAMES[id].tagline,
  main: ASSETS[id].main,
}));

export function mascotImage(id: MascotId, expression: MascotExpression): string {
  return ASSETS[id][expression];
}

export function isMascotId(value: string | null | undefined): value is MascotId {
  return typeof value === "string" && (MASCOT_IDS as readonly string[]).includes(value);
}

// Variant -> expression bucket. Heavy expressions (angry / bruised /
// panicked / afraik_to_look) are intentionally excluded from default
// rotation; callers wanting them must pass `expression` explicitly.
// `main` is reserved for the Settings profile picker, so no variant
// bucket includes it — that keeps the hero artwork from leaking into
// dashboards, sessions, and the pronunciation lab.

const POSITIVE_BUCKET: readonly MascotExpression[] = [
  "celebrating",
  "excited",
  "motivated",
  "adorable",
];
const CONCERN_BUCKET: readonly MascotExpression[] = [
  "sad",
  "disapointed",
  "exhausted",
  "crying_inward",
];
const FOCUS_BUCKET: readonly MascotExpression[] = ["motivated", "adorable"];
const IDLE_BUCKET: readonly MascotExpression[] = ["adorable", "motivated"];

function bucketFor(variant: MascotVariant): readonly MascotExpression[] {
  switch (variant) {
    case "cheer":
      return POSITIVE_BUCKET;
    case "concern":
      return CONCERN_BUCKET;
    case "focus":
      return FOCUS_BUCKET;
    default:
      return IDLE_BUCKET;
  }
}

// Default mascot when a student hasn't picked one ----------------------------

export function defaultMascotForSeed(seed: string | number | null | undefined): MascotId {
  const text = String(seed ?? "");
  let hash = 0;
  for (const ch of text) hash = (hash + ch.charCodeAt(0)) | 0;
  const index = ((hash % MASCOT_IDS.length) + MASCOT_IDS.length) % MASCOT_IDS.length;
  return MASCOT_IDS[index] ?? "1";
}

export function mascotSettingKey(studentId: number): string {
  return `student_profile:${studentId}:mascot`;
}

export function useStudentMascotId(studentId: number | null | undefined): MascotId {
  const enabled = typeof studentId === "number" && Number.isFinite(studentId) && studentId > 0;
  const { data } = useQuery({
    queryKey: queryKeys.studentPrefs.mascot(enabled ? studentId : 0),
    queryFn: () => api.settings.get<string>({ key: mascotSettingKey(studentId as number) }),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  if (isMascotId(data)) return data;
  return defaultMascotForSeed(studentId ?? null);
}

// Components -----------------------------------------------------------------

export interface MascotProps {
  studentId?: number | string | null;
  mascotId?: MascotId | null;
  variant?: MascotVariant;
  expression?: MascotExpression;
  className?: string;
  alt?: string;
}

export function Mascot({
  studentId,
  mascotId,
  variant = "idle",
  expression,
  className,
  alt,
}: MascotProps) {
  const numericStudentId =
    typeof studentId === "number" && Number.isFinite(studentId) ? studentId : null;
  const stored = useStudentMascotId(numericStudentId);
  const id = mascotId ?? stored;
  const bucket = bucketFor(variant);
  const [rotationIndex] = useState(() =>
    bucket.length > 0 ? Math.floor(Math.random() * bucket.length) : 0,
  );
  const chosen = expression ?? bucket[rotationIndex] ?? "adorable";
  return (
    <img
      src={mascotImage(id, chosen)}
      alt={alt ?? `${MASCOT_NAMES[id].name} mascot`}
      draggable={false}
      className={cn("object-contain drop-shadow-[0_12px_18px_rgb(15_23_42/0.18)]", className)}
    />
  );
}

// Small wrapper used by the picker and other "I know exactly which face I
// want" call sites. Doesn't subscribe to the per-student setting.
export function MascotStill({
  mascotId,
  expression = "main",
  className,
  alt,
}: {
  mascotId: MascotId;
  expression?: MascotExpression;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={mascotImage(mascotId, expression)}
      alt={alt ?? `${MASCOT_NAMES[mascotId].name} mascot`}
      draggable={false}
      className={cn("object-contain", className)}
    />
  );
}

// Internals ------------------------------------------------------------------

function buildAssetTable(): Record<MascotId, Record<MascotExpression, string>> {
  const table = {} as Record<MascotId, Record<MascotExpression, string>>;
  for (const id of MASCOT_IDS) {
    table[id] = {} as Record<MascotExpression, string>;
  }
  for (const [path, url] of Object.entries(ASSET_URLS)) {
    const match = path.match(/\/mascot\/([1-6])\/([a-z_]+)\.png$/i);
    if (!match) continue;
    const [, idRaw, expressionRaw] = match;
    if (!idRaw || !expressionRaw) continue;
    if (!isMascotId(idRaw)) continue;
    if (!(MASCOT_EXPRESSIONS as readonly string[]).includes(expressionRaw)) continue;
    table[idRaw][expressionRaw as MascotExpression] = url;
  }
  for (const id of MASCOT_IDS) {
    for (const expression of MASCOT_EXPRESSIONS) {
      if (!table[id][expression]) {
        throw new Error(`Missing mascot asset: ${id}/${expression}.png`);
      }
    }
  }
  return table;
}
