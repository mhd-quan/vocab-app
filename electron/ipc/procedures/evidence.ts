import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { app, dialog } from "electron";
import { z } from "zod";
import {
  books,
  contentItems,
  dictionaryLearningItems,
  dictionaryLearningReviews,
  dictionarySearchEvents,
  enrollments,
  grammarTopics,
  itemProgress,
  learningEvents,
  lessons,
  practiceSessions,
  sessionEvidenceEventKinds,
  sessionEvidenceEvents,
  sessionEvidenceSeverities,
  studentAchievements,
  unitAssignments,
  units,
  vocabEntries,
} from "../../../src/data/schema";
import type { AppDatabase } from "../../db";
import type { StudentEvidenceTimeline } from "../../db/repositories/evidence";
import { type ProcedureContext, defineProcedure } from "../procedure";

const evidenceEventInput = z.object({
  studentId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  kind: z.enum(sessionEvidenceEventKinds),
  severity: z.enum(sessionEvidenceSeverities).optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  payload: z.record(z.unknown()).nullable().optional(),
  occurredAtIso: z.string().datetime().optional(),
});

const recordEventsInput = z.object({
  events: z.array(evidenceEventInput).max(50),
});

const cameraSnapshotInput = z.object({
  studentId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  dataUrl: z.string().max(7_000_000),
  capturedAtIso: z.string().datetime().optional(),
  intervalMs: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const studentInput = z.object({
  studentId: z.number().int().positive(),
  limit: z.number().int().positive().max(100).optional(),
});

const sessionTimelineInput = z.object({
  sessionId: z.number().int().positive(),
  includeSnapshots: z.boolean().optional(),
});

const exportReportInput = z.object({
  studentId: z.number().int().positive(),
  includeSnapshots: z.boolean().optional(),
  passphrase: z.string().min(8).max(256).optional(),
});

const importStudentDataInput = z.object({
  passphrase: z.string().min(8).max(256).optional(),
});

export const evidenceProcedures = [
  defineProcedure({
    name: "evidence.recordEvent",
    input: evidenceEventInput,
    handler: (input, ctx) =>
      ctx.repos.evidence.recordEvent({
        studentId: input.studentId,
        sessionId: input.sessionId,
        kind: input.kind,
        severity: input.severity,
        durationMs: input.durationMs,
        payload: input.payload,
        occurredAt: input.occurredAtIso ? new Date(input.occurredAtIso) : new Date(),
      }),
  }),

  defineProcedure({
    name: "evidence.recordEvents",
    input: recordEventsInput,
    handler: ({ events }, ctx) =>
      ctx.repos.evidence.recordEvents(
        events.map((input) => ({
          studentId: input.studentId,
          sessionId: input.sessionId,
          kind: input.kind,
          severity: input.severity,
          durationMs: input.durationMs,
          payload: input.payload,
          occurredAt: input.occurredAtIso ? new Date(input.occurredAtIso) : new Date(),
        })),
      ),
  }),

  defineProcedure({
    name: "evidence.recordCameraSnapshot",
    input: cameraSnapshotInput,
    handler: async (input, ctx) => {
      const parsed = parseSnapshotDataUrl(input.dataUrl);
      const capturedAt = input.capturedAtIso ? new Date(input.capturedAtIso) : new Date();
      const relativePath = await writeSnapshotFile(input.sessionId, capturedAt, parsed);
      const sha256 = crypto.createHash("sha256").update(parsed.buffer).digest("hex");

      return ctx.repos.evidence.recordEvent({
        studentId: input.studentId,
        sessionId: input.sessionId,
        kind: "camera_snapshot",
        severity: "info",
        occurredAt: capturedAt,
        payload: {
          fileName: relativePath,
          mimeType: parsed.mimeType,
          bytes: parsed.buffer.byteLength,
          sha256,
          intervalMs: input.intervalMs ?? null,
          width: input.width ?? null,
          height: input.height ?? null,
          visibleIndicator: true,
        },
      });
    },
  }),

  defineProcedure({
    name: "evidence.studentOverview",
    input: studentInput,
    handler: ({ studentId, limit }, ctx) =>
      ctx.repos.evidence.studentOverview({ studentId, limit }),
  }),

  defineProcedure({
    name: "evidence.tutorOverview",
    input: z.object({}).optional(),
    handler: (_input, ctx) => ctx.repos.evidence.tutorOverview(),
  }),

  defineProcedure({
    name: "evidence.sessionTimeline",
    input: sessionTimelineInput,
    handler: ({ sessionId, includeSnapshots }, ctx) => {
      const timeline = ctx.repos.evidence.sessionTimeline({ sessionId });
      if (!timeline) return null;
      return includeSnapshots ? serializeTimeline(timeline, true) : timeline;
    },
  }),

  defineProcedure({
    name: "evidence.exportStudentReport",
    input: exportReportInput,
    handler: async ({ studentId, includeSnapshots, passphrase }, ctx) => {
      const generatedAt = new Date();
      const { student, payload, data, counts } = buildStudentHistoryExport(
        ctx,
        studentId,
        includeSnapshots === true,
        generatedAt,
      );

      const payloadJson = JSON.stringify(payload, jsonDateReplacer, 2);
      const sha256 = crypto.createHash("sha256").update(payloadJson).digest("hex");
      const bundle = {
        schemaVersion: "vocab.report-bundle.v1",
        generatedAt: generatedAt.toISOString(),
        manifest: {
          reportSha256: sha256,
          encrypted: Boolean(passphrase),
          cameraSnapshotsIncluded: includeSnapshots === true,
          sessionCount: counts.sessionCount,
          learningEventCount: counts.learningEventCount,
          evidenceEventCount: counts.evidenceEventCount,
          snapshotCount: data.evidenceEvents.filter((event) => event.kind === "camera_snapshot")
            .length,
        },
        report: passphrase
          ? encryptReport(payloadJson, passphrase, sha256, generatedAt)
          : { ...payload, integrity: { sha256 } },
      };
      const body = JSON.stringify(bundle, jsonDateReplacer, 2);

      const defaultPath = `${safeFilename(student.displayName ?? student.name)}-student-history-${formatStamp(
        generatedAt,
      )}${passphrase ? ".vocab-report-bundle.enc.json" : ".vocab-report-bundle.json"}`;
      const dialogOptions = {
        title: "Export complete student history",
        defaultPath,
        filters: [
          {
            name: passphrase ? "Encrypted Vocab Report Bundle" : "Vocab Report Bundle",
            extensions: passphrase ? ["enc.json"] : ["json"],
          },
        ],
      };
      const parent = ctx.getMainWindow?.() ?? null;
      const result = parent
        ? await dialog.showSaveDialog(parent, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) {
        return {
          canceled: true,
          filePath: null,
          encrypted: Boolean(passphrase),
          sha256,
          ...counts,
        } as const;
      }

      fs.writeFileSync(result.filePath, body, "utf8");
      return {
        canceled: false,
        filePath: result.filePath,
        encrypted: Boolean(passphrase),
        sha256,
        ...counts,
      } as const;
    },
  }),

  defineProcedure({
    name: "evidence.importStudentData",
    input: importStudentDataInput,
    handler: async ({ passphrase }, ctx) => {
      const parent = ctx.getMainWindow?.() ?? null;
      const result = parent
        ? await dialog.showOpenDialog(parent, {
            title: "Import student data bundle",
            properties: ["openFile"],
            filters: [{ name: "Vocab Report Bundle", extensions: ["json", "enc.json"] }],
          })
        : await dialog.showOpenDialog({
            title: "Import student data bundle",
            properties: ["openFile"],
            filters: [{ name: "Vocab Report Bundle", extensions: ["json", "enc.json"] }],
          });
      if (result.canceled || !result.filePaths[0]) {
        return { canceled: true, imported: false, studentId: null, stats: null } as const;
      }
      const body = fs.readFileSync(result.filePaths[0], "utf8");
      const bundle = parseReportBundle(body, passphrase);
      const stats = importStudentDataBundle(ctx, bundle);
      return {
        canceled: false,
        imported: true,
        studentId: stats.studentId,
        stats,
      } as const;
    },
  }),
];

interface StudentDataExport {
  schemaVersion: "vocab.student-data.v1";
  sourceFingerprint: string;
  sourceStudentId: number;
  exportedAt: string;
  student: Record<string, unknown>;
  assignments: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  learningEvents: Array<Record<string, unknown> & { contentRef: ContentRef | null }>;
  itemProgress: Array<Record<string, unknown> & { contentRef: ContentRef | null }>;
  achievements: Array<Record<string, unknown>>;
  evidenceEvents: Array<Record<string, unknown>>;
  dictionary: {
    searches: Array<Record<string, unknown>>;
    items: Array<Record<string, unknown>>;
    reviews: Array<Record<string, unknown>>;
  };
}

interface StudentHistoryExportCounts {
  sessionCount: number;
  learningEventCount: number;
  evidenceEventCount: number;
}

function buildStudentHistoryExport(
  ctx: ProcedureContext,
  studentId: number,
  includeSnapshots: boolean,
  generatedAt: Date,
) {
  const sourceStudent = ctx.repos.students.getById(studentId);
  if (!sourceStudent) throw new Error(`Student ${studentId} not found`);
  const student = studentWithoutPin(sourceStudent);
  const data = buildStudentDataExport(ctx, studentId, includeSnapshots, generatedAt);

  // These are full-history repository reads, intentionally separate from the
  // UI's recent-session APIs and their display limits.
  const evidenceTimelines = ctx.repos.evidence.studentSessionTimelines({ studentId });
  const progressSessions = ctx.repos.progress.studentSessionReports({ studentId });
  const serializedTimelines = evidenceTimelines.map((timeline) =>
    serializeTimeline(timeline, includeSnapshots),
  );
  const overview = ctx.repos.evidence.studentOverview({ studentId, limit: 0 });
  const counts: StudentHistoryExportCounts = {
    sessionCount: data.sessions.length,
    learningEventCount: data.learningEvents.length,
    evidenceEventCount: data.evidenceEvents.length,
  };

  const payload = {
    // Keep this schema identifier stable so previously released importers can
    // continue to consume the universal bundle's `data` section.
    schemaVersion: "vocab.session-report.v2",
    generatedAt: generatedAt.toISOString(),
    app: { name: "vocab-app" },
    student,
    data,
    progress: {
      summary: ctx.repos.progress.studentSummary({ studentId, now: generatedAt }),
      units: ctx.repos.progress.unitReport({ studentId }),
      weakItems: ctx.repos.progress.weakItems({ studentId, minAttempts: 3, limit: 25 }),
      // The property name is retained for bundle compatibility; an exported
      // history now contains every session rather than a recent-only slice.
      recentSessions: progressSessions.map((report) => ({
        sessionId: report.session.id,
        mode: report.session.mode,
        startedAt: report.session.startedAt,
        endedAt: report.session.endedAt,
        totalAnswered: report.totalAnswered,
        totalCorrect: report.totalCorrect,
      })),
      sessions: progressSessions,
    },
    evidence: {
      overview: {
        ...overview,
        recentSessions: evidenceTimelines.map((timeline) => ({
          sessionId: timeline.session.id,
          studentId: timeline.session.studentId,
          mode: timeline.session.mode,
          startedAt: timeline.session.startedAt,
          endedAt: timeline.session.endedAt,
          eventCount: timeline.events.length,
          lastEventAt: timeline.events.at(-1)?.occurredAt ?? null,
          metrics: timeline.metrics,
        })),
      },
      sessions: serializedTimelines,
      safeguards: {
        cameraSnapshotsIncluded: includeSnapshots,
        cameraMode: "tutor-enabled consent ledger with visible check-in indicator",
        verdictPolicy: "review signals only; no hidden surveillance or biometric inference",
      },
    },
  };

  return { student, data, payload, counts };
}

interface ContentRef {
  refTable: string;
  refId: number;
  kind: string;
  bookCode: string | null;
  unitCode: string | null;
  lessonSlug: string | null;
  lessonKind: string | null;
  sourceId: string | null;
  slug: string | null;
  headword: string | null;
}

function buildStudentDataExport(
  ctx: ProcedureContext,
  studentId: number,
  includeSnapshots: boolean,
  exportedAt = new Date(),
): StudentDataExport {
  const db = requireDb(ctx);
  const student = ctx.repos.students.getById(studentId);
  if (!student) throw new Error(`Student ${studentId} not found`);
  const sourceFingerprint = studentSourceFingerprint(student);
  const sessions = db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.studentId, studentId))
    .all();
  const sessionIds = new Set(sessions.map((session) => session.id));
  const learningRows = db
    .select()
    .from(learningEvents)
    .where(eq(learningEvents.studentId, studentId))
    .all();
  const evidenceRows = db
    .select()
    .from(sessionEvidenceEvents)
    .where(eq(sessionEvidenceEvents.studentId, studentId))
    .all()
    .filter((event) => sessionIds.has(event.sessionId));

  return {
    schemaVersion: "vocab.student-data.v1",
    sourceFingerprint,
    sourceStudentId: studentId,
    exportedAt: exportedAt.toISOString(),
    student: studentWithoutPin(student),
    assignments: exportAssignments(db, studentId),
    sessions,
    learningEvents: learningRows.map((event) => ({
      ...event,
      contentRef: contentRefForItem(db, event.contentItemId),
    })),
    itemProgress: db
      .select()
      .from(itemProgress)
      .where(eq(itemProgress.studentId, studentId))
      .all()
      .map((row) => ({ ...row, contentRef: contentRefForItem(db, row.contentItemId) })),
    achievements: db
      .select()
      .from(studentAchievements)
      .where(eq(studentAchievements.studentId, studentId))
      .all(),
    evidenceEvents: evidenceRows.map((event) =>
      includeSnapshots && event.kind === "camera_snapshot" && event.payload?.fileName
        ? {
            ...event,
            payload: {
              ...event.payload,
              snapshotDataUrl: readSnapshotDataUrl(String(event.payload.fileName)),
            },
          }
        : event,
    ),
    dictionary: {
      searches: db
        .select()
        .from(dictionarySearchEvents)
        .where(eq(dictionarySearchEvents.studentId, studentId))
        .all(),
      items: db
        .select()
        .from(dictionaryLearningItems)
        .where(eq(dictionaryLearningItems.studentId, studentId))
        .all(),
      reviews: db
        .select()
        .from(dictionaryLearningReviews)
        .where(eq(dictionaryLearningReviews.studentId, studentId))
        .all(),
    },
  };
}

