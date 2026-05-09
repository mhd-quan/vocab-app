/**
 * Renderer-side handle to the typed IPC bridge. Components import from
 * here instead of touching `window.api` directly so we have one place to
 * stub during tests and one place to add cross-cutting concerns later
 * (telemetry, retries, error normalization).
 */
export const api = (typeof window !== "undefined" ? window.api : undefined) as Window["api"];

if (typeof window !== "undefined" && !window.api) {
  // Surface this loudly — every screen depends on the bridge.
  console.error("[api] window.api is missing. Preload script did not run.");
}
