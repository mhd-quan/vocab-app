import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig({
  build: {
    rollupOptions: {
      external: [...nodeBuiltins, "electron"],
    },
  },
});