function importStudentDataBundle(ctx: ProcedureContext, report: Record<string, unknown>) {
  const db = requireDb(ctx);
  const data = report.data as StudentDataExport | undefined;
  if (!data || data.schemaVersion !== "vocab.student-data.v1") {
    throw new Error("This report does not contain an importable student data bundle.");
  }

  const studentId = upsertImportedStudent(ctx, data);
  return db.transaction((tx) => {
    const txDb = tx as unknown as AppDatabase;
    const sessionMap = upsertImportedSessions(txDb, studentId, data);
    const dictionaryStats = upsertDictionaryData(txDb, studentId, data, sessionMap.map);
    const stats = {
      studentId,
      sessionsInserted: 0,
      sessionsUpdated: 0,
      learningEventsInserted: 0,
      learningEventsSkipped: 0,
      evidenceEventsInserted: 0,
      evidenceEventsSkipped: 0,
      progressUpserted: 0,
      achievementsUpserted: 0,
      dictionaryItemsUpserted: dictionaryStats.itemMap.size,
      dictionarySearchesInserted: dictionaryStats.searchesInserted,
      dictionarySearchesSkipped: dictionaryStats.searchesSkipped,
      assignmentsUpserted: 0,
    };
    stats.sessionsInserted = sessionMap.inserted;
    stats.sessionsUpdated = sessionMap.updated;
    stats.assignmentsUpserted = upsertAssignments(txDb, studentId, data);
    stats.progressUpserted = upsertImportedProgress(txDb, studentId, data);
    const learningStats = importLearningEvents(txDb, studentId, data, sessionMap.map);
    stats.learningEventsInserted = learningStats.inserted;
    stats.learningEventsSkipped = learningStats.skipped;
    const evidenceStats = importEvidenceEvents(txDb, studentId, data, sessionMap.map);
    stats.evidenceEventsInserted = evidenceStats.inserted;
    stats.evidenceEventsSkipped = evidenceStats.skipped;
    stats.achievementsUpserted = upsertAchievements(txDb, studentId, data);
    return stats;
  });
}

