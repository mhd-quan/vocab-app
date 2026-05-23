import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, "..");
const CRATE_DIR = path.join(REPO_ROOT, "crates", "viterbi");
const BUILD_TARGET = "wasm32-unknown-unknown";
const RELEASE_ARTIFACT = path.join(CRATE_DIR, "target", BUILD_TARGET, "release", "viterbi.wasm");
const OUTPUT_FILE = path.join(REPO_ROOT, "assets", "pronunciation", "viterbi.wasm");

function resolveCargo(): string {
  if (process.env.CARGO) return process.env.CARGO;
  const home = os.homedir();
  const homeCargo = path.join(home, ".cargo", "bin", "cargo");
  if (fs.existsSync(homeCargo)) return homeCargo;
  return "cargo";
}

async function main(): Promise<void> {
  const cargo = resolveCargo();
  console.log("[build:wasm]", cargo, "build --release --target", BUILD_TARGET);
  await execFileAsync(cargo, ["build", "--release", "--target", BUILD_TARGET], {
    cwd: CRATE_DIR,
    maxBuffer: 1024 * 1024 * 32,
  });

  if (!fs.existsSync(RELEASE_ARTIFACT)) {
    throw new Error(`Cargo build did not produce ${RELEASE_ARTIFACT}`);
  }
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.copyFileSync(RELEASE_ARTIFACT, OUTPUT_FILE);

  const size = fs.statSync(OUTPUT_FILE).size;
  console.log(`[build:wasm] wrote ${OUTPUT_FILE} (${(size / 1024).toFixed(1)} KB)`);

  if (process.env.WASM_OPT) {
    console.log(`[build:wasm] wasm-opt -Oz ${OUTPUT_FILE}`);
    await execFileAsync(process.env.WASM_OPT, ["-Oz", "-o", OUTPUT_FILE, OUTPUT_FILE]);
    const optSize = fs.statSync(OUTPUT_FILE).size;
    console.log(`[build:wasm] post-opt size ${(optSize / 1024).toFixed(1)} KB`);
  }
}

main().catch((error) => {
  console.error("[build:wasm] failed:", error.message ?? error);
  process.exitCode = 1;
});
