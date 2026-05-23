#!/usr/bin/env tsx
/**
 * Patch the dev Electron binary's Info.plist files on macOS so the
 * AVCapture Continuity Camera deprecation warning is silenced. The
 * warning fires from individual helper bundles ("Electron Helper (Plugin)"
 * is where our utilityProcess + onnxruntime-node lives), so we patch the
 * top-level plist AND every helper plist. Production builds receive the
 * same keys via `forge.config.ts` (extendInfo + extendHelperInfo). No-op
 * on non-darwin.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") process.exit(0);

const root = path.resolve(__dirname, "..");
const electronRoot = path.join(root, "node_modules", "electron", "dist", "Electron.app");

const HELPER_BUNDLES = [
  "Electron Helper.app",
  "Electron Helper (GPU).app",
  "Electron Helper (Plugin).app",
  "Electron Helper (Renderer).app",
];

const mainPlist = path.join(electronRoot, "Contents", "Info.plist");

if (!existsSync(mainPlist)) {
  console.warn(
    `[postinstall] Electron Info.plist not found at ${mainPlist}; skipping plist patch.`,
  );
  process.exit(0);
}

function set(plist: string, key: string, kind: "bool" | "string", value: string): void {
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

set(mainPlist, "NSCameraUseContinuityCameraDeviceType", "bool", "true");
set(
  mainPlist,
  "NSMicrophoneUsageDescription",
  "string",
  "Vocab App uses your microphone to score pronunciation locally.",
);
set(
  mainPlist,
  "NSCameraUsageDescription",
  "string",
  "Vocab App can take visible, consented camera check-ins during student study sessions.",
);

let helpersPatched = 0;
for (const bundle of HELPER_BUNDLES) {
  const helperPlist = path.join(
    electronRoot,
    "Contents",
    "Frameworks",
    bundle,
    "Contents",
    "Info.plist",
  );
  if (!existsSync(helperPlist)) continue;
  set(helperPlist, "NSCameraUseContinuityCameraDeviceType", "bool", "true");
  // The Renderer helper is where navigator.mediaDevices.getUserMedia()
  // actually runs in Electron, so it needs its own usage description —
  // without it macOS silently aborts the prompt and the renderer sees
  // an opaque "The user aborted a request." AbortError. Patching every
  // helper keeps us safe if Electron shuffles capture into another
  // helper bundle in a future release.
  set(
    helperPlist,
    "NSMicrophoneUsageDescription",
    "string",
    "Vocab App uses your microphone to score pronunciation locally.",
  );
  helpersPatched += 1;
}

console.log(
  `[postinstall] Patched dev Electron Info.plist (main + ${helpersPatched} helper${helpersPatched === 1 ? "" : "s"}) with Continuity Camera opt-in.`,
);