function upsertImportedStudent(ctx: ProcedureContext, data: StudentDataExport): number {
  const mapped = ctx.repos.settings.get<number>(importMapKey(data.sourceFingerprint));
  const mappedStudent = typeof mapped === "number" ? ctx.repos.students.getById(mapped) : null;
  if (typeof mapped === "number" && mappedStudent) {
    if (mappedStudent.archivedAt) ctx.repos.students.restore(mapped);
    const student = data.student;
    ctx.repos.students.update(mapped, {
      name: stringValue(student.name, "Imported student"),
      displayName: nullableString(student.displayName),
      avatarSeed: nullableString(student.avatarSeed),
      color: nullableString(student.color),
      notes: nullableString(student.notes),
    });
    return mapped;
  }
  const created = ctx.repos.students.create({
    name: stringValue(data.student.name, "Imported student"),
    displayName: nullableString(data.student.displayName) ?? undefined,
    avatarSeed: nullableString(data.student.avatarSeed) ?? undefined,
    color: nullableString(data.student.color) ?? undefined,
    notes: nullableString(data.student.notes) ?? undefined,
  });
  ctx.repos.settings.set(importMapKey(data.sourceFingerprint), created.id);
  return created.id;
}

function upsertImportedSessions(db: AppDatabase, studentId: number, data: StudentDataExport) {
  const map = new Map<number, number>();
  let inserted = 0;
  let updated = 0;
  const existing = db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.studentId, studentId))
    .all();
  const bySource = new Map<number, (typeof existing)[number]>();
  for (const session of existing) {
    const marker = importSource(session.summary);
    if (marker?.fingerprint === data.sourceFingerprint && marker.sessionId !== undefined) {
      bySource.set(marker.sessionId, session);
    }
  }
  for (const raw of data.sessions) {
    const sourceSessionId = numberValue(raw.id);
    if (sourceSessionId === null) continue;
    const summary = {
      ...(isRecord(raw.summary) ? raw.summary : {}),
      __importSource: { fingerprint: data.sourceFingerprint, sessionId: sourceSessionId },
    };
    const found = bySource.get(sourceSessionId);
    if (found) {
      db.update(practiceSessions)
        .set({
          mode: stringValue(raw.mode, found.mode) as typeof found.mode,
          startedAt: dateValue(raw.startedAt) ?? found.startedAt,
          endedAt: dateValue(raw.endedAt),
          summary,
        })
        .where(eq(practiceSessions.id, found.id))
        .run();
      map.set(sourceSessionId, found.id);
      updated += 1;
      continue;
    }
    const row = db
      .insert(practiceSessions)
      .values({
        studentId,
        mode: stringValue(raw.mode, "mixed") as typeof practiceSessions.$inferInsert.mode,
        startedAt: dateValue(raw.startedAt) ?? new Date(),
        endedAt: dateValue(raw.endedAt),
        summary,
      })
      .returning()
      .get();
    if (row) {
      map.set(sourceSessionId, row.id);
      inserted += 1;
    }
  }
  return { map, inserted, updated };
}

