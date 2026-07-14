import { contextBridge, ipcRenderer } from "electron";
import packageJson from "../package.json";
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
  SessionEvidenceEvent,
  Student,
  StudentAchievement,
  Unit,
  UnitAssignment,
  VocabEntry,
} from "../src/data/types";
import type { SelfGrade } from "../src/modules/exercises/types";
import type { AchievementStats, StreakStats } from "../src/modules/rewards";
import type {
  StudentEvidenceOverview,
  StudentEvidenceTimeline,
  TutorEvidenceOverviewRow,
} from "./db/repositories/evidence";
import type { GrammarTopicForPractice } from "./db/repositories/grammar";
import type {
  AssignedUnitProgressRow,
  CohortActivityCell,
  FleetSnapshot,
  SessionLearningReport,
  StudyTargetsResult,
  UnitReportRow,
  UnitSessionReportRow,
} from "./db/repositories/progress";
import type { VocabEntryFull } from "./db/repositories/vocab";
import type { PronunciationPhraseExample } from "./db/repositories/vocab";
import type { MicrophonePermissionState } from "./permissions/microphone";

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
  totalAttempts: number;
  totalDue: number;
  accuracy: number;
  lastPracticedAt: Date | null;
}

interface EvidenceEventPayload {
  studentId: number;
  sessionId: number;
  kind:
    | "session_notice_shown"
    | "camera_consent_granted"
    | "camera_consent_declined"
    | "camera_unavailable"
    | "camera_snapshot"
    | "window_focus_lost"
    | "window_focus_returned"
    | "document_hidden"
    | "document_visible"
    | "guardrail_overlay_shown"
    | "guardrail_overlay_dismissed"
    | "pronunciation_assessment"
    | "answer_submitted";
  severity?: "info" | "attention" | "integrity" | "system";
  durationMs?: number | null;
  payload?: Record<string, unknown> | null;
  occurredAtIso?: string;
}

interface EvidenceExportResult {
  canceled: boolean;
  filePath: string | null;
  encrypted: boolean;
  sha256: string;
}

