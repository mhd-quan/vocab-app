import crypto from "node:crypto";
import { and, asc, eq, or } from "drizzle-orm";
import { APP_DISPLAY_NAME, APP_VERSION } from "../../../src/application/appInfo";
import {
  type StudentLogImportSummary,
  type StudentLogPackage,
  type SyncContentRef,
  studentLogPackageSchema,
} from "../../../src/application/sync/studentLog";
import {
  appSettings,
  books,
  contentItems,
  dictionaryLearningItems,
  grammarTopics,
  itemProgress,
  learningEvents,
  lessons,
  practiceSessions,
  studentAchievements,
  studentSyncIdentities,
  students,
  syncImportedEvents,
  syncImportedSessions,
  syncImports,
  unitAssignments,
  units,
  vocabEntries,
} from "../../../src/data/schema";
import type { AppDatabase, AppTransaction } from "../client";

const DEVICE_ID_KEY = "sync_device_id";

type SyncDb = AppDatabase | AppTransaction;

export interface ExportStudentLogInput {
  studentId: number;
  platform: string;
}

export function createSyncRepository(db: AppDatabase) {
  return {
    exportStudentLog({ studentId, platform }: ExportStudentLogInput): StudentLogPackage {
      const student = db.select().from(students).where(eq(students.id, studentId)).get();
      if (!student) throw new Error(`Student ${studentId} not found`);

      const syncId = ensureStudentSyncId(db, studentId);
      const deviceId = ensureDeviceId(db);
      const exportedAt = new Date();

      const sessions = db
        .select()
        .from(practiceSessions)
        .where(eq(practiceSessions.studentId, studentId))
        .orderBy(asc(practiceSessions.startedAt), asc(practiceSessions.id))
        .all()
        .map((session) => ({
          sourceSessionId: session.id,
          mode: session.mode,
          startedAt: toIso(session.startedAt),
          endedAt: toIsoNullable(session.endedAt),
          summary: session.summary ?? null,
        }));

      const events = selectLearningEventExportRows(db, studentId).map((row) => ({
        uid: `${deviceId}:learning:${row.eventId}`,
        sourceEventId: row.eventId,
        sourceSessionId: row.sessionId,
        contentRef: contentRefFromRow(row),
        kind: row.kind,
        payload: row.payload ?? null,
        occurredAt: toIso(row.occurredAt),
      }));

      const progress = selectItemProgressExportRows(db, studentId).map((row) => ({
        contentRef: contentRefFromRow(row),
        lastSeenAt: toIsoNullable(row.lastSeenAt),
        nextDueAt: toIsoNullable(row.nextDueAt),
        ease: row.ease,
        intervalDays: row.intervalDays,
        streak: row.streak,
        totalCorrect: row.totalCorrect,
        totalWrong: row.totalWrong,
        updatedAt: toIso(row.updatedAt),
      }));

      const assignments = db
        .select({
          bookCode: books.code,
          unitCode: units.code,
          unitOrdinal: units.ordinal,
          status: unitAssignments.status,
          assignedAt: unitAssignments.assignedAt,
          completedAt: unitAssignments.completedAt,
        })
        .from(unitAssignments)
        .innerJoin(units, eq(units.id, unitAssignments.unitId))
        .innerJoin(books, eq(books.id, units.bookId))
        .where(eq(unitAssignments.studentId, studentId))
        .orderBy(asc(books.code), asc(units.ordinal))
        .all()
        .map((row) => ({
          bookCode: row.bookCode,
          unitCode: row.unitCode,
          unitOrdinal: row.unitOrdinal,
          status: row.status,
          assignedAt: toIso(row.assignedAt),
          completedAt: toIsoNullable(row.completedAt),
        }));

      const achievements = db
        .select()
        .from(studentAchievements)
        .where(eq(studentAchievements.studentId, studentId))
        .orderBy(asc(studentAchievements.unlockedAt))
        .all()
        .map((row) => ({
          achievementId: row.achievementId,
          unlockedAt: toIso(row.unlockedAt),
        }));

      const dictionaryItems = db
        .select()
        .from(dictionaryLearningItems)
        .where(eq(dictionaryLearningItems.studentId, studentId))
        .orderBy(asc(dictionaryLearningItems.updatedAt), asc(dictionaryLearningItems.id))
        .all()
        .map((item) => ({
          dictionaryKey: item.dictionaryKey,
          headword: item.headword,
          pos: item.pos,
          ipa: item.ipa,
          cefrLevel: item.cefrLevel,
          definitionEn: item.definitionEn,
          definitionVi: item.definitionVi,
          exampleText: item.exampleText,
          exampleTranslation: item.exampleTranslation,
          audioRef: item.audioRef,
          status: item.status,
          stage: item.stage,
          correctInCycle: item.correctInCycle,
          shortTermCorrect: item.shortTermCorrect,
          totalCorrect: item.totalCorrect,
          totalWrong: item.totalWrong,
          score: item.score,
          lastReviewedAt: toIsoNullable(item.lastReviewedAt),
          nextDueAt: toIsoNullable(item.nextDueAt),
          createdAt: toIso(item.createdAt),
          updatedAt: toIso(item.updatedAt),
        }));

      return {
        format: "lexicon-lab.student-log",
        formatVersion: 1,
        packageId: crypto.randomUUID(),
        exportedAt: exportedAt.toISOString(),
        source: {
          deviceId,
          appName: APP_DISPLAY_NAME,
          appVersion: APP_VERSION,
          platform,
        },
        student: {
          syncId,
          name: student.name,
          displayName: student.displayName,
          avatarSeed: student.avatarSeed,
          color: student.color,
          createdAt: toIso(student.createdAt),
          updatedAt: toIso(student.updatedAt),
        },
        assignments,
        progress: {
          sessions,
          events,
          itemProgress: progress,
          achievements,
        },
        dictionaryLearning: {
          items: dictionaryItems,
        },
      };
    },

    importStudentLog(raw: unknown): StudentLogImportSummary {
      const pkg = studentLogPackageSchema.parse(raw);
      const existingImport = db
        .select()
        .from(syncImports)
        .where(eq(syncImports.packageId, pkg.packageId))
        .get();
      if (existingImport) {
        const identity = db
          .select()
          .from(studentSyncIdentities)
          .where(eq(studentSyncIdentities.syncId, pkg.student.syncId))
          .get();
        return emptyImportSummary(pkg, identity?.studentId ?? 0, false, true);
      }

      return db.transaction((tx) => {
        const studentResult = upsertSyncedStudent(tx, pkg);
        const localStudentId = studentResult.studentId;
        const sessionMap = new Map<number, number>();
        const summary = emptyImportSummary(
          pkg,
          localStudentId,
          studentResult.createdStudent,
          false,
        );

        for (const assignment of pkg.assignments) {
          const unitId = resolveUnitId(tx, {
            bookCode: assignment.bookCode,
            unitCode: assignment.unitCode,
            unitOrdinal: assignment.unitOrdinal,
          });
          if (!unitId) continue;
          tx.insert(unitAssignments)
            .values({
              studentId: localStudentId,
              unitId,
              status: assignment.status,
              assignedAt: fromIso(assignment.assignedAt),
              completedAt: fromIsoNullable(assignment.completedAt),
            })
            .onConflictDoNothing()
            .run();
        }

        for (const session of pkg.progress.sessions) {
          const existing = tx
            .select()
            .from(syncImportedSessions)
            .where(
              and(
                eq(syncImportedSessions.sourceDeviceId, pkg.source.deviceId),
                eq(syncImportedSessions.sourceSessionId, session.sourceSessionId),
              ),
            )
            .get();
          if (existing) {
            sessionMap.set(session.sourceSessionId, existing.localSessionId);
            summary.sessionsSkipped += 1;
            continue;
          }

          const inserted = tx
            .insert(practiceSessions)
            .values({
              studentId: localStudentId,
              mode: session.mode,
              startedAt: fromIso(session.startedAt),
              endedAt: fromIsoNullable(session.endedAt),
              summary: session.summary,
            })
            .returning()
            .get();
          if (!inserted) throw new Error("Failed to import practice session");
          tx.insert(syncImportedSessions)
            .values({
              sourceDeviceId: pkg.source.deviceId,
              sourceSessionId: session.sourceSessionId,
              localSessionId: inserted.id,
            })
            .run();
          sessionMap.set(session.sourceSessionId, inserted.id);
          summary.sessionsImported += 1;
        }

        for (const event of pkg.progress.events) {
          const existing = tx
            .select({ id: syncImportedEvents.id })
            .from(syncImportedEvents)
            .where(eq(syncImportedEvents.eventUid, event.uid))
            .get();
          if (existing) {
            summary.eventsSkipped += 1;
            continue;
          }

          const contentItemId = resolveContentItemId(tx, event.contentRef);
          if (!contentItemId) {
            summary.missingContentEvents += 1;
            continue;
          }

          const inserted = tx
            .insert(learningEvents)
            .values({
              studentId: localStudentId,
              contentItemId,
              sessionId:
                event.sourceSessionId === null
                  ? null
                  : (sessionMap.get(event.sourceSessionId) ?? null),
              kind: event.kind,
              payload: event.payload,
              occurredAt: fromIso(event.occurredAt),
            })
            .returning()
            .get();
          if (!inserted) throw new Error("Failed to import learning event");
          tx.insert(syncImportedEvents)
            .values({
              eventUid: event.uid,
              sourceDeviceId: pkg.source.deviceId,
              localEventId: inserted.id,
            })
            .run();
          summary.eventsImported += 1;
        }

        for (const incoming of pkg.progress.itemProgress) {
          const contentItemId = resolveContentItemId(tx, incoming.contentRef);
          if (!contentItemId) {
            summary.progressSkipped += 1;
            continue;
          }
          upsertImportedProgress(tx, localStudentId, contentItemId, incoming);
          summary.progressUpserted += 1;
        }

        for (const achievement of pkg.progress.achievements) {
          tx.insert(studentAchievements)
            .values({
              studentId: localStudentId,
              achievementId: achievement.achievementId,
              unlockedAt: fromIso(achievement.unlockedAt),
            })
            .onConflictDoNothing()
            .run();
          summary.achievementsImported += 1;
        }

        for (const item of pkg.dictionaryLearning.items) {
          upsertDictionaryLearningItem(tx, localStudentId, item);
          summary.dictionaryItemsUpserted += 1;
        }

        tx.insert(syncImports)
          .values({
            packageId: pkg.packageId,
            sourceDeviceId: pkg.source.deviceId,
            studentSyncId: pkg.student.syncId,
            exportedAt: fromIso(pkg.exportedAt),
            summary: summary as unknown as Record<string, unknown>,
          })
          .run();

        return summary;
      });
    },
  };
}

