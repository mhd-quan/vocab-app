import { contextBridge, ipcRenderer } from "electron";
import type { ImportFileResult } from "../src/application/import";
import type {
  DictionaryAsset,
  DictionaryAudioAsset,
  DictionaryEntry,
  DictionarySearchResult,
  DictionaryStatus,
} from "../src/data/dictionary";
import type {
  DictionaryLearningItemView,
  DictionaryLearningReviewResult,
  DictionaryLearningSummary,
  DictionarySearchHistoryItem,
} from "../src/data/dictionaryLearning";
import type { DictionaryLearningStage } from "../src/data/schema";
import type { LessonKind, PracticeMode } from "../src/data/schema";
import type {
  Book,
  GrammarTopic,
  ImportItem,
  ImportRun,
  ItemProgress,
  LearningEvent,
  Lesson,
  PracticeSession,
  Student,
  StudentAchievement,
  Unit,
  UnitAssignment,
  VocabEntry,
} from "../src/data/types";
import type { SelfGrade } from "../src/modules/exercises/types";
import type { StreakStats } from "../src/modules/rewards";
import type { GrammarTopicForPractice } from "./db/repositories/grammar";
import type { VocabEntryFull } from "./db/repositories/vocab";

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

interface OutcomePayload {
  correct: boolean;
  feedback: string;
  selfGrade: SelfGrade | null;
  selectedIndex: number | null;
}

interface DueLessonStats {
  totalCount: number;
  dueCount: number;
  newCount: number;
}

interface DueItem {
  contentItemId: number;
  entryId: number;
  lessonId: number;
  headword: string;
  nextDueAt: Date | null;
}

interface StudentSummary {
  totalSeen: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
  totalDue: number;
}

interface WeakItem {
  entryId: number;
  contentItemId: number;
  lessonId: number;
  bookId: number;
  headword: string;
  pos: string;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
  lastSeenAt: Date | null;
}

interface DailyActivityCell {
  bucketStart: Date;
  count: number;
}

interface RecentSessionRow {
  sessionId: number;
  mode: PracticeMode;
  startedAt: Date;
  endedAt: Date | null;
  totalAnswered: number;
  totalCorrect: number;
}

interface TutorOverviewRow {
  student: Student;
  totalSeen: number;
  totalDue: number;
  accuracy: number;
  lastPracticedAt: Date | null;
}

interface CreateStudent {
  name: string;
  displayName?: string;
  avatarSeed?: string;
  color?: string;
  notes?: string;
}

interface UpdateStudentPatch {
  name?: string;
  displayName?: string | null;
  avatarSeed?: string | null;
  color?: string | null;
  notes?: string | null;
}

