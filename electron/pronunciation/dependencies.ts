import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

let cachedResult: { platform: string; arch: string; available: boolean } | null = null;

export async function hasTransformersRuntime(
  platform: NodeJS.Platform | "test",
  arch: string,
): Promise<boolean> {
  if (cachedResult && cachedResult.platform === platform && cachedResult.arch === arch) {
    return cachedResult.available;
  }
  const available = await probeTransformersRuntime(platform, arch);
  cachedResult = { platform, arch, available };
  return available;
}

async function probeTransformersRuntime(
  platform: NodeJS.Platform | "test",
  arch: string,
): Promise<boolean> {
  if (!hasRuntimeDependency("@huggingface/transformers")) return false;
  if (!hasRuntimeDependency("onnxruntime-node")) return false;
  if (!hasRuntimeBinary("onnxruntime-node", platform, arch)) return false;
  try {
    await import("@huggingface/transformers");
    return true;
  } catch {
    return false;
  }
}

function hasRuntimeDependency(name: string): boolean {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

function hasRuntimeBinary(name: string, platform: NodeJS.Platform | "test", arch: string): boolean {
  if (platform === "test") return true;
  try {
    const packageRoot = path.dirname(require.resolve(path.join(name, "package.json")));
    const bindingPath = path.join(
      packageRoot,
      "bin",
      "napi-v6",
      platform,
      arch,
      "onnxruntime_binding.node",
    );
    return fs.existsSync(bindingPath);
  } catch {
    return false;
  }
}

export const _internal = {
  resetCache(): void {
    cachedResult = null;
  },
};
