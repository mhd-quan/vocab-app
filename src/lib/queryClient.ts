import { QueryClient } from "@tanstack/react-query";

/**
 * Single QueryClient instance shared by the whole renderer. We keep the
 * defaults conservative: this is a local-first app with sub-millisecond
 * IPC, so retries and aggressive refetching just add noise.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/** Centralized query key namespaces — keep keys typo-proof and groupable. */
export const queryKeys = {
  meta: {
    appInfo: () => ["meta", "appInfo"] as const,
    srsArchiveStatus: () => ["meta", "srsArchiveStatus"] as const,
  },
  auth: {
    hasPin: () => ["auth", "hasPin"] as const,
  },
  curriculum: {
    books: () => ["curriculum", "books"] as const,
    units: (bookId: number) => ["curriculum", "units", bookId] as const,
    lessons: (unitId: number) => ["curriculum", "lessons", unitId] as const,
    lessonById: (lessonId: number) => ["curriculum", "lesson", lessonId] as const,
  },
  vocab: {
    list: (lessonId: number) => ["vocab", "list", lessonId] as const,
    full: (lessonId: number) => ["vocab", "full", lessonId] as const,
    count: (lessonId: number) => ["vocab", "count", lessonId] as const,
  },
  dictionary: {
    status: () => ["dictionary", "status"] as const,
    search: (query: string, limit: number) => ["dictionary", "search", query, limit] as const,
    lookup: (term: string) => ["dictionary", "lookup", term] as const,
    /**
     * Batch lookup key. We sort the input terms so two callers asking for
     * `["a", "b"]` and `["b", "a"]` share the same cache entry.
     */
    batchLookup: (terms: ReadonlyArray<string>) =>
      ["dictionary", "batchLookup", [...terms].sort().join("|")] as const,
    audio: (ref: string) => ["dictionary", "audio", ref] as const,
    asset: (ref: string) => ["dictionary", "asset", ref] as const,
  },
  dictionaryLearning: {
    summary: (studentId: number) => ["dictionaryLearning", "summary", studentId] as const,
    recentSearches: (studentId: number, limit = 12) =>
      ["dictionaryLearning", "recentSearches", studentId, limit] as const,
    items: (studentId: number) => ["dictionaryLearning", "items", studentId] as const,
    practiceQueue: (studentId: number, limit = 12) =>
      ["dictionaryLearning", "practiceQueue", studentId, limit] as const,
  },
  grammar: {
    list: (lessonId: number) => ["grammar", "list", lessonId] as const,
    practice: (lessonId: number) => ["grammar", "practice", lessonId] as const,
    count: (lessonId: number) => ["grammar", "count", lessonId] as const,
    byId: (id: number) => ["grammar", "byId", id] as const,
  },
  students: {
    listActive: () => ["students", "listActive"] as const,
    listAll: () => ["students", "listAll"] as const,
    byId: (id: number) => ["students", "byId", id] as const,
    assignedBooks: (studentId: number) => ["students", "assignedBooks", studentId] as const,
    assignedUnits: (studentId: number, bookId: number) =>
      ["students", "assignedUnits", studentId, bookId] as const,
    assignedUnitIds: (studentId: number, bookId?: number) =>
      ["students", "assignedUnitIds", studentId, bookId ?? "all"] as const,
  },
  imports: {
    listRuns: (limit?: number) => ["imports", "listRuns", limit ?? "default"] as const,
    listItems: (runId: number) => ["imports", "listItems", runId] as const,
  },
  progress: {
    dueByLesson: (studentId: number, lessonId: number) =>
      ["progress", "dueByLesson", studentId, lessonId] as const,
    seenEntryIdsByLesson: (studentId: number, lessonId: number) =>
      ["progress", "seenEntryIdsByLesson", studentId, lessonId] as const,
    dueByStudent: (studentId: number) => ["progress", "dueByStudent", studentId] as const,
    summary: (studentId: number) => ["progress", "summary", studentId] as const,
    weakItems: (studentId: number) => ["progress", "weakItems", studentId] as const,
    dailyActivity: (studentId: number, days: number) =>
      ["progress", "dailyActivity", studentId, days] as const,
    recentSessions: (studentId: number) => ["progress", "recentSessions", studentId] as const,
    tutorOverview: () => ["progress", "tutorOverview"] as const,
  },
  rewards: {
    listUnlocked: (studentId: number) => ["rewards", "listUnlocked", studentId] as const,
    streak: (studentId: number) => ["rewards", "streak", studentId] as const,
  },
} as const;
