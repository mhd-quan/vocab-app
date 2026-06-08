import path from "node:path";
import { BrowserWindow, type MediaAccessPermissionRequest, app, session, shell } from "electron";
import started from "electron-squirrel-startup";
import { SETTINGS_KEYS } from "../src/modules/settings/keys";
import { type AppDatabase, closeDatabase, openDatabase } from "./db";
import { createRepositories } from "./db/repositories";
import {
  allProcedures,
  assertRequiredIpcChannels,
  registerIpcProcedures,
  unregisterIpcProcedures,
} from "./ipc";
import { disposePronunciationRuntime } from "./pronunciation/runtime";
import { applyScreenshotPolicy } from "./windowPolicy";

if (started) {
  app.quit();
}

// Headroom on top of Node's default 10 — Electron and our IPC layer
// each subscribe a handful of long-lived listeners, and a strict cap
// floods the dev terminal with MaxListenersExceededWarning even when
// nothing has actually leaked. 20 is enough for our footprint and
// still catches real runaway listeners.
process.setMaxListeners(20);

let db: AppDatabase | null = null;
let mainWindow: BrowserWindow | null = null;

function installPermissionHandlers(): void {
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === "media");
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (permission !== "media") {
      callback(false);
      return;
    }

    const mediaTypes = (details as MediaAccessPermissionRequest).mediaTypes ?? [];
    callback(
      mediaTypes.length === 0 || mediaTypes.some((type) => type === "audio" || type === "video"),
    );
  });
}

const createMainWindow = (screenshotsEnabled: boolean): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    icon: path.join(__dirname, "..", "..", "assets", "icons", "app-256.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  applyScreenshotPolicy(win, screenshotsEnabled);

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return win;
};

app.whenReady().then(() => {
  installPermissionHandlers();

  db = openDatabase();
  console.log("[db] opened, applied migrations through latest");

  const repos = createRepositories(db);
  assertRequiredIpcChannels(allProcedures);
  registerIpcProcedures(allProcedures, { db, repos, getMainWindow: () => mainWindow });
  console.log(`[ipc] registered ${allProcedures.length} procedures`);
  console.log(`[boot] vocab-app pid=${process.pid} platform=${process.platform}`);

  mainWindow = createMainWindow(
    repos.settings.get<boolean>(SETTINGS_KEYS.screenshotsEnabled) === true,
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(
        repos.settings.get<boolean>(SETTINGS_KEYS.screenshotsEnabled) === true,
      );
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  unregisterIpcProcedures(allProcedures);
  if (db) {
    closeDatabase(db);
    db = null;
  }
});

app.on("before-quit", async (event) => {
  if ((app as unknown as { _captDisposed?: boolean })._captDisposed) return;
  event.preventDefault();
  (app as unknown as { _captDisposed?: boolean })._captDisposed = true;
  try {
    await disposePronunciationRuntime();
  } catch (error) {
    console.warn("[capt] disposePronunciationRuntime failed:", error);
  } finally {
    app.quit();
  }
});
