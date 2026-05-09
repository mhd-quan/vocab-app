import "@testing-library/jest-dom/vitest";

// Stub the preload bridge for renderer tests.
Object.defineProperty(window, "api", {
  value: {
    app: {
      name: "vocab-app",
      version: "0.0.1",
      platform: "test",
    },
  },
  writable: true,
});