export type SyncRepository = ReturnType<typeof createSyncRepository>;

type ContentExportRow = {
  itemKind: (typeof contentItems.$inferSelect)["kind"];
  refTable: (typeof contentItems.$inferSelect)["refTable"];
  bookCode: string;
  unitCode: string;
  unitOrdinal: number;
  lessonSlug: string;
  lessonKind: (typeof lessons.$inferSelect)["kind"];
  vocabSourceId: string | null;
  vocabHeadword: string | null;
  grammarSourceId: string | null;
  grammarSlug: string | null;
  grammarTitle: string | null;
};

function selectLearningEventExportRows(db: AppDatabase, studentId: number) {
  return db
    .select({
      eventId: learningEvents.id,
      sessionId: learningEvents.sessionId,
      kind: learningEvents.kind,
      payload: learningEvents.payload,
      occurredAt: learningEvents.occurredAt,
      itemKind: contentItems.kind,
      refTable: contentItems.refTable,
      bookCode: books.code,
      unitCode: units.code,
      unitOrdinal: units.ordinal,
      lessonSlug: lessons.slug,
      lessonKind: lessons.kind,
      vocabSourceId: vocabEntries.sourceId,
      vocabHeadword: vocabEntries.headword,
      grammarSourceId: grammarTopics.sourceId,
      grammarSlug: grammarTopics.slug,
      grammarTitle: grammarTopics.title,
    })
    .from(learningEvents)
    .innerJoin(contentItems, eq(contentItems.id, learningEvents.contentItemId))
    .innerJoin(lessons, eq(lessons.id, contentItems.lessonId))
    .innerJoin(units, eq(units.id, lessons.unitId))
    .innerJoin(books, eq(books.id, units.bookId))
    .leftJoin(
      vocabEntries,
      and(eq(contentItems.refTable, "vocab_entries"), eq(contentItems.refId, vocabEntries.id)),
    )
    .leftJoin(
      grammarTopics,
      and(eq(contentItems.refTable, "grammar_topics"), eq(contentItems.refId, grammarTopics.id)),
    )
    .where(eq(learningEvents.studentId, studentId))
    .orderBy(asc(learningEvents.occurredAt), asc(learningEvents.id))
    .all();
}

