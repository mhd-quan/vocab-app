import { contextBridge, ipcRenderer } from "electron";
import type { LessonKind, PracticeMode } from "../src/data/schema";
import type {
  Book,
  ImportItem,
  ImportRun,
  ItemProgress,
  LearningEvent,
  Lesson,
  PracticeSession,
  Student,
  Unit,
  VocabEntry,
} from "../src/data/types";
import type { SelfGrade } from "../src/modules/exercises/types";
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
    version: "0.0.1",
    platform: process.platform,
  },

  meta: {
    ping: () => invoke<"pong">("meta.ping"),
    appInfo: () =>
      invoke<{ name: string; version: string; schemaTablesExpected: number }>("meta.appInfo"),
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
  },

  vocab: {
    listByLesson: (input: { lessonId: number }) =>
      invoke<VocabEntry[]>("vocab.listByLesson", input),
    listFullByLesson: (input: { lessonId: number }) =>
      invoke<VocabEntryFull[]>("vocab.listFullByLesson", input),
    countByLesson: (input: { lessonId: number }) => invoke<number>("vocab.countByLesson", input),
    getById: (input: { id: number }) => invoke<VocabEntryFull | null>("vocab.getById", input),
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
      occurredAtIso?: string;
    }) => invoke<{ event: LearningEvent; progress: ItemProgress }>("progress.recordAnswer", input),
    dueByLesson: (input: { studentId: number; lessonId: number; nowIso?: string }) =>
      invoke<DueLessonStats>("progress.dueByLesson", input),
    dueByStudent: (input: { studentId: number; nowIso?: string; limit?: number }) =>
      invoke<DueItem[]>("progress.dueByStudent", input),
    studentSummary: (input: { studentId: number }) =>
      invoke<StudentSummary>("progress.studentSummary", input),
  },
} as const;

contextBridge.exposeInMainWorld("api", api);

export type AppApi = typeof api;
