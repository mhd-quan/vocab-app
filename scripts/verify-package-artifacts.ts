import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { version } from "../package.json";

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
  "0007_pronunciation_evidence.sql",
  path.join("meta", "_journal.json"),
];

const captModelManifest = path.join("capt-models", "manifest.json");
const cmudictFile = path.join("cmudict", "cmudict-0.7b.txt");

function main(): void {
  const failures: string[] = [];

  requireFile(path.resolve("assets", "icons", "app.icns"), "source macOS app icon", failures);
  requireFile(path.resolve("assets", "icons", "app.ico"), "source Windows app icon", failures);

  for (const target of targets) {
    failures.push(...verifyTarget(target));
  }
  failures.push(...verifyWindowsInstallers());
  failures.push(...verifyMacInstallers());

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
  if (target.nativeHeader === "mach-o") {
    verifyMacIcon(target, resourcesDir, failures);
  }

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

  requireFile(
    path.join(resourcesDir, captModelManifest),
    `${target.label} ${captModelManifest}`,
    failures,
  );

  requireFile(path.join(resourcesDir, cmudictFile), `${target.label} ${cmudictFile}`, failures);

  return failures;
}

function verifyMacIcon(target: PackagedTarget, resourcesDir: string, failures: string[]): void {
  const infoPlist = path.join(target.appDir, "Info.plist");
  requireFile(infoPlist, `${target.label} Info.plist app icon`, failures);
  if (!fs.existsSync(infoPlist)) return;

  const text = fs.readFileSync(infoPlist, "utf8");
  const iconName = plistStringValue(text, "CFBundleIconFile");
  if (!iconName) {
    failures.push(`${target.label} Info.plist is missing CFBundleIconFile`);
    return;
  }

  const bundledIcon = path.join(resourcesDir, iconName);
  requireFile(bundledIcon, `${target.label} bundled app icon`, failures);
  if (!fs.existsSync(bundledIcon)) return;

  const sourceIcon = path.resolve("assets", "icons", "app.icns");
  if (fs.existsSync(sourceIcon) && hashFile(sourceIcon) !== hashFile(bundledIcon)) {
    failures.push(`${target.label} bundled app icon does not match assets/icons/app.icns`);
  }
}

function verifyWindowsInstallers(): string[] {
  const failures: string[] = [];
  const releaseDir = path.resolve("out", "release", `v${version}`);
  const appInstaller = path.join(releaseDir, "windows-installer");
  const dictInstaller = path.join(releaseDir, "dictionary-installer");

  requireFile(
    path.join(appInstaller, "Install-Vocab-App.cmd"),
    "Windows app installer command",
    failures,
  );
  requireFile(
    path.join(appInstaller, "Install-Vocab-App.ps1"),
    "Windows app installer PowerShell",
    failures,
  );
  requireFile(
    path.join(appInstaller, "Vocab App-win32-x64", "vocab-app.exe"),
    "Windows app installer executable payload",
    failures,
  );
  requireFile(
    path.join(appInstaller, "Vocab App-win32-x64", "resources", "app.asar"),
    "Windows app installer app.asar payload",
    failures,
  );
  requireFile(
    path.join(dictInstaller, "Install-Vocab-Dictionary.cmd"),
    "Windows dictionary installer command",
    failures,
  );
  requireFile(
    path.join(dictInstaller, "Install-Vocab-Dictionary.ps1"),
    "Windows dictionary installer PowerShell",
    failures,
  );
  requireDir(path.join(dictInstaller, "dictionary"), "Windows dictionary payload", failures);

  return failures;
}

function verifyMacInstallers(): string[] {
  const failures: string[] = [];
  const releaseDir = path.resolve("out", "release", `v${version}`);
  const macDictStaging = path.join(releaseDir, "macos-dictionary-installer");
  const macDictDmg = path.join(releaseDir, `Vocab-App-v${version}-dict-installer-oald10-macOS.dmg`);

  requireFile(
    path.join(macDictStaging, "Install-Vocab-Dictionary.command"),
    "macOS dictionary installer command",
    failures,
  );
  requireDir(path.join(macDictStaging, "dictionary"), "macOS dictionary payload", failures);
  requireFile(macDictDmg, "macOS dictionary installer DMG", failures);

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
    if (current.endsWith(".node") && isTargetNativeModule(current)) out.push(current);
  }

  return out;
}

function isTargetNativeModule(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  const napiIndex = parts.lastIndexOf("napi-v6");
  if (napiIndex < 0) return true;
  const platform = parts[napiIndex + 1];
  const arch = parts[napiIndex + 2];
  if (!platform || !arch) return true;
  const target = filePath.includes(`${path.sep}Vocab App-win32-x64${path.sep}`)
    ? { platform: "win32", arch: "x64" }
    : { platform: "darwin", arch: "x64" };
  return platform === target.platform && arch === target.arch;
}

function requireFile(filePath: string, description: string, failures: string[]): void {
  if (!fs.existsSync(filePath)) {
    failures.push(`${description} missing at ${filePath}`);
    return;
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) failures.push(`${description} is not a file at ${filePath}`);
}

function requireDir(dirPath: string, description: string, failures: string[]): void {
  if (!fs.existsSync(dirPath)) {
    failures.push(`${description} missing at ${dirPath}`);
    return;
  }
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) failures.push(`${description} is not a directory at ${dirPath}`);
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

function plistStringValue(text: string, key: string): string | null {
  const pattern = new RegExp(`<key>${escapeRegExp(key)}</key>\\s*<string>([^<]+)</string>`);
  return text.match(pattern)?.[1] ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hashFile(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

main();