function selectItemProgressExportRows(db: AppDatabase, studentId: number) {
  return db
    .select({
      lastSeenAt: itemProgress.lastSeenAt,
      nextDueAt: itemProgress.nextDueAt,
      ease: itemProgress.ease,
      intervalDays: itemProgress.intervalDays,
      streak: itemProgress.streak,
      totalCorrect: itemProgress.totalCorrect,
      totalWrong: itemProgress.totalWrong,
      updatedAt: itemProgress.updatedAt,
      itemKind: contentItems.kind,
      refTable: contentItems.refTable,
      bookCode: books.code,
      unitCode: units.code,
      unitOrdinal: units.ordinal,
      lessonSlug: lessons.slug,
      lessonKind: lessons.kind,
      vocabSourceId: vocabEntries.sourceId,
      vocabHeadword: vocabEntries.headword,
      grammarSourceId: grammarTopics.sourceId,
      grammarSlug: grammarTopics.slug,
      grammarTitle: grammarTopics.title,
    })
    .from(itemProgress)
    .innerJoin(contentItems, eq(contentItems.id, itemProgress.contentItemId))
    .innerJoin(lessons, eq(lessons.id, contentItems.lessonId))
    .innerJoin(units, eq(units.id, lessons.unitId))
    .innerJoin(books, eq(books.id, units.bookId))
    .leftJoin(
      vocabEntries,
      and(eq(contentItems.refTable, "vocab_entries"), eq(contentItems.refId, vocabEntries.id)),
    )
    .leftJoin(
      grammarTopics,
      and(eq(contentItems.refTable, "grammar_topics"), eq(contentItems.refId, grammarTopics.id)),
    )
    .where(eq(itemProgress.studentId, studentId))
    .orderBy(asc(books.code), asc(units.ordinal), asc(lessons.ordinal), asc(contentItems.id))
    .all();
}

