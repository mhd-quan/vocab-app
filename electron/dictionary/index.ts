import path from "node:path";
import { app } from "electron";
import type {
  DictionaryAudioAsset,
  DictionaryEntry,
  DictionarySearchResult,
  DictionaryStatus,
} from "../../src/data/dictionary";
import { DictionaryPack, inspectDictionaryPack } from "./mdict";

export const DICTIONARY_PACK_PATH_KEY = "dictionary_pack_path";

let cachedPackPath: string | null = null;
let cachedPack: DictionaryPack | null = null;

export function resetDictionaryCache(): void {
  cachedPackPath = null;
  cachedPack = null;
}

export function dictionaryStatus(configuredPath?: string | null): DictionaryStatus {
  const manifest = resolveDictionaryManifest(configuredPath);
  if (!manifest) {
    return {
      active: false,
      packPath: null,
      entryCount: 0,
      sourceFile: null,
      files: [],
      message: "No dictionary pack is installed.",
    };
  }

  return getDictionaryPack(configuredPath).status();
}

export function dictionarySearch(
  query: string,
  limit: number,
  configuredPath?: string | null,
): DictionarySearchResult[] {
  const pack = tryGetDictionaryPack(configuredPath);
  return pack ? pack.search(query, limit) : [];
}

export function dictionaryLookup(
  term: string,
  configuredPath?: string | null,
): DictionaryEntry | null {
  const pack = tryGetDictionaryPack(configuredPath);
  return pack ? pack.lookup(term) : null;
}

export function dictionaryAudio(
  ref: string,
  configuredPath?: string | null,
): DictionaryAudioAsset | null {
  const pack = tryGetDictionaryPack(configuredPath);
  return pack ? pack.audio(ref) : null;
}

export function validateDictionaryPackPath(packPath: string): void {
  if (!inspectDictionaryPack(packPath)) {
    throw new Error("Selected folder does not contain a supported OALD10 dictionary pack.");
  }
}

function tryGetDictionaryPack(configuredPath?: string | null): DictionaryPack | null {
  const manifest = resolveDictionaryManifest(configuredPath);
  return manifest ? getDictionaryPack(configuredPath) : null;
}

function getDictionaryPack(configuredPath?: string | null): DictionaryPack {
  const manifest = resolveDictionaryManifest(configuredPath);
  if (!manifest) throw new Error("No dictionary pack is installed.");
  if (cachedPack && cachedPackPath === manifest.packPath) return cachedPack;
  cachedPack = new DictionaryPack(manifest);
  cachedPackPath = manifest.packPath;
  return cachedPack;
}

function resolveDictionaryManifest(configuredPath?: string | null) {
  const candidates = dictionaryPackCandidates(configuredPath);
  for (const candidate of candidates) {
    const manifest = inspectDictionaryPack(candidate);
    if (manifest) return manifest;
  }
  return null;
}

function dictionaryPackCandidates(configuredPath?: string | null): string[] {
  const out: string[] = [];
  if (configuredPath) out.push(configuredPath);

  // User-selected external pack location for packaged builds.
  out.push(path.join(app.getPath("userData"), "dictionary"));

  // Development convenience: the repo-local folder is ignored by git and not
  // bundled into releases.
  out.push(path.join(process.cwd(), "dict"));
  out.push(path.join(app.getAppPath(), "dict"));

  return Array.from(new Set(out.map((item) => path.resolve(item))));
}
