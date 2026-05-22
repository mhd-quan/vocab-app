import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { version } from "../package.json";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "out");
const WIN_APP_PACKAGE = path.join(OUT, "Vocab App-win32-x64");
const RELEASE_DIR = path.join(OUT, "release", `v${version}`);
const WIN_APP_STAGING = path.join(RELEASE_DIR, "windows-installer");
const WIN_DICT_STAGING = path.join(RELEASE_DIR, "dictionary-installer");
const MAC_DICT_STAGING = path.join(RELEASE_DIR, "macos-dictionary-installer");
const MAC_DICT_DMG = path.join(
  RELEASE_DIR,
  `Vocab-App-v${version}-dict-installer-oald10-macOS.dmg`,
);

function main(): void {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  buildWindowsAppInstaller();
  buildWindowsDictionaryInstaller();
  buildMacDictionaryInstaller();
}

function buildWindowsAppInstaller(): void {
  requireDir(WIN_APP_PACKAGE, "Windows app package");
  fs.rmSync(WIN_APP_STAGING, { recursive: true, force: true });
  fs.mkdirSync(WIN_APP_STAGING, { recursive: true });
  fs.cpSync(WIN_APP_PACKAGE, path.join(WIN_APP_STAGING, "Vocab App-win32-x64"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(WIN_APP_STAGING, "Install-Vocab-App.cmd"), winAppCmd(), "utf8");
  fs.writeFileSync(path.join(WIN_APP_STAGING, "Install-Vocab-App.ps1"), winAppPs1(), "utf8");
  fs.writeFileSync(path.join(WIN_APP_STAGING, "README.txt"), winAppReadme(), "utf8");
}

function buildWindowsDictionaryInstaller(): void {
  const dictPath = path.join(ROOT, "dict");
  requireDir(dictPath, "Dictionary pack");
  fs.rmSync(WIN_DICT_STAGING, { recursive: true, force: true });
  fs.mkdirSync(path.join(WIN_DICT_STAGING, "dictionary"), { recursive: true });
  copyDictPayload(dictPath, path.join(WIN_DICT_STAGING, "dictionary"));
  fs.writeFileSync(
    path.join(WIN_DICT_STAGING, "Install-Vocab-Dictionary.cmd"),
    winDictCmd(),
    "utf8",
  );
  fs.writeFileSync(
    path.join(WIN_DICT_STAGING, "Install-Vocab-Dictionary.ps1"),
    winDictPs1(),
    "utf8",
  );
  fs.writeFileSync(path.join(WIN_DICT_STAGING, "README.txt"), winDictReadme(), "utf8");
}

function buildMacDictionaryInstaller(): void {
  const dictPath = path.join(ROOT, "dict");
  requireDir(dictPath, "Dictionary pack");
  fs.rmSync(MAC_DICT_STAGING, { recursive: true, force: true });
  fs.mkdirSync(path.join(MAC_DICT_STAGING, "dictionary"), { recursive: true });
  copyDictPayload(dictPath, path.join(MAC_DICT_STAGING, "dictionary"));

  const scriptPath = path.join(MAC_DICT_STAGING, "Install-Vocab-Dictionary.command");
  fs.writeFileSync(scriptPath, macDictCommand(), "utf8");
  fs.chmodSync(scriptPath, 0o755);

  fs.writeFileSync(path.join(MAC_DICT_STAGING, "README.txt"), macDictReadme(), "utf8");

  // hdiutil is macOS-only. Skip on Linux/Windows so the rest of the release
  // pipeline still runs; the staging folder alone is usable as a zip source.
  if (os.platform() !== "darwin") {
    console.warn("[build-installers] hdiutil not available; skipping macOS dict DMG");
    return;
  }

  fs.rmSync(MAC_DICT_DMG, { force: true });
  execFileSync(
    "hdiutil",
    [
      "create",
      "-volname",
      `Vocab App Dictionary v${version}`,
      "-srcfolder",
      MAC_DICT_STAGING,
      "-format",
      "UDZO",
      "-fs",
      "HFS+",
      "-ov",
      MAC_DICT_DMG,
    ],
    { stdio: "inherit" },
  );
}

function copyDictPayload(source: string, destination: string): void {
  for (const entry of fs.readdirSync(source)) {
    if (entry === ".DS_Store") continue;
    fs.cpSync(path.join(source, entry), path.join(destination, entry), { recursive: true });
  }
}

function requireDir(dir: string, label: string): void {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`${label} missing at ${dir}`);
  }
}

function winAppCmd(): string {
  return `@echo off\r\nsetlocal\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Vocab-App.ps1"\r\nif errorlevel 1 exit /b %errorlevel%\r\n`;
}

function winDictCmd(): string {
  return `@echo off\r\nsetlocal\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Vocab-Dictionary.ps1"\r\nif errorlevel 1 exit /b %errorlevel%\r\n`;
}

