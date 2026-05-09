import { contextBridge } from "electron";

/**
 * Typed IPC bridge — populated in PR #3.
 * v0.0.1 only exposes app metadata so the renderer can verify the bridge works.
 */
const api = {
  app: {
    name: "vocab-app",
    version: "0.0.1",
    platform: process.platform,
  },
} as const;

contextBridge.exposeInMainWorld("api", api);

export type AppApi = typeof api;
