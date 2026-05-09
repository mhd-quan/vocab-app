import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Native modules and Node built-ins must NOT be bundled into main.js — they
 * have to be `require`d at runtime. Vite (Rollup) otherwise tries to inline
 * `.node` binaries, which fails with "Could not dynamically require ...".
 *
 * Anything matching `external` is left as a runtime `require()` call.
 */
const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

const nativeModules = ["electron", "better-sqlite3", "bindings"];

export default defineConfig({
  resolve: {
    alias: {
      "@electron": resolve(__dirname, "electron"),
    },
  },
  build: {
    rollupOptions: {
      external: [...nodeBuiltins, ...nativeModules],
    },
  },
});
