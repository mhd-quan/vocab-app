import "@testing-library/jest-dom/vitest";

/**
 * Stub the preload bridge for renderer tests. Tests that need realistic
 * behaviour can override individual methods with `vi.spyOn`.
 */
Object.defineProperty(window, "api", {
  value: {
    app: {
      name: "vocab-app",
      version: "0.0.1",
      platform: "test",
    },
    meta: {
      ping: async () => "pong" as const,
      appInfo: async () => ({
        name: "vocab-app",
        version: "0.0.1",
        schemaTablesExpected: 19,
      }),
    },
    curriculum: {
      listBooks: async () => [],
      getBookById: async () => null,
      getBookByCode: async () => null,
      listUnitsByBook: async () => [],
      getUnitById: async () => null,
      listLessonsByUnit: async () => [],
      getLessonById: async () => null,
    },
    vocab: {
      listByLesson: async () => [],
      listFullByLesson: async () => [],
      countByLesson: async () => 0,
      getById: async () => null,
    },
    students: {
      listActive: async () => [],
      listAll: async () => [],
      getById: async () => null,
      create: async (input: unknown) => input,
      update: async () => null,
      archive: async () => ({ ok: true }),
      restore: async () => ({ ok: true }),
    },
    settings: {
      get: async () => null,
      set: async () => ({ ok: true }),
      delete: async () => ({ ok: true }),
      getAll: async () => ({}),
    },
  },
  writable: true,
});