const api = {
  app: {
    name: "vocab-app",
    version: "0.10.0",
    platform: process.platform,
  },

  meta: {
    ping: () => invoke<"pong">("meta.ping"),
    appInfo: () =>
      invoke<{ name: string; version: string; schemaTablesExpected: number; dbPath: string }>(
        "meta.appInfo",
      ),
    srsArchiveStatus: () =>
      invoke<{ acknowledged: boolean; legacyRowCount: number }>("meta.srsArchiveStatus"),
  },

  auth: {
    hasPin: () => invoke<boolean>("auth.hasPin"),
    setupPin: (input: { pin: string }) => invoke<{ ok: true }>("auth.setupPin", input),
    verifyPin: (input: { pin: string }) =>
      invoke<{ ok: true } | { ok: false; reason: "no_pin" | "invalid" }>("auth.verifyPin", input),
    changePin: (input: { currentPin: string; newPin: string }) =>
      invoke<{ ok: true }>("auth.changePin", input),
  },

  curriculum: {
    listBooks: () => invoke<Book[]>("curriculum.listBooks"),
    getBookById: (input: { id: number }) => invoke<Book | null>("curriculum.getBookById", input),
    getBookByCode: (input: { code: string }) =>
      invoke<Book | null>("curriculum.getBookByCode", input),
    listUnitsByBook: (input: { bookId: number }) =>
      invoke<Unit[]>("curriculum.listUnitsByBook", input),
    getUnitById: (input: { id: number }) => invoke<Unit | null>("curriculum.getUnitById", input),
    listLessonsByUnit: (input: { unitId: number; kind?: LessonKind }) =>
      invoke<Lesson[]>("curriculum.listLessonsByUnit", input),
    getLessonById: (input: { id: number }) =>
      invoke<Lesson | null>("curriculum.getLessonById", input),
    updateBookTitle: (input: { id: number; title: string }) =>
      invoke<void>("curriculum.updateBookTitle", input),
  },

  vocab: {
    listByLesson: (input: { lessonId: number }) =>
      invoke<VocabEntry[]>("vocab.listByLesson", input),
    listFullByLesson: (input: { lessonId: number }) =>
      invoke<VocabEntryFull[]>("vocab.listFullByLesson", input),
    countByLesson: (input: { lessonId: number }) => invoke<number>("vocab.countByLesson", input),
    getById: (input: { id: number }) => invoke<VocabEntryFull | null>("vocab.getById", input),
  },

  dictionary: {
    status: () => invoke<DictionaryStatus>("dictionary.status", {}),
    search: (input: { query: string; limit?: number }) =>
      invoke<DictionarySearchResult[]>("dictionary.search", input),
    lookup: (input: { term: string }) => invoke<DictionaryEntry | null>("dictionary.lookup", input),
    batchLookup: (input: { terms: string[] }) =>
      invoke<{ entries: Record<string, DictionaryEntry | null> }>("dictionary.batchLookup", input),
    audio: (input: { ref: string }) =>
      invoke<DictionaryAudioAsset | null>("dictionary.audio", input),
    asset: (input: { ref: string }) => invoke<DictionaryAsset | null>("dictionary.asset", input),
    selectPackFolder: () => invoke<DictionaryStatus>("dictionary.selectPackFolder", {}),
    clearPackFolder: () => invoke<DictionaryStatus>("dictionary.clearPackFolder", {}),
  },

  dictionaryLearning: {
    recordSearch: (input: { studentId: number; query: string }) =>
      invoke<DictionarySearchHistoryItem | null>("dictionaryLearning.recordSearch", input),
    recordLookup: (input: { studentId: number; query: string; dictionaryKey: string }) =>
      invoke<DictionaryLearningItemView>("dictionaryLearning.recordLookup", input),
    summary: (input: { studentId: number }) =>
      invoke<DictionaryLearningSummary>("dictionaryLearning.summary", input),
    recentSearches: (input: { studentId: number; limit?: number }) =>
      invoke<DictionarySearchHistoryItem[]>("dictionaryLearning.recentSearches", input),
    listItems: (input: { studentId: number }) =>
      invoke<DictionaryLearningItemView[]>("dictionaryLearning.listItems", input),
    practiceQueue: (input: { studentId: number; limit?: number }) =>
      invoke<DictionaryLearningItemView[]>("dictionaryLearning.practiceQueue", input),
    recordReview: (input: {
      studentId: number;
      itemId: number;
      stage: DictionaryLearningStage;
      correct: boolean;
      answer?: string | null;
      expected?: string | null;
      sessionId?: number | null;
    }) => invoke<DictionaryLearningReviewResult>("dictionaryLearning.recordReview", input),
  },

  grammar: {
    listByLesson: (input: { lessonId: number }) =>
      invoke<GrammarTopic[]>("grammar.listByLesson", input),
    listPracticeByLesson: (input: { lessonId: number }) =>
      invoke<GrammarTopicForPractice[]>("grammar.listPracticeByLesson", input),
    countByLesson: (input: { lessonId: number }) => invoke<number>("grammar.countByLesson", input),
    getById: (input: { id: number }) => invoke<GrammarTopic | null>("grammar.getById", input),
  },

  students: {
    listActive: () => invoke<Student[]>("students.listActive"),
    listAll: () => invoke<Student[]>("students.listAll"),
    getById: (input: { id: number }) => invoke<Student | null>("students.getById", input),
    create: (input: CreateStudent) => invoke<Student>("students.create", input),
    update: (input: { id: number; patch: UpdateStudentPatch }) =>
      invoke<Student>("students.update", input),
    archive: (input: { id: number }) => invoke<{ ok: true }>("students.archive", input),
    restore: (input: { id: number }) => invoke<{ ok: true }>("students.restore", input),
    listAssignedBooks: (input: { studentId: number }) =>
      invoke<Book[]>("students.listAssignedBooks", input),
    listAssignedUnits: (input: { studentId: number; bookId: number }) =>
      invoke<Unit[]>("students.listAssignedUnits", input),
    listAssignedUnitIds: (input: { studentId: number; bookId?: number }) =>
      invoke<number[]>("students.listAssignedUnitIds", input),
    replaceUnitAssignments: (input: { studentId: number; bookId: number; unitIds: number[] }) =>
      invoke<UnitAssignment[]>("students.replaceUnitAssignments", input),
  },

  settings: {
    get: <T = unknown>(input: { key: string }) => invoke<T | null>("settings.get", input),
    set: (input: { key: string; value: unknown }) => invoke<{ ok: true }>("settings.set", input),
    delete: (input: { key: string }) => invoke<{ ok: true }>("settings.delete", input),
    getAll: () => invoke<Record<string, unknown>>("settings.getAll"),
  },

  imports: {
    listRuns: (input?: { limit?: number }) => invoke<ImportRun[]>("imports.listRuns", input ?? {}),
    listItems: (input: { runId: number }) => invoke<ImportItem[]>("imports.listItems", input),
    uploadFile: (input: { fileName: string; content: string }) =>
      invoke<ImportFileResult>("imports.uploadFile", input),
    openImportDialog: () =>
      invoke<{ canceled: boolean; results: ImportFileResult[] }>("imports.openImportDialog"),
  },

  progress: {
    startSession: (input: { studentId: number; mode: PracticeMode }) =>
      invoke<PracticeSession>("progress.startSession", input),
    endSession: (input: { sessionId: number; summary?: Record<string, unknown> | null }) =>
      invoke<{ ok: true }>("progress.endSession", input),
    recordAnswer: (input: {
      studentId: number;
      sessionId: number;
      entryId: number;
      outcome: OutcomePayload;
      currentSessionRun?: number;
      occurredAtIso?: string;
    }) =>
      invoke<{
        event: LearningEvent;
        progress: ItemProgress;
        unlockedAchievements: StudentAchievement[];
      }>("progress.recordAnswer", input),
    recordContentAnswer: (input: {
      studentId: number;
      sessionId: number;
      contentItemId: number;
      outcome: OutcomePayload;
      currentSessionRun?: number;
      occurredAtIso?: string;
    }) =>
      invoke<{
        event: LearningEvent;
        progress: ItemProgress;
        unlockedAchievements: StudentAchievement[];
      }>("progress.recordContentAnswer", input),
    dueByLesson: (input: { studentId: number; lessonId: number; nowIso?: string }) =>
      invoke<DueLessonStats>("progress.dueByLesson", input),
    seenEntryIdsByLesson: (input: { studentId: number; lessonId: number }) =>
      invoke<number[]>("progress.seenEntryIdsByLesson", input),
    dueByStudent: (input: { studentId: number; nowIso?: string; limit?: number }) =>
      invoke<DueItem[]>("progress.dueByStudent", input),
    studentSummary: (input: { studentId: number }) =>
      invoke<StudentSummary>("progress.studentSummary", input),
    weakItems: (input: { studentId: number; minAttempts?: number; limit?: number }) =>
      invoke<WeakItem[]>("progress.weakItems", input),
    dailyActivity: (input: { studentId: number; sinceIso: string; untilIso: string }) =>
      invoke<DailyActivityCell[]>("progress.dailyActivity", input),
    recentSessions: (input: { studentId: number; limit?: number }) =>
      invoke<RecentSessionRow[]>("progress.recentSessions", input),
    tutorOverview: (input?: { nowIso?: string }) =>
      invoke<TutorOverviewRow[]>("progress.tutorOverview", input ?? {}),
  },

  rewards: {
    listUnlocked: (input: { studentId: number }) =>
      invoke<StudentAchievement[]>("rewards.listUnlocked", input),
    streak: (input: { studentId: number; nowIso?: string }) =>
      invoke<StreakStats>("rewards.streak", input),
  },
} as const;

contextBridge.exposeInMainWorld("api", api);

export type AppApi = typeof api;