function importLearningEvents(
  db: AppDatabase,
  studentId: number,
  data: StudentDataExport,
  sessionMap: Map<number, number>,
) {
  const existing = db
    .select({ payload: learningEvents.payload })
    .from(learningEvents)
    .where(eq(learningEvents.studentId, studentId))
    .all();
  const seen = new Set(
    existing
      .map((row) => importSource(row.payload))
      .filter((marker): marker is ImportSource => marker?.fingerprint === data.sourceFingerprint)
      .map((marker) => marker.eventId)
      .filter((id): id is number => id !== undefined),
  );
  let inserted = 0;
  let skipped = 0;
  for (const raw of data.learningEvents) {
    const sourceEventId = numberValue(raw.id);
    if (sourceEventId === null || seen.has(sourceEventId)) {
      skipped += 1;
      continue;
    }
    const contentItemId = resolveContentItemId(db, raw.contentRef);
    if (contentItemId === null) {
      skipped += 1;
      continue;
    }
    const sourceSessionId = numberValue(raw.sessionId);
    const payload = {
      ...(isRecord(raw.payload) ? raw.payload : {}),
      __importSource: { fingerprint: data.sourceFingerprint, eventId: sourceEventId },
    };
    db.insert(learningEvents)
      .values({
        studentId,
        contentItemId,
        sessionId: sourceSessionId === null ? null : (sessionMap.get(sourceSessionId) ?? null),
        kind: stringValue(raw.kind, "viewed") as typeof learningEvents.$inferInsert.kind,
        payload,
        occurredAt: dateValue(raw.occurredAt) ?? new Date(),
      })
      .run();
    inserted += 1;
  }
  return { inserted, skipped };
}