function contentRefFromRow(row: ContentExportRow): SyncContentRef {
  return {
    kind: row.itemKind,
    refTable: row.refTable,
    bookCode: row.bookCode,
    unitCode: row.unitCode,
    unitOrdinal: row.unitOrdinal,
    lessonSlug: row.lessonSlug,
    lessonKind: row.lessonKind,
    sourceId: row.refTable === "vocab_entries" ? row.vocabSourceId : row.grammarSourceId,
    slug: row.refTable === "grammar_topics" ? row.grammarSlug : null,
    headword: row.refTable === "vocab_entries" ? row.vocabHeadword : null,
    title: row.refTable === "grammar_topics" ? row.grammarTitle : null,
  };
}

function ensureDeviceId(db: AppDatabase): string {
  const row = db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, DEVICE_ID_KEY))
    .get();
  if (typeof row?.value === "string" && row.value.length > 0) return row.value;

  const id = crypto.randomUUID();
  db.insert(appSettings)
    .values({ key: DEVICE_ID_KEY, value: id, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: id, updatedAt: new Date() },
    })
    .run();
  return id;
}

function ensureStudentSyncId(db: SyncDb, studentId: number): string {
  const row = db
    .select({ syncId: studentSyncIdentities.syncId })
    .from(studentSyncIdentities)
    .where(eq(studentSyncIdentities.studentId, studentId))
    .get();
  if (row) return row.syncId;

  const syncId = crypto.randomUUID();
  db.insert(studentSyncIdentities).values({ studentId, syncId }).run();
  return syncId;
}

