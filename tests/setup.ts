import "@testing-library/jest-dom/vitest";

/**
 * Stub the preload bridge for renderer tests. Tests that need realistic
 * behaviour can override individual methods with `vi.spyOn`.
 */
Object.defineProperty(window, "api", {
  value: {
    app: {
      name: "vocab-app",
      version: "0.3.1",
      platform: "test",
    },
    meta: {
      ping: async () => "pong" as const,
      appInfo: async () => ({
        name: "vocab-app",
        version: "0.3.1",
        schemaTablesExpected: 20,
        dbPath: ":memory:",
      }),
    },
    auth: {
      hasPin: async () => false,
      setupPin: async () => ({ ok: true }),
      verifyPin: async () => ({ ok: true }),
      changePin: async () => ({ ok: true }),
    },
    curriculum: {
      listBooks: async () => [],
      getBookById: async () => null,
      getBookByCode: async () => null,
      listUnitsByBook: async () => [],
      getUnitById: async () => null,
      listLessonsByUnit: async () => [],
      getLessonById: async () => null,
      updateBookTitle: async () => undefined,
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
    imports: {
      listRuns: async () => [],
      listItems: async () => [],
      uploadFile: async () => ({
        filePath: "",
        fileHash: "",
        status: "failed",
        durationMs: 0,
        stats: { inserted: 0, updated: 0, skipped: 0, failed: 0 },
        items: [],
        errors: [],
      }),
      openImportDialog: async () => ({ canceled: true, results: [] }),
    },
    progress: {
      startSession: async () => ({
        id: 1,
        studentId: 1,
        mode: "mixed",
        startedAt: new Date(0),
        endedAt: null,
        summary: null,
      }),
      endSession: async () => ({ ok: true }),
      recordAnswer: async () => ({
        event: {
          id: 1,
          studentId: 1,
          contentItemId: 1,
          sessionId: 1,
          kind: "answered_correct",
          payload: null,
          occurredAt: new Date(0),
        },
        progress: {
          studentId: 1,
          contentItemId: 1,
          lastSeenAt: new Date(0),
          nextDueAt: new Date(0),
          ease: 250,
          intervalDays: 1,
          streak: 1,
          totalCorrect: 1,
          totalWrong: 0,
          updatedAt: new Date(0),
        },
        unlockedAchievements: [],
      }),
      dueByLesson: async () => ({ totalCount: 0, dueCount: 0, newCount: 0 }),
      dueByStudent: async () => [],
      studentSummary: async () => ({
        totalSeen: 0,
        totalCorrect: 0,
        totalWrong: 0,
        accuracy: 0,
        totalDue: 0,
      }),
      weakItems: async () => [],
      dailyActivity: async () => [],
      recentSessions: async () => [],
      tutorOverview: async () => [],
    },
    rewards: {
      listUnlocked: async () => [],
      streak: async () => ({
        currentStreak: 0,
        longestStreak: 0,
        lastPracticedAt: null,
        practicedToday: false,
      }),
    },
  },
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => undefined,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: () => undefined,
});