function importEvidenceEvents(
  db: AppDatabase,
  studentId: number,
  data: StudentDataExport,
  sessionMap: Map<number, number>,
) {
  const existing = db
    .select({ payload: sessionEvidenceEvents.payload })
    .from(sessionEvidenceEvents)
    .where(eq(sessionEvidenceEvents.studentId, studentId))
    .all();
  const seen = new Set(
    existing
      .map((row) => importSource(row.payload))
      .filter((marker): marker is ImportSource => marker?.fingerprint === data.sourceFingerprint)
      .map((marker) => marker.evidenceEventId)
      .filter((id): id is number => id !== undefined),
  );
  let inserted = 0;
  let skipped = 0;
  for (const raw of data.evidenceEvents) {
    const sourceEventId = numberValue(raw.id);
    const sourceSessionId = numberValue(raw.sessionId);
    const targetSessionId = sourceSessionId === null ? null : sessionMap.get(sourceSessionId);
    if (sourceEventId === null || !targetSessionId || seen.has(sourceEventId)) {
      skipped += 1;
      continue;
    }
    const occurredAt = dateValue(raw.occurredAt) ?? new Date();
    let payload = { ...(isRecord(raw.payload) ? raw.payload : {}) };
    if (typeof payload.snapshotDataUrl === "string") {
      const parsed = parseSnapshotDataUrl(payload.snapshotDataUrl);
      const { snapshotDataUrl: _snapshotDataUrl, ...payloadWithoutSnapshot } = payload;
      payload = {
        ...payloadWithoutSnapshot,
        fileName: writeSnapshotFileSync(targetSessionId, occurredAt, parsed),
        mimeType: parsed.mimeType,
        bytes: parsed.buffer.byteLength,
        sha256: crypto.createHash("sha256").update(parsed.buffer).digest("hex"),
      };
    }
    payload.__importSource = {
      fingerprint: data.sourceFingerprint,
      evidenceEventId: sourceEventId,
    };
    db.insert(sessionEvidenceEvents)
      .values({
        studentId,
        sessionId: targetSessionId,
        kind: stringValue(
          raw.kind,
          "answer_submitted",
        ) as typeof sessionEvidenceEvents.$inferInsert.kind,
        severity: stringValue(
          raw.severity,
          "info",
        ) as typeof sessionEvidenceEvents.$inferInsert.severity,
        durationMs: numberValue(raw.durationMs),
        payload,
        occurredAt,
      })
      .run();
    inserted += 1;
  }
  return { inserted, skipped };
}

function upsertImportedProgress(
  db: AppDatabase,
  studentId: number,
  data: StudentDataExport,
): number {
  let count = 0;
  for (const raw of data.itemProgress) {
    const contentItemId = resolveContentItemId(db, raw.contentRef);
    if (contentItemId === null) continue;
    db.insert(itemProgress)
      .values({
        studentId,
        contentItemId,
        track: stringValue(raw.track, "curated") as typeof itemProgress.$inferInsert.track,
        stability: numberValue(raw.stability) ?? 0,
        difficulty: numberValue(raw.difficulty) ?? 5,
        state: stringValue(raw.state, "new") as typeof itemProgress.$inferInsert.state,
        reps: numberValue(raw.reps) ?? 0,
        lapses: numberValue(raw.lapses) ?? 0,
        lastSeenAt: dateValue(raw.lastSeenAt),
        nextDueAt: dateValue(raw.nextDueAt),
        totalCorrect: numberValue(raw.totalCorrect) ?? 0,
        totalWrong: numberValue(raw.totalWrong) ?? 0,
        currentStageKind: nullableString(raw.currentStageKind),
        updatedAt: dateValue(raw.updatedAt) ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [itemProgress.studentId, itemProgress.contentItemId],
        set: {
          track: stringValue(raw.track, "curated") as typeof itemProgress.$inferInsert.track,
          stability: numberValue(raw.stability) ?? 0,
          difficulty: numberValue(raw.difficulty) ?? 5,
          state: stringValue(raw.state, "new") as typeof itemProgress.$inferInsert.state,
          reps: numberValue(raw.reps) ?? 0,
          lapses: numberValue(raw.lapses) ?? 0,
          lastSeenAt: dateValue(raw.lastSeenAt),
          nextDueAt: dateValue(raw.nextDueAt),
          totalCorrect: numberValue(raw.totalCorrect) ?? 0,
          totalWrong: numberValue(raw.totalWrong) ?? 0,
          currentStageKind: nullableString(raw.currentStageKind),
          updatedAt: dateValue(raw.updatedAt) ?? new Date(),
        },
      })
      .run();
    count += 1;
  }
  return count;
}

function upsertAchievements(db: AppDatabase, studentId: number, data: StudentDataExport): number {
  let count = 0;
  for (const raw of data.achievements) {
    const achievementId = nullableString(raw.achievementId);
    if (!achievementId) continue;
    db.insert(studentAchievements)
      .values({
        studentId,
        achievementId,
        unlockedAt: dateValue(raw.unlockedAt) ?? new Date(),
      })
      .onConflictDoNothing()
      .run();
    count += 1;
  }
  return count;
}

