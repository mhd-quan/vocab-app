import fs from "node:fs";
import path from "node:path";

const ASSET_DIR = "cmudict";
const DICT_FILE = "cmudict-0.7b.txt";

let cachedIndex: Map<string, string> | null = null;
let cachedPath: string | null = null;

export function cmudictLookup(word: string): string | null {
  const normalized = normalize(word);
  if (!normalized) return null;
  const index = loadIndex();
  return index?.get(normalized) ?? null;
}

export function cmudictPath(): string | null {
  if (cachedPath) return cachedPath;
  for (const candidate of searchPaths()) {
    if (fs.existsSync(candidate)) {
      cachedPath = candidate;
      return candidate;
    }
  }
  return null;
}

function loadIndex(): Map<string, string> | null {
  if (cachedIndex) return cachedIndex;
  const file = cmudictPath();
  if (!file) return null;

  const text = fs.readFileSync(file, "utf8");
  const map = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";;;")) continue;

    const spaceAt = line.indexOf(" ");
    if (spaceAt <= 0) continue;
    const head = line.slice(0, spaceAt);
    const commentAt = line.indexOf("#", spaceAt + 1);
    const tail = commentAt >= 0 ? line.slice(spaceAt + 1, commentAt) : line.slice(spaceAt + 1);
    const phonemes = tail.trim();
    if (!phonemes) continue;

    const key = stripVariantSuffix(head).toLowerCase();
    if (!key || map.has(key)) continue;
    map.set(key, phonemes);
  }

  cachedIndex = map;
  return map;
}

function searchPaths(): string[] {
  const roots: Array<string | null> = [
    process.resourcesPath ? path.join(process.resourcesPath, ASSET_DIR, DICT_FILE) : null,
    path.join(process.cwd(), "assets", ASSET_DIR, DICT_FILE),
  ];
  return roots.filter((item): item is string => Boolean(item));
}

function stripVariantSuffix(word: string): string {
  return word.replace(/\(\d+\)$/, "");
}

function normalize(word: string): string {
  return word.trim().toLowerCase();
}

export const _internal = {
  resetCache(): void {
    cachedIndex = null;
    cachedPath = null;
  },
  loadIndex,
};
