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

const runtimeNativeDependencies = ["better-sqlite3", "bindings", "file-uri-to-path"];
const execFileAsync = promisify(execFile);

function copyRuntimeNativeDependencies(buildPath: string): void {
  const targetNodeModules = path.join(buildPath, "node_modules");
  fs.mkdirSync(targetNodeModules, { recursive: true });

  for (const dependency of runtimeNativeDependencies) {
    const source = path.join(__dirname, "node_modules", dependency);
    const destination = path.join(targetNodeModules, dependency);
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(source, destination, { recursive: true });

    if (dependency === "better-sqlite3") {
      fs.rmSync(path.join(destination, "build"), { recursive: true, force: true });
      fs.rmSync(path.join(destination, "bin"), { recursive: true, force: true });
    }
  }
}

async function installTargetBetterSqlitePrebuild(
  buildPath: string,
  electronVersion: string,
  platform: string,
  arch: string,
): Promise<void> {
  if (platform !== "win32") return;

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

const config: ForgeConfig = {
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      copyRuntimeNativeDependencies(buildPath);
    },
    packageAfterPrune: async (_config, buildPath, electronVersion, platform, arch) => {
      await installTargetBetterSqlitePrebuild(buildPath, electronVersion, platform, arch);
    },
  },
  packagerConfig: {
    asar: true,
    name: "Vocab App",
    executableName: "vocab-app",
    appBundleId: "dev.mhd-quan.vocab-app",
    icon: undefined,
    extendInfo: {
      NSCameraUsageDescription:
        "Vocab App can take visible, consented camera check-ins during student study sessions.",
    },
    // SQL migration files live alongside the app bundle so the runtime
    // migrator can read them. Resolved via `process.resourcesPath` in
    // electron/db/paths.ts.
    extraResource: ["./drizzle"],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ name: "vocab-app" }),
    new MakerZIP({}, ["darwin", "win32"]),
    new MakerDMG({ format: "ULFO" }),
    new MakerDeb({}),
  ],
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