function upsertDictionaryData(
  db: AppDatabase,
  studentId: number,
  data: StudentDataExport,
  sessionMap: Map<number, number>,
): { itemMap: Map<number, number>; searchesInserted: number; searchesSkipped: number } {
  const existingSearches = new Set(
    db
      .select({
        query: dictionarySearchEvents.query,
        dictionaryKey: dictionarySearchEvents.dictionaryKey,
        createdAt: dictionarySearchEvents.createdAt,
      })
      .from(dictionarySearchEvents)
      .where(eq(dictionarySearchEvents.studentId, studentId))
      .all()
      .map((row) => dictionarySearchKey(row.query, row.dictionaryKey, row.createdAt)),
  );
  let searchesInserted = 0;
  let searchesSkipped = 0;
  for (const raw of data.dictionary.searches) {
    const createdAt = dateValue(raw.createdAt) ?? new Date();
    const query = stringValue(raw.query, "");
    const dictionaryKey = nullableString(raw.dictionaryKey);
    const key = dictionarySearchKey(query, dictionaryKey, createdAt);
    if (existingSearches.has(key)) {
      searchesSkipped += 1;
      continue;
    }
    db.insert(dictionarySearchEvents)
      .values({
        studentId,
        query,
        dictionaryKey,
        headword: nullableString(raw.headword),
        createdAt,
      })
      .run();
    existingSearches.add(key);
    searchesInserted += 1;
  }

  const itemMap = new Map<number, number>();
  for (const raw of data.dictionary.items) {
    const dictionaryKey = nullableString(raw.dictionaryKey);
    const sourceItemId = numberValue(raw.id);
    if (!dictionaryKey || sourceItemId === null) continue;
    db.insert(dictionaryLearningItems)
      .values({
        studentId,
        dictionaryKey,
        headword: stringValue(raw.headword, dictionaryKey),
        pos: stringValue(raw.pos, "noun") as typeof dictionaryLearningItems.$inferInsert.pos,
        ipa: nullableString(raw.ipa),
        cefrLevel: nullableString(
          raw.cefrLevel,
        ) as typeof dictionaryLearningItems.$inferInsert.cefrLevel,
        definitionEn: stringValue(raw.definitionEn, ""),
        definitionVi: nullableString(raw.definitionVi),
        exampleText: nullableString(raw.exampleText),
        exampleTranslation: nullableString(raw.exampleTranslation),
        audioRef: nullableString(raw.audioRef),
        status: stringValue(
          raw.status,
          "learning",
        ) as typeof dictionaryLearningItems.$inferInsert.status,
        stage: stringValue(
          raw.stage,
          "flashcard",
        ) as typeof dictionaryLearningItems.$inferInsert.stage,
        stability: numberValue(raw.stability) ?? 0,
        difficulty: numberValue(raw.difficulty) ?? 5,
        state: stringValue(raw.state, "new") as typeof dictionaryLearningItems.$inferInsert.state,
        reps: numberValue(raw.reps) ?? 0,
        lapses: numberValue(raw.lapses) ?? 0,
        totalCorrect: numberValue(raw.totalCorrect) ?? 0,
        totalWrong: numberValue(raw.totalWrong) ?? 0,
        lastReviewedAt: dateValue(raw.lastReviewedAt),
        nextDueAt: dateValue(raw.nextDueAt),
        createdAt: dateValue(raw.createdAt) ?? new Date(),
        updatedAt: dateValue(raw.updatedAt) ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [dictionaryLearningItems.studentId, dictionaryLearningItems.dictionaryKey],
        set: {
          headword: stringValue(raw.headword, dictionaryKey),
          pos: stringValue(raw.pos, "noun") as typeof dictionaryLearningItems.$inferInsert.pos,
          ipa: nullableString(raw.ipa),
          cefrLevel: nullableString(
            raw.cefrLevel,
          ) as typeof dictionaryLearningItems.$inferInsert.cefrLevel,
          definitionEn: stringValue(raw.definitionEn, ""),
          definitionVi: nullableString(raw.definitionVi),
          exampleText: nullableString(raw.exampleText),
          exampleTranslation: nullableString(raw.exampleTranslation),
          audioRef: nullableString(raw.audioRef),
          status: stringValue(
            raw.status,
            "learning",
          ) as typeof dictionaryLearningItems.$inferInsert.status,
          stage: stringValue(
            raw.stage,
            "flashcard",
          ) as typeof dictionaryLearningItems.$inferInsert.stage,
          stability: numberValue(raw.stability) ?? 0,
          difficulty: numberValue(raw.difficulty) ?? 5,
          state: stringValue(raw.state, "new") as typeof dictionaryLearningItems.$inferInsert.state,
          reps: numberValue(raw.reps) ?? 0,
          lapses: numberValue(raw.lapses) ?? 0,
          totalCorrect: numberValue(raw.totalCorrect) ?? 0,
          totalWrong: numberValue(raw.totalWrong) ?? 0,
          lastReviewedAt: dateValue(raw.lastReviewedAt),
          nextDueAt: dateValue(raw.nextDueAt),
          updatedAt: dateValue(raw.updatedAt) ?? new Date(),
        },
      })
      .run();
    const target = db
      .select({ id: dictionaryLearningItems.id })
      .from(dictionaryLearningItems)
      .where(
        and(
          eq(dictionaryLearningItems.studentId, studentId),
          eq(dictionaryLearningItems.dictionaryKey, dictionaryKey),
        ),
      )
      .get();
    if (target) itemMap.set(sourceItemId, target.id);
  }

  const existingReviews = new Set(
    db
      .select({
        answer: dictionaryLearningReviews.answer,
        createdAt: dictionaryLearningReviews.createdAt,
      })
      .from(dictionaryLearningReviews)
      .where(eq(dictionaryLearningReviews.studentId, studentId))
      .all()
      .map((row) => `${row.answer ?? ""}:${row.createdAt.getTime()}`),
  );
  for (const raw of data.dictionary.reviews) {
    const sourceItemId = numberValue(raw.itemId);
    const itemId = sourceItemId === null ? null : itemMap.get(sourceItemId);
    if (!itemId) continue;
    const createdAt = dateValue(raw.createdAt) ?? new Date();
    const key = `${nullableString(raw.answer) ?? ""}:${createdAt.getTime()}`;
    if (existingReviews.has(key)) continue;
    db.insert(dictionaryLearningReviews)
      .values({
        itemId,
        studentId,
        sessionId:
          numberValue(raw.sessionId) === null
            ? null
            : (sessionMap.get(numberValue(raw.sessionId) ?? -1) ?? null),
        stageBefore: stringValue(
          raw.stageBefore,
          "flashcard",
        ) as typeof dictionaryLearningReviews.$inferInsert.stageBefore,
        stageAfter: stringValue(
          raw.stageAfter,
          "flashcard",
        ) as typeof dictionaryLearningReviews.$inferInsert.stageAfter,
        statusAfter: stringValue(
          raw.statusAfter,
          "learning",
        ) as typeof dictionaryLearningReviews.$inferInsert.statusAfter,
        correct: Boolean(raw.correct),
        answer: nullableString(raw.answer),
        expected: nullableString(raw.expected),
        createdAt,
      })
      .run();
  }
  return { itemMap, searchesInserted, searchesSkipped };
}