function upsertSyncedStudent(
  tx: AppTransaction,
  pkg: StudentLogPackage,
): { studentId: number; createdStudent: boolean } {
  const identity = tx
    .select()
    .from(studentSyncIdentities)
    .where(eq(studentSyncIdentities.syncId, pkg.student.syncId))
    .get();
  if (identity) {
    const existing = tx.select().from(students).where(eq(students.id, identity.studentId)).get();
    if (!existing) throw new Error("Student sync identity points to a missing student");
    tx.update(students)
      .set({
        name: pkg.student.name,
        displayName: pkg.student.displayName,
        avatarSeed: pkg.student.avatarSeed,
        color: pkg.student.color,
        updatedAt: new Date(),
      })
      .where(eq(students.id, existing.id))
      .run();
    return { studentId: existing.id, createdStudent: false };
  }

  const inserted = tx
    .insert(students)
    .values({
      name: pkg.student.name,
      displayName: pkg.student.displayName,
      avatarSeed: pkg.student.avatarSeed,
      color: pkg.student.color,
      notes: null,
      createdAt: fromIso(pkg.student.createdAt),
      updatedAt: fromIso(pkg.student.updatedAt),
    })
    .returning()
    .get();
  if (!inserted) throw new Error("Failed to create synced student");
  tx.insert(studentSyncIdentities)
    .values({ studentId: inserted.id, syncId: pkg.student.syncId })
    .run();
  return { studentId: inserted.id, createdStudent: true };
}

function resolveUnitId(
  tx: AppTransaction,
  ref: { bookCode: string; unitCode: string; unitOrdinal: number },
): number | null {
  const row = tx
    .select({ unitId: units.id })
    .from(units)
    .innerJoin(books, eq(books.id, units.bookId))
    .where(
      and(
        eq(books.code, ref.bookCode),
        or(eq(units.code, ref.unitCode), eq(units.ordinal, ref.unitOrdinal)),
      ),
    )
    .get();
  return row?.unitId ?? null;
}

function resolveContentItemId(tx: AppTransaction, ref: SyncContentRef): number | null {
  const unitId = resolveUnitId(tx, ref);
  if (!unitId) return null;
  const lesson = tx
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.unitId, unitId), eq(lessons.slug, ref.lessonSlug)))
    .get();
  if (!lesson) return null;

  const refId =
    ref.refTable === "vocab_entries"
      ? resolveVocabEntryId(tx, lesson.id, ref)
      : ref.refTable === "grammar_topics"
        ? resolveGrammarTopicId(tx, lesson.id, ref)
        : null;
  if (!refId) return null;

  const item = tx
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(eq(contentItems.refTable, ref.refTable), eq(contentItems.refId, refId)))
    .get();
  return item?.id ?? null;
}

