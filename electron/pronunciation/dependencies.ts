import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

let cachedResult: { platform: string; arch: string; available: boolean } | null = null;
let cachedDiagnostics: {
  platform: string;
  arch: string;
  available: boolean;
  reason: string | null;
} | null = null;

export interface TransformersRuntimeDiagnostics {
  available: boolean;
  reason: string | null;
}

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

export async function transformersRuntimeDiagnostics(
  platform: NodeJS.Platform | "test",
  arch: string,
): Promise<TransformersRuntimeDiagnostics> {
  if (
    cachedDiagnostics &&
    cachedDiagnostics.platform === platform &&
    cachedDiagnostics.arch === arch
  ) {
    return {
      available: cachedDiagnostics.available,
      reason: cachedDiagnostics.reason,
    };
  }

  const diagnostics = await probeTransformersRuntimeDiagnostics(platform, arch);
  cachedDiagnostics = { platform, arch, ...diagnostics };
  cachedResult = { platform, arch, available: diagnostics.available };
  return diagnostics;
}

async function probeTransformersRuntime(
  platform: NodeJS.Platform | "test",
  arch: string,
): Promise<boolean> {
  return (await probeTransformersRuntimeDiagnostics(platform, arch)).available;
}

async function probeTransformersRuntimeDiagnostics(
  platform: NodeJS.Platform | "test",
  arch: string,
): Promise<TransformersRuntimeDiagnostics> {
  if (!hasRuntimeDependency("@huggingface/transformers")) {
    return {
      available: false,
      reason: "CAPT runtime dependency @huggingface/transformers is not installed.",
    };
  }
  if (!hasRuntimeDependency("onnxruntime-node")) {
    return {
      available: false,
      reason: "CAPT runtime dependency onnxruntime-node is not installed.",
    };
  }
  if (!hasRuntimeBinary("onnxruntime-node", platform, arch)) {
    return {
      available: false,
      reason: `CAPT native ONNX Runtime binary is missing for ${platform}/${arch}.`,
    };
  }
  if (platform === "win32" && platform === process.platform && arch === process.arch) {
    const nativeProbe = probeNativeOnnxRuntimeLoad();
    if (!nativeProbe.available) return nativeProbe;
  }
  return { available: true, reason: null };
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

function probeNativeOnnxRuntimeLoad(): TransformersRuntimeDiagnostics {
  try {
    const ort = require("onnxruntime-node") as { listSupportedBackends?: () => unknown };
    ort.listSupportedBackends?.();
    return { available: true, reason: null };
  } catch (error) {
    return {
      available: false,
      reason: describeNativeOnnxRuntimeLoadError(error),
    };
  }
}

export function describeNativeOnnxRuntimeLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (isWindowsNativeLoaderFailure(message)) {
    return [
      "Windows could not load the local ONNX Runtime native binding for pronunciation scoring.",
      "Install or repair Microsoft Visual C++ 2015-2022 Redistributable (x64), then reopen Vocab App.",
      `Native loader error: ${message}`,
    ].join(" ");
  }
  return message || "CAPT native ONNX Runtime could not be loaded.";
}

function isWindowsNativeLoaderFailure(message: string): boolean {
  return (
    message.includes("onnxruntime_binding.node") ||
    message.includes("dynamic link library") ||
    message.includes("DLL") ||
    message.includes("MSVCP140") ||
    message.includes("VCRUNTIME140")
  );
}

export const _internal = {
  resetCache(): void {
    cachedResult = null;
    cachedDiagnostics = null;
  },
  describeNativeOnnxRuntimeLoadError,
};
