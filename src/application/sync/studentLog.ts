import { z } from "zod";
import {
  cefrLevels,
  contentItemKinds,
  contentItemRefTables,
  dictionaryLearningStages,
  dictionaryLearningStatuses,
  learningEventKinds,
  lessonKinds,
  partsOfSpeech,
  practiceModes,
} from "../../data/schema";

export const STUDENT_LOG_FORMAT = "lexicon-lab.student-log";
export const STUDENT_LOG_VERSION = 1;

const isoDate = z.string().datetime();
const nullableIsoDate = isoDate.nullable();

export const syncContentRefSchema = z.object({
  kind: z.enum(contentItemKinds),
  refTable: z.enum(contentItemRefTables),
  bookCode: z.string().min(1),
  unitCode: z.string().min(1),
  unitOrdinal: z.number().int().positive(),
  lessonSlug: z.string().min(1),
  lessonKind: z.enum(lessonKinds),
  sourceId: z.string().nullable(),
  slug: z.string().nullable(),
  headword: z.string().nullable(),
  title: z.string().nullable(),
});

const studentSchema = z.object({
  syncId: z.string().uuid(),
  name: z.string().min(1).max(80),
  displayName: z.string().max(80).nullable(),
  avatarSeed: z.string().max(180_000).nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const assignmentSchema = z.object({
  bookCode: z.string().min(1),
  unitCode: z.string().min(1),
  unitOrdinal: z.number().int().positive(),
  status: z.enum(["assigned", "paused", "completed"]),
  assignedAt: isoDate,
  completedAt: nullableIsoDate,
});

const sessionSchema = z.object({
  sourceSessionId: z.number().int().positive(),
  mode: z.enum(practiceModes),
  startedAt: isoDate,
  endedAt: nullableIsoDate,
  summary: z.record(z.unknown()).nullable(),
});

const eventSchema = z.object({
  uid: z.string().min(1),
  sourceEventId: z.number().int().positive(),
  sourceSessionId: z.number().int().positive().nullable(),
  contentRef: syncContentRefSchema,
  kind: z.enum(learningEventKinds),
  payload: z.record(z.unknown()).nullable(),
  occurredAt: isoDate,
});

const itemProgressSchema = z.object({
  contentRef: syncContentRefSchema,
  lastSeenAt: nullableIsoDate,
  nextDueAt: nullableIsoDate,
  ease: z.number().int().nullable(),
  intervalDays: z.number().int().nullable(),
  streak: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  totalWrong: z.number().int().nonnegative(),
  updatedAt: isoDate,
});

const achievementSchema = z.object({
  achievementId: z.string().min(1),
  unlockedAt: isoDate,
});

const dictionaryLearningItemSchema = z.object({
  dictionaryKey: z.string().min(1),
  headword: z.string().min(1),
  pos: z.enum(partsOfSpeech),
  ipa: z.string().nullable(),
  cefrLevel: z.enum(cefrLevels).nullable(),
  definitionEn: z.string().min(1),
  definitionVi: z.string().nullable(),
  exampleText: z.string().nullable(),
  exampleTranslation: z.string().nullable(),
  audioRef: z.string().nullable(),
  audioRefs: z
    .array(
      z.object({
        ref: z.string().min(1),
        label: z.string().min(1),
        accent: z.enum(["uk", "us", "other"]),
      }),
    )
    .optional()
    .default([]),
  status: z.enum(dictionaryLearningStatuses),
  stage: z.enum(dictionaryLearningStages),
  correctInCycle: z.number().int().nonnegative(),
  shortTermCorrect: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  totalWrong: z.number().int().nonnegative(),
  score: z.number().int().min(0).max(100),
  lastReviewedAt: nullableIsoDate,
  nextDueAt: nullableIsoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const studentLogPackageSchema = z.object({
  format: z.literal(STUDENT_LOG_FORMAT),
  formatVersion: z.literal(STUDENT_LOG_VERSION),
  packageId: z.string().uuid(),
  exportedAt: isoDate,
  source: z.object({
    deviceId: z.string().uuid(),
    appName: z.string().min(1),
    appVersion: z.string().min(1),
    platform: z.string().min(1),
  }),
  student: studentSchema,
  assignments: z.array(assignmentSchema),
  progress: z.object({
    sessions: z.array(sessionSchema),
    events: z.array(eventSchema),
    itemProgress: z.array(itemProgressSchema),
    achievements: z.array(achievementSchema),
  }),
  dictionaryLearning: z.object({
    items: z.array(dictionaryLearningItemSchema),
  }),
});

export type SyncContentRef = z.infer<typeof syncContentRefSchema>;
export type StudentLogPackage = z.infer<typeof studentLogPackageSchema>;

export interface StudentLogExportSummary {
  packageId: string;
  studentName: string;
  fileName: string;
  exportedAt: string;
  sessions: number;
  events: number;
  progressItems: number;
  dictionaryItems: number;
}

export interface StudentLogImportSummary {
  packageId: string;
  studentId: number;
  studentName: string;
  createdStudent: boolean;
  alreadyImported: boolean;
  sessionsImported: number;
  sessionsSkipped: number;
  eventsImported: number;
  eventsSkipped: number;
  missingContentEvents: number;
  progressUpserted: number;
  progressSkipped: number;
  achievementsImported: number;
  dictionaryItemsUpserted: number;
}