function dictionarySearchKey(query: string, dictionaryKey: string | null, createdAt: Date): string {
  return `${query.trim().toLowerCase()}:${dictionaryKey ?? ""}:${createdAt.getTime()}`;
}

function exportAssignments(db: AppDatabase, studentId: number) {
  return db
    .select({
      status: unitAssignments.status,
      assignedAt: unitAssignments.assignedAt,
      completedAt: unitAssignments.completedAt,
      metadata: unitAssignments.metadata,
      bookCode: books.code,
      unitCode: units.code,
    })
    .from(unitAssignments)
    .innerJoin(units, eq(units.id, unitAssignments.unitId))
    .innerJoin(books, eq(books.id, units.bookId))
    .where(eq(unitAssignments.studentId, studentId))
    .all();
}

function upsertAssignments(db: AppDatabase, studentId: number, data: StudentDataExport): number {
  let count = 0;
  for (const raw of data.assignments) {
    const bookCode = nullableString(raw.bookCode);
    const unitCode = nullableString(raw.unitCode);
    if (!bookCode || !unitCode) continue;
    const unit = db
      .select({ unitId: units.id, bookId: books.id })
      .from(units)
      .innerJoin(books, eq(books.id, units.bookId))
      .where(and(eq(books.code, bookCode), eq(units.code, unitCode)))
      .get();
    if (!unit) continue;
    db.insert(enrollments)
      .values({
        studentId,
        bookId: unit.bookId,
        currentUnitId: unit.unitId,
        status: "active",
      })
      .onConflictDoUpdate({
        target: [enrollments.studentId, enrollments.bookId],
        set: { currentUnitId: unit.unitId, status: "active" },
      })
      .run();
    db.insert(unitAssignments)
      .values({
        studentId,
        unitId: unit.unitId,
        status: stringValue(raw.status, "assigned") as typeof unitAssignments.$inferInsert.status,
        assignedAt: dateValue(raw.assignedAt) ?? new Date(),
        completedAt: dateValue(raw.completedAt),
        metadata: isRecord(raw.metadata) ? raw.metadata : null,
      })
      .onConflictDoUpdate({
        target: [unitAssignments.studentId, unitAssignments.unitId],
        set: {
          status: stringValue(raw.status, "assigned") as typeof unitAssignments.$inferInsert.status,
          completedAt: dateValue(raw.completedAt),
          metadata: isRecord(raw.metadata) ? raw.metadata : null,
        },
      })
      .run();
    count += 1;
  }
  return count;
}

function parseSnapshotDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Camera snapshot must be a jpeg, png, or webp data URL");
  }
  const buffer = Buffer.from(match[2] ?? "", "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > 5_000_000) {
    throw new Error("Camera snapshot is empty or too large");
  }
  return { mimeType: match[1] ?? "image/jpeg", buffer };
}

async function writeSnapshotFile(
  sessionId: number,
  capturedAt: Date,
  snapshot: { mimeType: string; buffer: Buffer },
): Promise<string> {
  const { fullPath, relativePath } = snapshotPath(sessionId, capturedAt, snapshot.mimeType);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, snapshot.buffer);
  return relativePath;
}

function writeSnapshotFileSync(
  sessionId: number,
  capturedAt: Date,
  snapshot: { mimeType: string; buffer: Buffer },
): string {
  const { fullPath, relativePath } = snapshotPath(sessionId, capturedAt, snapshot.mimeType);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, snapshot.buffer);
  return relativePath;
}

function snapshotPath(
  sessionId: number,
  capturedAt: Date,
  mimeType: string,
): { fullPath: string; relativePath: string } {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const dirName = `session-${sessionId}`;
  const relativePath = path.join(dirName, `${formatStamp(capturedAt)}.${ext}`);
  return { fullPath: safeEvidencePath(relativePath), relativePath };
}

function safeEvidencePath(relativePath: string): string {
  const root = path.join(app.getPath("userData"), "session-evidence");
  const fullPath = path.resolve(root, relativePath);
  if (!fullPath.startsWith(path.resolve(root))) {
    throw new Error("Unsafe evidence path");
  }
  return fullPath;
}

function serializeTimeline(timeline: StudentEvidenceTimeline, includeSnapshots: boolean) {
  const snapshots = timeline.snapshots.map((snapshot) => {
    const snapshotDataUrl =
      includeSnapshots && snapshot.fileName ? readSnapshotDataUrl(snapshot.fileName) : null;
    return {
      ...snapshot,
      included: Boolean(snapshotDataUrl),
      snapshotDataUrl,
    };
  });
  return {
    session: timeline.session,
    metrics: timeline.metrics,
    events: timeline.events.map((event) => {
      const payload = event.payload ? { ...event.payload } : null;
      if (includeSnapshots && payload && typeof payload.fileName === "string") {
        const dataUrl = readSnapshotDataUrl(payload.fileName);
        if (dataUrl) payload.snapshotDataUrl = dataUrl;
      }
      return { ...event, payload };
    }),
    snapshots,
  };
}

