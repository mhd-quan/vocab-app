#!/usr/bin/env tsx
/**
 * Patch the dev Electron binary's Info.plist on macOS so the AVCapture
 * Continuity Camera deprecation warning is silenced. Production builds
 * already declare this via `forge.config.ts` extendInfo, but dev mode
 * launches the unmodified Electron binary from node_modules, so we have
 * to patch its Info.plist directly. No-op on non-darwin.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") process.exit(0);

const root = path.resolve(__dirname, "..");
const plist = path.join(
  root,
  "node_modules",
  "electron",
  "dist",
  "Electron.app",
  "Contents",
  "Info.plist",
);

if (!existsSync(plist)) {
  console.warn(`[postinstall] Electron Info.plist not found at ${plist}; skipping plist patch.`);
  process.exit(0);
}

function set(key: string, kind: "bool" | "string", value: string): void {
  const exists = run(["-c", `Print :${key}`, plist], true);
  if (exists.ok) {
    run(["-c", `Set :${key} ${value}`, plist]);
  } else {
    run(["-c", `Add :${key} ${kind} ${value}`, plist]);
  }
}

function run(args: string[], capture = false): { ok: boolean; output: string } {
  try {
    const out = execFileSync("/usr/libexec/PlistBuddy", args, {
      stdio: capture ? ["ignore", "pipe", "ignore"] : "inherit",
      encoding: "utf8",
    });
    return { ok: true, output: typeof out === "string" ? out : "" };
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}

set("NSCameraUseContinuityCameraDeviceType", "bool", "true");
set(
  "NSMicrophoneUsageDescription",
  "string",
  "Vocab App uses your microphone to score pronunciation locally.",
);
set(
  "NSCameraUsageDescription",
  "string",
  "Vocab App can take visible, consented camera check-ins during student study sessions.",
);

console.log("[postinstall] Patched dev Electron Info.plist with Continuity Camera opt-in.");
