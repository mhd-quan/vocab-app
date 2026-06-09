import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const runtimeNativeDependencies = [
  "better-sqlite3",
  "@huggingface/transformers",
  "bindings",
  "file-uri-to-path",
  "onnxruntime-node",
  "onnxruntime-common",
  "onnxruntime-web",
  "adm-zip",
  "sharp",
  "@img/colour",
  "detect-libc",
  "semver",
];
const sharpTargetDependencies: Record<string, string[]> = {
  "darwin-arm64": ["@img/sharp-darwin-arm64", "@img/sharp-libvips-darwin-arm64"],
  "darwin-x64": ["@img/sharp-darwin-x64", "@img/sharp-libvips-darwin-x64"],
  "win32-arm64": ["@img/sharp-win32-arm64"],
  "win32-ia32": ["@img/sharp-win32-ia32"],
  "win32-x64": ["@img/sharp-win32-x64"],
};
const execFileAsync = promisify(execFile);

async function copyRuntimeNativeDependencies(
  buildPath: string,
  platform: string,
  arch: string,
): Promise<void> {
  const targetNodeModules = path.join(buildPath, "node_modules");
  fs.mkdirSync(targetNodeModules, { recursive: true });

  for (const dependency of runtimeDependenciesForTarget(platform, arch)) {
    const source = await runtimeDependencySource(dependency, platform, arch);
    copyPackageDirectory(source, path.join(targetNodeModules, dependency));
    if (dependency === "better-sqlite3") {
      const destination = path.join(targetNodeModules, dependency);
      fs.rmSync(path.join(destination, "build"), { recursive: true, force: true });
      fs.rmSync(path.join(destination, "bin"), { recursive: true, force: true });
    }
  }
}

function runtimeDependenciesForTarget(platform: string, arch: string): string[] {
  return [...runtimeNativeDependencies, ...(sharpTargetDependencies[`${platform}-${arch}`] ?? [])];
}

async function runtimeDependencySource(
  dependency: string,
  platform: string,
  arch: string,
): Promise<string> {
  const localSource = path.join(__dirname, "node_modules", dependency);
  if (fs.existsSync(localSource)) return localSource;

  if (dependency.startsWith("@img/sharp-")) {
    return installTargetSharpDependency(dependency, platform, arch);
  }

  throw new Error(`Runtime dependency is missing from node_modules: ${dependency}`);
}

function copyPackageDirectory(source: string, destination: string): void {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}

async function installTargetSharpDependency(
  dependency: string,
  platform: string,
  arch: string,
): Promise<string> {
  const version = sharpOptionalDependencyVersion(dependency);
  const cacheRoot = path.join(
    os.tmpdir(),
    "vocab-app-target-node-modules",
    `${safePackagePath(dependency)}-${version}`,
  );
  const source = path.join(cacheRoot, "node_modules", dependency);
  if (!fs.existsSync(source)) {
    fs.rmSync(cacheRoot, { recursive: true, force: true });
    fs.mkdirSync(cacheRoot, { recursive: true });
    await execFileAsync(
      npmExecutable(),
      [
        "install",
        "--prefix",
        cacheRoot,
        "--no-save",
        "--omit=dev",
        "--include=optional",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--force",
        `--os=${platform}`,
        `--cpu=${arch}`,
        `${dependency}@${version}`,
      ],
      {
        env: {
          ...process.env,
          npm_config_cache:
            process.env.npm_config_cache ?? path.join(os.tmpdir(), "vocab-app-npm-cache"),
        },
        maxBuffer: 1024 * 1024 * 10,
      },
    );
  }

  if (!fs.existsSync(source)) {
    throw new Error(`Could not install target sharp dependency: ${dependency}@${version}`);
  }
  return source;
}

function sharpOptionalDependencyVersion(dependency: string): string {
  const sharpPackageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "node_modules", "sharp", "package.json"), "utf8"),
  ) as { optionalDependencies?: Record<string, string> };
  const version = sharpPackageJson.optionalDependencies?.[dependency];
  if (!version) throw new Error(`sharp does not declare optional dependency ${dependency}`);
  return version;
}

function npmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function safePackagePath(packageName: string): string {
  return packageName.replace(/^@/, "").replace(/\//g, "-");
}

async function installTargetBetterSqlitePrebuild(
  buildPath: string,
  electronVersion: string,
  platform: string,
  arch: string,
): Promise<void> {
  // Runs for every desktop target. `copyRuntimeNativeDependencies` (called from
  // packageAfterPrune) re-copies the dev better-sqlite3 and strips its build/
  // directory on all platforms, which wipes the binary @electron-forge rebuilt
  // during packaging. We must restore a target-correct prebuilt `.node` here for
  // macOS as well as Windows — otherwise the packaged app has no SQLite native
  // module and fails to open its database on launch.
  const modulePath = path.join(buildPath, "node_modules", "better-sqlite3");
  if (!fs.existsSync(modulePath)) return;

  fs.rmSync(path.join(modulePath, "build"), { recursive: true, force: true });
  fs.rmSync(path.join(modulePath, "bin"), { recursive: true, force: true });

  await execFileAsync(
    process.execPath,
    [
      path.join(__dirname, "node_modules", "prebuild-install", "bin.js"),
      "--runtime=electron",
      `--target=${electronVersion}`,
      `--platform=${platform}`,
      `--arch=${arch}`,
      "--force",
    ],
    {
      cwd: modulePath,
      env: {
        ...process.env,
        npm_config_cache:
          process.env.npm_config_cache ?? path.join(os.tmpdir(), "vocab-app-npm-cache"),
      },
      maxBuffer: 1024 * 1024 * 10,
    },
  );
}

function pruneOnnxRuntimeBinaries(buildPath: string, platform: string, arch: string): void {
  for (const packageDir of onnxRuntimePackageDirs(buildPath)) {
    const napiRoot = path.join(packageDir, "bin", "napi-v6");
    if (!fs.existsSync(napiRoot)) continue;

    for (const platformEntry of fs.readdirSync(napiRoot)) {
      const platformPath = path.join(napiRoot, platformEntry);
      if (!fs.statSync(platformPath).isDirectory()) continue;
      if (platformEntry !== platform) {
        fs.rmSync(platformPath, { recursive: true, force: true });
        continue;
      }

      for (const archEntry of fs.readdirSync(platformPath)) {
        const archPath = path.join(platformPath, archEntry);
        if (fs.statSync(archPath).isDirectory() && archEntry !== arch) {
          fs.rmSync(archPath, { recursive: true, force: true });
        }
      }
    }
  }
}

function onnxRuntimePackageDirs(buildPath: string): string[] {
  return [
    path.join(buildPath, "node_modules", "onnxruntime-node"),
    path.join(
      buildPath,
      "node_modules",
      "@huggingface",
      "transformers",
      "node_modules",
      "onnxruntime-node",
    ),
  ];
}

function forgeMakers(): ForgeConfig["makers"] {
  const makers: ForgeConfig["makers"] = [
    new MakerZIP({}, ["darwin", "win32"]),
    new MakerDMG({ format: "ULFO" }),
    new MakerDeb({}),
  ];

  // electron-winstaller requires Mono + Wine when run off Windows. The release
  // flow already ships a ready-to-run Windows ZIP plus our script installer, so
  // keep cross-platform makes deterministic and allow Squirrel only where it can
  // run without extra host tooling.
  if (process.platform === "win32" || process.env.VOCAB_ENABLE_SQUIRREL === "1") {
    makers.unshift(new MakerSquirrel({ name: "vocab-app" }));
  }

  return makers;
}

const config: ForgeConfig = {
  hooks: {
    packageAfterCopy: async (_config, buildPath, _electronVersion, platform, arch) => {
      await copyRuntimeNativeDependencies(buildPath, platform, arch);
    },
    packageAfterPrune: async (_config, buildPath, electronVersion, platform, arch) => {
      await copyRuntimeNativeDependencies(buildPath, platform, arch);
      await installTargetBetterSqlitePrebuild(buildPath, electronVersion, platform, arch);
      pruneOnnxRuntimeBinaries(buildPath, platform, arch);
    },
  },
  packagerConfig: {
    // Native `.node` addons load their sibling shared libraries (onnxruntime.dll
    // + DirectML/dxil/dxcompiler and libonnxruntime.*.dylib for onnxruntime-node;
    // libvips-cpp.*.dylib / libvips-42.dll for sharp) by file path at load time.
    // The OS dynamic loader cannot read those out of an asar archive, so every
    // native shared library MUST sit on disk. AutoUnpackNatives only unpacks
    // `*.node`, which leaves the sidecar libraries trapped in app.asar — the
    // binding then either fails to load (sharp: "Library not loaded …
    // libvips-cpp.*.dylib") or binds to a stale system copy (Windows ONNX:
    // "Failed to initialize ONNX Runtime API … lower version DLL"). Unpacking all
    // shared libraries closes the whole class of bug for current and future
    // native deps. AutoUnpackNatives composes this glob with its own `.node` one.
    asar: { unpack: "**/*.{dll,dylib,so}" },
    name: "Vocab App",
    executableName: "vocab-app",
    appBundleId: "dev.mhd-quan.vocab-app",
    icon: path.join(__dirname, "assets", "icons", "app"),
    extendInfo: {
      NSMicrophoneUsageDescription:
        "Vocab App uses your microphone to score pronunciation locally. Audio never leaves this device.",
      NSCameraUsageDescription:
        "Vocab App can take visible, consented camera check-ins during student study sessions.",
      NSCameraUseContinuityCameraDeviceType: true,
    },
    // Helper bundles (notably "Electron Helper (Plugin)" where our
    // utilityProcess + onnxruntime-node live) emit their own AVCapture
    // deprecation warning unless this key is on each helper's Info.plist.
    // The Renderer helper additionally needs NSMicrophoneUsageDescription
    // because getUserMedia() runs there — without it macOS aborts the
    // permission prompt with a misleading "user aborted" error.
    extendHelperInfo: {
      NSCameraUseContinuityCameraDeviceType: true,
      NSCameraUsageDescription:
        "Vocab App can take visible, consented camera check-ins during student study sessions.",
      NSMicrophoneUsageDescription:
        "Vocab App uses your microphone to score pronunciation locally. Audio never leaves this device.",
    },
    // SQL migration files live alongside the app bundle so the runtime
    // migrator can read them. Resolved via `process.resourcesPath` in
    // electron/db/paths.ts.
    extraResource: [
      "./drizzle",
      "./assets/capt-models",
      "./assets/cmudict",
      "./assets/pronunciation",
    ],
  },
  rebuildConfig: {},
  makers: forgeMakers(),
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: "electron/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "electron/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
        {
          entry: "electron/pronunciation/worker/entry.ts",
          config: "vite.pronunciation-worker.config.ts",
          target: "main",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
