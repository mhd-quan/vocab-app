import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

export const ASSET_DIR = "capt-models";
export const MANIFEST_FILE = "manifest.json";

let cachedModelPath: string | null | undefined;
let cachedSearchPaths: string[] | null = null;

export function findModelPath(): string | null {
  if (cachedModelPath !== undefined) return cachedModelPath;
  for (const candidate of modelSearchPaths()) {
    if (fs.existsSync(candidate)) {
      cachedModelPath = candidate;
      return candidate;
    }
  }
  cachedModelPath = modelSearchPaths()[0] ?? null;
  return cachedModelPath;
}

export function modelManifestFile(modelPath: string): string {
  return path.join(modelPath, MANIFEST_FILE);
}

export function modelSearchPaths(): string[] {
  if (cachedSearchPaths) return cachedSearchPaths;
  const roots = [
    process.resourcesPath ? path.join(process.resourcesPath, ASSET_DIR) : null,
    safeUserDataPath(),
    path.join(process.cwd(), "assets", ASSET_DIR),
  ];
  cachedSearchPaths = roots.filter((item): item is string => Boolean(item));
  return cachedSearchPaths;
}

function safeUserDataPath(): string | null {
  try {
    return path.join(app.getPath("userData"), ASSET_DIR);
  } catch {
    return path.join(os.tmpdir(), "vocab-app", ASSET_DIR);
  }
}

export const _internal = {
  resetCache(): void {
    cachedModelPath = undefined;
    cachedSearchPaths = null;
  },
};