function winAppPs1(): string {
  return String.raw`$ErrorActionPreference = "Stop"
$Source = Join-Path $PSScriptRoot "Vocab App-win32-x64"
$InstallRoot = Join-Path $env:LOCALAPPDATA "Programs\Vocab App"
$Exe = Join-Path $InstallRoot "vocab-app.exe"

if (!(Test-Path $Source)) {
  throw "Missing app payload: $Source"
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $InstallRoot -Recurse -Force
}

$Meta = @{
  name = "Vocab App"
  version = "${version}"
  installedAt = (Get-Date).ToString("o")
  dataPath = (Join-Path $env:APPDATA "vocab-app")
} | ConvertTo-Json -Depth 3
$Meta | Set-Content -LiteralPath (Join-Path $InstallRoot "install.json") -Encoding UTF8

$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Vocab App.lnk"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Exe
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.IconLocation = "$Exe,0"
$Shortcut.Save()

Write-Host "Vocab App ${version} installed to $InstallRoot"
Write-Host "Student data stays in %APPDATA%\vocab-app and is not touched by this installer."
`;
}

function winDictPs1(): string {
  return String.raw`$ErrorActionPreference = "Stop"
$AppInstall = Join-Path $env:LOCALAPPDATA "Programs\Vocab App\install.json"
$AppExe = Join-Path $env:LOCALAPPDATA "Programs\Vocab App\vocab-app.exe"
if (!(Test-Path $AppInstall) -or !(Test-Path $AppExe)) {
  throw "Install Vocab App before installing the dictionary pack."
}

$Source = Join-Path $PSScriptRoot "dictionary"
$Target = Join-Path $env:APPDATA "vocab-app\dictionary"
if (!(Test-Path $Source)) {
  throw "Missing dictionary payload: $Source"
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $Target -Recurse -Force
}

$Meta = @{
  name = "Vocab App Dictionary Pack"
  version = "${version}"
  installedAt = (Get-Date).ToString("o")
  appInstall = $AppInstall
} | ConvertTo-Json -Depth 3
$Meta | Set-Content -LiteralPath (Join-Path $Target "install.json") -Encoding UTF8

Write-Host "Dictionary pack installed to $Target"
Write-Host "The app package and student database were not modified."
`;
}

function macDictCommand(): string {
  // Mirror of the Windows .ps1 flow: copy dictionary/ from this installer's
  // own folder into the per-user application support path used by the macOS
  // app bundle (electron app.getPath('userData') resolves there).
  return `#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/dictionary"
TARGET="$HOME/Library/Application Support/vocab-app/dictionary"
APP_INSTALL_META="$HOME/Library/Application Support/vocab-app"

if [ ! -d "$SOURCE" ]; then
  echo "Missing dictionary payload: $SOURCE" >&2
  exit 1
fi

if [ ! -d "$APP_INSTALL_META" ]; then
  echo "Install Vocab App before installing the dictionary pack." >&2
  echo "(Expected \\"$APP_INSTALL_META\\" to exist after launching the app at least once.)" >&2
  exit 1
fi

mkdir -p "$TARGET"
echo "Copying dictionary assets to $TARGET ..."
cp -R "$SOURCE/"* "$TARGET/"

cat > "$TARGET/install.json" <<JSON
{
  "name": "Vocab App Dictionary Pack",
  "version": "${version}",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "$SCRIPT_DIR"
}
JSON

echo ""
echo "Dictionary pack installed to $TARGET"
echo "Open Vocab App → Settings → Dictionary pack → Select pack and pick"
echo "the same folder if the app does not pick it up automatically."
`;
}

function winAppReadme(): string {
  return `Vocab App ${version} Windows installer

Run Install-Vocab-App.cmd.

The installer copies the app to %LOCALAPPDATA%\\Programs\\Vocab App and creates a Desktop shortcut. Student data lives in %APPDATA%\\vocab-app, so installing a newer app version over this folder does not erase learning data.
`;
}

function winDictReadme(): string {
  return `Vocab App ${version} dictionary installer (Windows)

Install the main app first, then run Install-Vocab-Dictionary.cmd.

The dictionary pack is copied to %APPDATA%\\vocab-app\\dictionary. It is separate from the app install folder and from vocab.db, so app upgrades do not remove it.
`;
}

function macDictReadme(): string {
  return `Vocab App ${version} dictionary installer (macOS)

1. Install or launch Vocab App at least once so that
   ~/Library/Application Support/vocab-app/ exists.
2. Double-click Install-Vocab-Dictionary.command.
   If macOS Gatekeeper refuses to open the script, right-click → Open and
   confirm in the dialog. The script is plain Bash and copies the dictionary
   folder; nothing privileged or networked.
3. The dictionary pack lands in
   ~/Library/Application Support/vocab-app/dictionary/.
   Student progress in vocab.db is untouched.
`;
}

main();