interface EvidenceImportResult {
  canceled: boolean;
  imported: boolean;
  studentId: number | null;
  stats: {
    studentId: number;
    sessionsInserted: number;
    sessionsUpdated: number;
    learningEventsInserted: number;
    learningEventsSkipped: number;
    evidenceEventsInserted: number;
    evidenceEventsSkipped: number;
    progressUpserted: number;
    achievementsUpserted: number;
    dictionaryItemsUpserted: number;
    dictionarySearchesInserted: number;
    dictionarySearchesSkipped: number;
    assignmentsUpserted: number;
  } | null;
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

interface PronunciationStatus {
  available: boolean;
  backend: "onnx-native" | "transformers-js" | "deterministic";
  executionProvider: "coreml" | "directml" | "webgpu" | "wasm" | "cpu";
  modelFamily: "hubert" | null;
  modelId: string | null;
  platform: NodeJS.Platform | "test";
  arch: string;
  modelPath: string | null;
  modelPresent: boolean;
  localOnly: boolean;
  reason: string | null;
}

interface PronunciationTarget {
  text: string;
  phonemes: string[];
  stressPattern: Array<0 | 1 | 2 | null>;
  source: "cmudict" | "heuristic" | "ipa" | "mixed";
  words?: Array<{
    text: string;
    phonemeRange: [number, number];
    source: "cmudict" | "heuristic" | "ipa";
  }>;
}

interface PronunciationAssessment {
  target: PronunciationTarget;
  backend: "onnx-native" | "transformers-js" | "deterministic";
  executionProvider: "coreml" | "directml" | "webgpu" | "wasm" | "cpu";
  modelUsed: boolean;
  durationMs: number;
  overallScore: number;
  phonemeScore: number;
  stressScore: number | null;
  passingScore: number;
  errorRate: number;
  retryRequired: boolean;
  guardrails: Array<{
    code:
      | "audio_missing"
      | "audio_too_short"
      | "audio_too_quiet"
      | "audio_clipped"
      | "score_below_threshold";
    severity: "info" | "warning" | "retry";
    message: string;
  }>;
  audioQuality: {
    durationMs: number;
    sampleRate: number;
    rms: number;
    peak: number;
    clippedRatio: number;
    silentRatio: number;
  } | null;
  phonemes: Array<{
    phoneme: string;
    expectedIndex: number;
    startMs: number;
    endMs: number;
    score: number;
    detectedPhoneme: string | null;
    issue: "ok" | "substitution" | "weak" | "missing";
  }>;
  stress: {
    expectedStress: Array<0 | 1 | 2 | null>;
    observedStress: Array<0 | 1 | 2 | null>;
    score: number;
    issue: "ok" | "flat" | "shifted" | "unavailable";
  };
  feedback: string[];
}

const api = {
  app: {
    name: packageJson.name,
    version: packageJson.version,
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
    examplesForHeadword: (input: { headword: string }) =>
      invoke<PronunciationPhraseExample[]>("vocab.examplesForHeadword", input),
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
      selfGrade?: SelfGrade | null;
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
    hasPin: (input: { studentId: number }) => invoke<boolean>("students.hasPin", input),
    setupPin: (input: { studentId: number; pin: string }) =>
      invoke<{ ok: true }>("students.setupPin", input),
    verifyPin: (input: { studentId: number; pin: string }) =>
      invoke<{ ok: true } | { ok: false; reason: "no_pin" | "invalid" }>(
        "students.verifyPin",
        input,
      ),
    changePin: (input: { studentId: number; currentPin: string; newPin: string }) =>
      invoke<{ ok: true }>("students.changePin", input),
    clearPin: (input: { studentId: number }) => invoke<{ ok: true }>("students.clearPin", input),
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

  permissions: {
    microphoneStatus: () => invoke<MicrophonePermissionState>("permissions.microphoneStatus"),
    requestMicrophone: () => invoke<MicrophonePermissionState>("permissions.requestMicrophone"),
    openMicrophoneSettings: () => invoke<{ opened: boolean }>("permissions.openMicrophoneSettings"),
    logMicrophoneCaptureDiagnostic: (input: {
      event: string;
      phase: string;
      backend?: string;
      permission?: MicrophonePermissionState | null;
      context?: { state: string | null; sampleRate: number | null };
      worklet?: { protocol: string; path: string };
      error?: { name: string | null; message: string; code?: number };
      detail?: string;
      atIso: string;
    }) => invoke<{ ok: true }>("permissions.logMicrophoneCaptureDiagnostic", input),
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
      responseMs?: number;
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
      responseMs?: number;
    }) =>
      invoke<{
        event: LearningEvent;
        progress: ItemProgress;
        unlockedAchievements: StudentAchievement[];
      }>("progress.recordContentAnswer", input),
    dueByLesson: (input: { studentId: number; lessonId: number; nowIso?: string }) =>
      invoke<DueLessonStats>("progress.dueByLesson", input),
    assignedUnitProgress: (input: { studentId: number; nowIso?: string }) =>
      invoke<AssignedUnitProgressRow[]>("progress.assignedUnitProgress", input),
    seenEntryIdsByLesson: (input: { studentId: number; lessonId: number }) =>
      invoke<number[]>("progress.seenEntryIdsByLesson", input),
    dueByStudent: (input: { studentId: number; nowIso?: string; limit?: number }) =>
      invoke<DueItem[]>("progress.dueByStudent", input),
    studentSummary: (input: { studentId: number }) =>
      invoke<StudentSummary>("progress.studentSummary", input),
    studyTargets: (input: { studentId: number }) =>
      invoke<StudyTargetsResult>("progress.studyTargets", input),
    weakItems: (input: { studentId: number; minAttempts?: number; limit?: number }) =>
      invoke<WeakItem[]>("progress.weakItems", input),
    dailyActivity: (input: { studentId: number; sinceIso: string; untilIso: string }) =>
      invoke<DailyActivityCell[]>("progress.dailyActivity", input),
    cohortActivity: (input: { sinceIso: string; untilIso: string }) =>
      invoke<CohortActivityCell[]>("progress.cohortActivity", input),
    recentSessions: (input: { studentId: number; limit?: number }) =>
      invoke<RecentSessionRow[]>("progress.recentSessions", input),
    unitReport: (input: { studentId: number }) =>
      invoke<UnitReportRow[]>("progress.unitReport", input),
    unitSessions: (input: { studentId: number; unitId: number; limit?: number }) =>
      invoke<UnitSessionReportRow[]>("progress.unitSessions", input),
    sessionReport: (input: { sessionId: number }) =>
      invoke<SessionLearningReport | null>("progress.sessionReport", input),
    tutorOverview: (input?: { nowIso?: string }) =>
      invoke<TutorOverviewRow[]>("progress.tutorOverview", input ?? {}),
    fleetSnapshot: (input?: { nowIso?: string }) =>
      invoke<FleetSnapshot>("progress.fleetSnapshot", input ?? {}),
  },