function readSnapshotDataUrl(relativePath: string): string | null {
  const fullPath = safeEvidencePath(relativePath);
  if (!fs.existsSync(fullPath)) return null;
  const ext = path.extname(fullPath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mimeType};base64,${fs.readFileSync(fullPath).toString("base64")}`;
}

function encryptReport(payloadJson: string, passphrase: string, sha256: string, generatedAt: Date) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const iterations = 210_000;
  const key = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payloadJson, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    schemaVersion: "vocab.encrypted-report.v1",
    generatedAt: generatedAt.toISOString(),
    encryption: {
      algorithm: "aes-256-gcm",
      kdf: "pbkdf2-sha256",
      iterations,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    },
    integrity: { plaintextSha256: sha256 },
    ciphertext: ciphertext.toString("base64"),
  };
}

function jsonDateReplacer(_key: string, value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function safeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "student"
  );
}

function formatStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function requireDb(ctx: ProcedureContext): AppDatabase {
  if (!ctx.db) throw new Error("Database handle is unavailable for this procedure.");
  return ctx.db;
}

function studentSourceFingerprint(student: { id: number; createdAt: Date; name: string }): string {
  return crypto
    .createHash("sha256")
    .update(`vocab-app:${student.id}:${student.createdAt.toISOString()}:${student.name}`)
    .digest("hex")
    .slice(0, 24);
}

function importMapKey(fingerprint: string): string {
  return `student_import_map:${fingerprint}`;
}

export const __studentDataImportTest = {
  buildStudentDataExport,
  importStudentDataBundle,
};

export const __studentDataExportTest = {
  buildStudentHistoryExport,
};

function studentWithoutPin<T extends { pinHash: unknown }>(student: T): Omit<T, "pinHash"> {
  const { pinHash: _pinHash, ...safeStudent } = student;
  return safeStudent;
}

function contentRefForItem(db: AppDatabase, contentItemId: number): ContentRef | null {
  const row = db
    .select({
      id: contentItems.id,
      kind: contentItems.kind,
      refTable: contentItems.refTable,
      refId: contentItems.refId,
      bookCode: books.code,
      unitCode: units.code,
      lessonSlug: lessons.slug,
      lessonKind: lessons.kind,
      vocabSourceId: vocabEntries.sourceId,
      vocabHeadword: vocabEntries.headword,
      grammarSourceId: grammarTopics.sourceId,
      grammarSlug: grammarTopics.slug,
    })
    .from(contentItems)
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
    .where(eq(contentItems.id, contentItemId))
    .get();
  if (!row) return null;
  return {
    refTable: row.refTable,
    refId: row.refId,
    kind: row.kind,
    bookCode: row.bookCode,
    unitCode: row.unitCode,
    lessonSlug: row.lessonSlug,
    lessonKind: row.lessonKind,
    sourceId: row.vocabSourceId ?? row.grammarSourceId ?? null,
    slug: row.grammarSlug ?? null,
    headword: row.vocabHeadword ?? null,
  };
}

function resolveContentItemId(db: AppDatabase, ref: ContentRef | null | undefined): number | null {
  if (!ref) return null;
  const base = db
    .select({ id: contentItems.id })
    .from(contentItems)
    .innerJoin(lessons, eq(lessons.id, contentItems.lessonId))
    .innerJoin(units, eq(units.id, lessons.unitId))
    .innerJoin(books, eq(books.id, units.bookId));
  if (ref.refTable === "vocab_entries") {
    const row = base
      .innerJoin(vocabEntries, eq(vocabEntries.id, contentItems.refId))
      .where(
        and(
          eq(contentItems.refTable, "vocab_entries"),
          eq(books.code, ref.bookCode ?? ""),
          eq(units.code, ref.unitCode ?? ""),
          eq(lessons.slug, ref.lessonSlug ?? ""),
          ref.sourceId
            ? eq(vocabEntries.sourceId, ref.sourceId)
            : eq(vocabEntries.headword, ref.headword ?? ""),
        ),
      )
      .get();
    return row?.id ?? null;
  }
  if (ref.refTable === "grammar_topics") {
    const row = base
      .innerJoin(grammarTopics, eq(grammarTopics.id, contentItems.refId))
      .where(
        and(
          eq(contentItems.refTable, "grammar_topics"),
          eq(books.code, ref.bookCode ?? ""),
          eq(units.code, ref.unitCode ?? ""),
          eq(lessons.slug, ref.lessonSlug ?? ""),
          eq(grammarTopics.slug, ref.slug ?? ""),
        ),
      )
      .get();
    return row?.id ?? null;
  }
  return null;
}

function parseReportBundle(body: string, passphrase: string | undefined): Record<string, unknown> {
  const parsed = JSON.parse(body) as Record<string, unknown>;
  if (parsed.schemaVersion !== "vocab.report-bundle.v1") {
    throw new Error("Unsupported report bundle format.");
  }
  const report = parsed.report;
  if (!isRecord(report)) throw new Error("Report bundle is missing its report payload.");
  if (report.schemaVersion === "vocab.encrypted-report.v1") {
    if (!passphrase)
      throw new Error("This bundle is encrypted. Enter its passphrase and try again.");
    return JSON.parse(decryptReport(report, passphrase)) as Record<string, unknown>;
  }
  return report;
}

function decryptReport(report: Record<string, unknown>, passphrase: string): string {
  const encryption = report.encryption;
  if (!isRecord(encryption)) throw new Error("Encrypted report metadata is invalid.");
  const key = crypto.pbkdf2Sync(
    passphrase,
    Buffer.from(stringValue(encryption.salt, ""), "base64"),
    numberValue(encryption.iterations) ?? 210_000,
    32,
    "sha256",
  );
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(stringValue(encryption.iv, ""), "base64"),
  );
  decipher.setAuthTag(Buffer.from(stringValue(encryption.authTag, ""), "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(stringValue(report.ciphertext, ""), "base64")),
    decipher.final(),
  ]).toString("utf8");
}

interface ImportSource {
  fingerprint?: string;
  sessionId?: number;
  eventId?: number;
  evidenceEventId?: number;
}

function importSource(value: unknown): ImportSource | null {
  if (!isRecord(value)) return null;
  const marker = value.__importSource;
  return isRecord(marker) ? (marker as ImportSource) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