function resolveVocabEntryId(
  tx: AppTransaction,
  lessonId: number,
  ref: SyncContentRef,
): number | null {
  if (ref.sourceId) {
    const bySource = tx
      .select({ id: vocabEntries.id })
      .from(vocabEntries)
      .where(and(eq(vocabEntries.lessonId, lessonId), eq(vocabEntries.sourceId, ref.sourceId)))
      .get();
    if (bySource) return bySource.id;
  }
  if (!ref.headword) return null;
  const byHeadword = tx
    .select({ id: vocabEntries.id })
    .from(vocabEntries)
    .where(and(eq(vocabEntries.lessonId, lessonId), eq(vocabEntries.headword, ref.headword)))
    .orderBy(asc(vocabEntries.id))
    .get();
  return byHeadword?.id ?? null;
}

function resolveGrammarTopicId(
  tx: AppTransaction,
  lessonId: number,
  ref: SyncContentRef,
): number | null {
  if (ref.sourceId) {
    const bySource = tx
      .select({ id: grammarTopics.id })
      .from(grammarTopics)
      .where(and(eq(grammarTopics.lessonId, lessonId), eq(grammarTopics.sourceId, ref.sourceId)))
      .get();
    if (bySource) return bySource.id;
  }
  if (ref.slug) {
    const bySlug = tx
      .select({ id: grammarTopics.id })
      .from(grammarTopics)
      .where(and(eq(grammarTopics.lessonId, lessonId), eq(grammarTopics.slug, ref.slug)))
      .get();
    if (bySlug) return bySlug.id;
  }
  if (!ref.title) return null;
  const byTitle = tx
    .select({ id: grammarTopics.id })
    .from(grammarTopics)
    .where(and(eq(grammarTopics.lessonId, lessonId), eq(grammarTopics.title, ref.title)))
    .orderBy(asc(grammarTopics.id))
    .get();
  return byTitle?.id ?? null;
}

function upsertImportedProgress(
  tx: AppTransaction,
  studentId: number,
  contentItemId: number,
  incoming: StudentLogPackage["progress"]["itemProgress"][number],
): void {
  const existing = tx
    .select()
    .from(itemProgress)
    .where(
      and(eq(itemProgress.studentId, studentId), eq(itemProgress.contentItemId, contentItemId)),
    )
    .get();
  const updatedAt = fromIso(incoming.updatedAt);

  if (!existing) {
    tx.insert(itemProgress)
      .values({
        studentId,
        contentItemId,
        lastSeenAt: fromIsoNullable(incoming.lastSeenAt),
        nextDueAt: fromIsoNullable(incoming.nextDueAt),
        ease: incoming.ease,
        intervalDays: incoming.intervalDays,
        streak: incoming.streak,
        totalCorrect: incoming.totalCorrect,
        totalWrong: incoming.totalWrong,
        updatedAt,
      })
      .run();
    return;
  }

  const incomingIsNewer = updatedAt.getTime() >= existing.updatedAt.getTime();
  tx.update(itemProgress)
    .set({
      lastSeenAt: incomingIsNewer ? fromIsoNullable(incoming.lastSeenAt) : existing.lastSeenAt,
      nextDueAt: incomingIsNewer ? fromIsoNullable(incoming.nextDueAt) : existing.nextDueAt,
      ease: incomingIsNewer ? incoming.ease : existing.ease,
      intervalDays: incomingIsNewer ? incoming.intervalDays : existing.intervalDays,
      streak: incomingIsNewer ? incoming.streak : existing.streak,
      totalCorrect: Math.max(existing.totalCorrect, incoming.totalCorrect),
      totalWrong: Math.max(existing.totalWrong, incoming.totalWrong),
      updatedAt: incomingIsNewer ? updatedAt : existing.updatedAt,
    })
    .where(
      and(eq(itemProgress.studentId, studentId), eq(itemProgress.contentItemId, contentItemId)),
    )
    .run();
}