  evidence: {
    recordEvent: (input: EvidenceEventPayload) =>
      invoke<SessionEvidenceEvent>("evidence.recordEvent", input),
    recordEvents: (input: { events: EvidenceEventPayload[] }) =>
      invoke<SessionEvidenceEvent[]>("evidence.recordEvents", input),
    recordCameraSnapshot: (input: {
      studentId: number;
      sessionId: number;
      dataUrl: string;
      capturedAtIso?: string;
      intervalMs?: number;
      width?: number;
      height?: number;
    }) => invoke<SessionEvidenceEvent>("evidence.recordCameraSnapshot", input),
    studentOverview: (input: { studentId: number; limit?: number }) =>
      invoke<StudentEvidenceOverview>("evidence.studentOverview", input),
    tutorOverview: () => invoke<TutorEvidenceOverviewRow[]>("evidence.tutorOverview", {}),
    sessionTimeline: (input: { sessionId: number; includeSnapshots?: boolean }) =>
      invoke<StudentEvidenceTimeline | null>("evidence.sessionTimeline", input),
    exportStudentReport: (input: {
      studentId: number;
      includeSnapshots?: boolean;
      passphrase?: string;
    }) => invoke<EvidenceExportResult>("evidence.exportStudentReport", input),
    importStudentData: (input?: { passphrase?: string }) =>
      invoke<EvidenceImportResult>("evidence.importStudentData", input ?? {}),
  },

  pronunciation: {
    status: () => invoke<PronunciationStatus>("pronunciation.status"),
    target: (input: { text: string; ipa?: string | null }) =>
      invoke<PronunciationTarget>("pronunciation.target", input),
    composeIpa: (input: { texts: string[] }) =>
      invoke<Record<string, string | null>>("pronunciation.composeIpa", input),
    preview: (input: { text: string; ipa?: string | null }) =>
      invoke<PronunciationAssessment>("pronunciation.preview", input),
    warmup: () => invoke<{ ok: boolean; reason?: string }>("pronunciation.warmup"),
    cancel: () => invoke<{ cancelled: number }>("pronunciation.cancel"),
    assess: (input: {
      studentId: number;
      sessionId: number;
      targetText: string;
      ipa?: string | null;
      audioPcm?: Float32Array;
      sampleRate?: number;
    }) =>
      invoke<
        | { ok: true; assessment: PronunciationAssessment; status: PronunciationStatus }
        | { ok: false; status: PronunciationStatus; reason: string }
      >("pronunciation.assess", input),
  },

  rewards: {
    stats: (input: { studentId: number; nowIso?: string }) =>
      invoke<AchievementStats>("rewards.stats", input),
    listUnlocked: (input: { studentId: number }) =>
      invoke<StudentAchievement[]>("rewards.listUnlocked", input),
    streak: (input: { studentId: number; nowIso?: string }) =>
      invoke<StreakStats>("rewards.streak", input),
  },
} as const;

contextBridge.exposeInMainWorld("api", api);

export type AppApi = typeof api;
