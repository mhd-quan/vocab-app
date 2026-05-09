import { contextBridge, ipcRenderer } from "electron";
import type { LessonKind } from "../src/data/schema";
import type { Book, Lesson, Student, Unit, VocabEntry } from "../src/data/types";
import type { VocabEntryFull } from "./db/repositories/vocab";

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

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
} as const;

contextBridge.exposeInMainWorld("api", api);

export type AppApi = typeof api;