function upsertDictionaryLearningItem(
  tx: AppTransaction,
  studentId: number,
  incoming: StudentLogPackage["dictionaryLearning"]["items"][number],
): void {
  const existing = tx
    .select()
    .from(dictionaryLearningItems)
    .where(
      and(
        eq(dictionaryLearningItems.studentId, studentId),
        eq(dictionaryLearningItems.dictionaryKey, incoming.dictionaryKey),
      ),
    )
    .get();
  const updatedAt = fromIso(incoming.updatedAt);

  if (!existing) {
    tx.insert(dictionaryLearningItems)
      .values({
        studentId,
        dictionaryKey: incoming.dictionaryKey,
        headword: incoming.headword,
        pos: incoming.pos,
        ipa: incoming.ipa,
        cefrLevel: incoming.cefrLevel,
        definitionEn: incoming.definitionEn,
        definitionVi: incoming.definitionVi,
        exampleText: incoming.exampleText,
        exampleTranslation: incoming.exampleTranslation,
        audioRef: incoming.audioRef,
        status: incoming.status,
        stage: incoming.stage,
        correctInCycle: incoming.correctInCycle,
        shortTermCorrect: incoming.shortTermCorrect,
        totalCorrect: incoming.totalCorrect,
        totalWrong: incoming.totalWrong,
        score: incoming.score,
        lastReviewedAt: fromIsoNullable(incoming.lastReviewedAt),
        nextDueAt: fromIsoNullable(incoming.nextDueAt),
        createdAt: fromIso(incoming.createdAt),
        updatedAt,
      })
      .run();
    return;
  }

  const incomingIsNewer = updatedAt.getTime() >= existing.updatedAt.getTime();
  tx.update(dictionaryLearningItems)
    .set({
      headword: incoming.headword,
      pos: incoming.pos,
      ipa: incoming.ipa,
      cefrLevel: incoming.cefrLevel,
      definitionEn: incoming.definitionEn,
      definitionVi: incoming.definitionVi,
      exampleText: incoming.exampleText,
      exampleTranslation: incoming.exampleTranslation,
      audioRef: incoming.audioRef,
      status: incomingIsNewer ? incoming.status : existing.status,
      stage: incomingIsNewer ? incoming.stage : existing.stage,
      correctInCycle: Math.max(existing.correctInCycle, incoming.correctInCycle),
      shortTermCorrect: Math.max(existing.shortTermCorrect, incoming.shortTermCorrect),
      totalCorrect: Math.max(existing.totalCorrect, incoming.totalCorrect),
      totalWrong: Math.max(existing.totalWrong, incoming.totalWrong),
      score: Math.max(existing.score, incoming.score),
      lastReviewedAt: incomingIsNewer
        ? fromIsoNullable(incoming.lastReviewedAt)
        : existing.lastReviewedAt,
      nextDueAt: incomingIsNewer ? fromIsoNullable(incoming.nextDueAt) : existing.nextDueAt,
      updatedAt: incomingIsNewer ? updatedAt : existing.updatedAt,
    })
    .where(eq(dictionaryLearningItems.id, existing.id))
    .run();
}

function emptyImportSummary(
  pkg: StudentLogPackage,
  studentId: number,
  createdStudent: boolean,
  alreadyImported: boolean,
): StudentLogImportSummary {
  return {
    packageId: pkg.packageId,
    studentId,
    studentName: pkg.student.displayName ?? pkg.student.name,
    createdStudent,
    alreadyImported,
    sessionsImported: 0,
    sessionsSkipped: 0,
    eventsImported: 0,
    eventsSkipped: 0,
    missingContentEvents: 0,
    progressUpserted: 0,
    progressSkipped: 0,
    achievementsImported: 0,
    dictionaryItemsUpserted: 0,
  };
}

function toIso(value: Date): string {
  return value.toISOString();
}

function toIsoNullable(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function fromIso(value: string): Date {
  return new Date(value);
}

function fromIsoNullable(value: string | null): Date | null {
  return value ? new Date(value) : null;
}
