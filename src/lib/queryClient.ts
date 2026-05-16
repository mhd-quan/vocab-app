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
    browse: (prefix: string, limit: number) => ["dictionary", "browse", prefix, limit] as const,
    search: (query: string, limit: number) => ["dictionary", "search", query, limit] as const,
    lookup: (term: string) => ["dictionary", "lookup", term] as const,
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
    lessonPrepare: (studentId: number, lessonId: number) =>
      ["dictionaryLearning", "lessonPrepare", studentId, lessonId] as const,
    lessonSummary: (studentId: number, lessonId: number) =>
      ["dictionaryLearning", "lessonSummary", studentId, lessonId] as const,
    lessonItems: (studentId: number, lessonId: number) =>
      ["dictionaryLearning", "lessonItems", studentId, lessonId] as const,
    lessonPracticeQueue: (studentId: number, lessonId: number, limit = 12) =>
      ["dictionaryLearning", "lessonPracticeQueue", studentId, lessonId, limit] as const,
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
  sync: {
    imports: () => ["sync", "imports"] as const,
  },
} as const;
