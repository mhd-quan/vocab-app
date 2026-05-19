import fs from "node:fs";
import path from "node:path";
import { version } from "../package.json";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "out");
const APP_PACKAGE = path.join(OUT, "Vocab App-win32-x64");
const RELEASE_DIR = path.join(OUT, "release", `v${version}`);
const APP_STAGING = path.join(RELEASE_DIR, "windows-installer");
const DICT_STAGING = path.join(RELEASE_DIR, "dictionary-installer");

function main(): void {
  buildAppInstaller();
  buildDictionaryInstaller();
}

function buildAppInstaller(): void {
  requireDir(APP_PACKAGE, "Windows app package");
  fs.rmSync(APP_STAGING, { recursive: true, force: true });
  fs.mkdirSync(APP_STAGING, { recursive: true });
  fs.cpSync(APP_PACKAGE, path.join(APP_STAGING, "Vocab App-win32-x64"), { recursive: true });
  fs.writeFileSync(path.join(APP_STAGING, "Install-Vocab-App.cmd"), appCmd(), "utf8");
  fs.writeFileSync(path.join(APP_STAGING, "Install-Vocab-App.ps1"), appPs1(), "utf8");
  fs.writeFileSync(path.join(APP_STAGING, "README.txt"), appReadme(), "utf8");
}

function buildDictionaryInstaller(): void {
  const dictPath = path.join(ROOT, "dict");
  requireDir(dictPath, "Dictionary pack");
  fs.rmSync(DICT_STAGING, { recursive: true, force: true });
  fs.mkdirSync(path.join(DICT_STAGING, "dictionary"), { recursive: true });
  for (const entry of fs.readdirSync(dictPath)) {
    if (entry === ".DS_Store") continue;
    fs.cpSync(path.join(dictPath, entry), path.join(DICT_STAGING, "dictionary", entry), {
      recursive: true,
    });
  }
  fs.writeFileSync(path.join(DICT_STAGING, "Install-Vocab-Dictionary.cmd"), dictCmd(), "utf8");
  fs.writeFileSync(path.join(DICT_STAGING, "Install-Vocab-Dictionary.ps1"), dictPs1(), "utf8");
  fs.writeFileSync(path.join(DICT_STAGING, "README.txt"), dictReadme(), "utf8");
}

function requireDir(dir: string, label: string): void {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`${label} missing at ${dir}`);
  }
}

function appCmd(): string {
  return `@echo off\r\nsetlocal\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Vocab-App.ps1"\r\nif errorlevel 1 exit /b %errorlevel%\r\n`;
}

function dictCmd(): string {
  return `@echo off\r\nsetlocal\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Vocab-Dictionary.ps1"\r\nif errorlevel 1 exit /b %errorlevel%\r\n`;
}

function appPs1(): string {
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

function dictPs1(): string {
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

function appReadme(): string {
  return `Vocab App ${version} Windows installer\n\nRun Install-Vocab-App.cmd.\n\nThe installer copies the app to %LOCALAPPDATA%\\Programs\\Vocab App and creates a Desktop shortcut. Student data lives in %APPDATA%\\vocab-app, so installing a newer app version over this folder does not erase learning data.\n`;
}

function dictReadme(): string {
  return `Vocab App ${version} dictionary installer\n\nInstall the main app first, then run Install-Vocab-Dictionary.cmd.\n\nThe dictionary pack is copied to %APPDATA%\\vocab-app\\dictionary. It is separate from the app install folder and from vocab.db, so app upgrades do not remove it.\n`;
}

main();
