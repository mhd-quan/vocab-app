import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@electron": resolve(__dirname, "electron"),
    },
  },
  build: {
    rollupOptions: {
      external: ["electron"],
    },
  },
});
