import fs from "node:fs";
import path from "node:path";

interface PackagedTarget {
  label: string;
  appDir: string;
  executable: string;
  nativeHeader: "mach-o" | "pe";
}

const targets: PackagedTarget[] = [
  {
    label: "macOS x64",
    appDir: path.resolve("out", "Vocab App-darwin-x64", "Vocab App.app", "Contents"),
    executable: path.resolve(
      "out",
      "Vocab App-darwin-x64",
      "Vocab App.app",
      "Contents",
      "MacOS",
      "vocab-app",
    ),
    nativeHeader: "mach-o",
  },
  {
    label: "Windows x64",
    appDir: path.resolve("out", "Vocab App-win32-x64"),
    executable: path.resolve("out", "Vocab App-win32-x64", "vocab-app.exe"),
    nativeHeader: "pe",
  },
];

const requiredDrizzleFiles = [
  "0000_init.sql",
  "0001_colossal_makkari.sql",
  "0002_hard_trauma.sql",
  "0003_fair_hawkeye.sql",
  "0004_lexicon_v0_10_fsrs.sql",
  "0005_personal_dict_fsrs.sql",
  "0006_session_evidence_events.sql",
  path.join("meta", "_journal.json"),
];

function main(): void {
  const failures: string[] = [];

  for (const target of targets) {
    failures.push(...verifyTarget(target));
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`x ${failure}`);
    process.exit(1);
  }

  console.log("Packaged artifact verification passed.");
}

function verifyTarget(target: PackagedTarget): string[] {
  const failures: string[] = [];
  const resourcesDir =
    target.nativeHeader === "mach-o"
      ? path.join(target.appDir, "Resources")
      : path.join(target.appDir, "resources");
  const nativeModule = path.join(
    resourcesDir,
    "app.asar.unpacked",
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node",
  );

  requireFile(target.executable, `${target.label} executable`, failures);
  requireFile(path.join(resourcesDir, "app.asar"), `${target.label} app.asar`, failures);
  requireFile(nativeModule, `${target.label} better-sqlite3 native module`, failures);

  if (fs.existsSync(nativeModule) && !hasExpectedNativeHeader(nativeModule, target.nativeHeader)) {
    failures.push(`${target.label} better_sqlite3.node has the wrong native binary header`);
  }

  const unpackedDir = path.join(resourcesDir, "app.asar.unpacked");
  for (const nativeFile of findNativeModules(unpackedDir)) {
    if (!hasExpectedNativeHeader(nativeFile, target.nativeHeader)) {
      failures.push(`${target.label} native module has the wrong binary header: ${nativeFile}`);
    }
  }

  for (const file of requiredDrizzleFiles) {
    requireFile(
      path.join(resourcesDir, "drizzle", file),
      `${target.label} drizzle/${file}`,
      failures,
    );
  }

  return failures;
}

function findNativeModules(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) pending.push(path.join(current, entry));
      continue;
    }
    if (current.endsWith(".node")) out.push(current);
  }

  return out;
}

function requireFile(filePath: string, description: string, failures: string[]): void {
  if (!fs.existsSync(filePath)) {
    failures.push(`${description} missing at ${filePath}`);
    return;
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) failures.push(`${description} is not a file at ${filePath}`);
}

function hasExpectedNativeHeader(filePath: string, expected: "mach-o" | "pe"): boolean {
  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, header.length, 0);
    if (expected === "pe") return header[0] === 0x4d && header[1] === 0x5a;

    const signature = header.toString("hex");
    return signature === "feedfacf" || signature === "cffaedfe";
  } finally {
    fs.closeSync(fd);
  }
}

main();
