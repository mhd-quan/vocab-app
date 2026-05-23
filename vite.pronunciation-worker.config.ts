import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Build config for the CAPT inference utility process. This bundle is
 * a Node-side module (loaded by `utilityProcess.fork`) and must keep
 * the native dependencies as runtime requires — same external list as
 * the main process.
 */
const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

const nativeModules = ["electron", "@huggingface/transformers", "onnxruntime-node", "bindings"];

export default defineConfig({
  resolve: {
    alias: {
      "@electron": resolve(__dirname, "electron"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "pronunciation-worker.js",
      },
      external: [...nodeBuiltins, ...nativeModules],
    },
  },
});
