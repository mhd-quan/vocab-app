import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app, dialog } from "electron";
import { z } from "zod";
import { sessionEvidenceEventKinds, sessionEvidenceSeverities } from "../../../src/data/schema";
import type { StudentEvidenceTimeline } from "../../db/repositories/evidence";
import { defineProcedure } from "../procedure";

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
});

const exportReportInput = z.object({
  studentId: z.number().int().positive(),
  includeSnapshots: z.boolean().optional(),
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
    handler: (input, ctx) => {
      const parsed = parseSnapshotDataUrl(input.dataUrl);
      const capturedAt = input.capturedAtIso ? new Date(input.capturedAtIso) : new Date();
      const relativePath = writeSnapshotFile(input.sessionId, capturedAt, parsed);
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
    handler: ({ sessionId }, ctx) => ctx.repos.evidence.sessionTimeline({ sessionId }),
  }),

  defineProcedure({
    name: "evidence.exportStudentReport",
    input: exportReportInput,
    handler: async ({ studentId, includeSnapshots, passphrase }, ctx) => {
      const student = ctx.repos.students.getById(studentId);
      if (!student) throw new Error(`Student ${studentId} not found`);

      const generatedAt = new Date();
      const evidence = ctx.repos.evidence.studentOverview({ studentId, limit: 25 });
      const timelines = evidence.recentSessions
        .map((session) => ctx.repos.evidence.sessionTimeline({ sessionId: session.sessionId }))
        .filter((timeline): timeline is NonNullable<typeof timeline> => timeline !== null)
        .map((timeline) => serializeTimeline(timeline, includeSnapshots === true));
      const progressSummary = ctx.repos.progress.studentSummary({
        studentId,
        now: generatedAt,
      });

      const payload = {
        schemaVersion: "vocab.session-report.v1",
        generatedAt: generatedAt.toISOString(),
        app: { name: "vocab-app" },
        student,
        progress: {
          summary: progressSummary,
          weakItems: ctx.repos.progress.weakItems({ studentId, minAttempts: 3, limit: 25 }),
          recentSessions: ctx.repos.progress.recentSessions({ studentId, limit: 25 }),
        },
        evidence: {
          overview: evidence,
          sessions: timelines,
          safeguards: {
            cameraSnapshotsIncluded: includeSnapshots === true,
            cameraMode: "explicit per-session consent with visible indicator",
            verdictPolicy: "review signals only; no hidden surveillance or biometric inference",
          },
        },
      };

      const payloadJson = JSON.stringify(payload, jsonDateReplacer, 2);
      const sha256 = crypto.createHash("sha256").update(payloadJson).digest("hex");
      const body = passphrase
        ? JSON.stringify(encryptReport(payloadJson, passphrase, sha256), null, 2)
        : JSON.stringify({ ...payload, integrity: { sha256 } }, jsonDateReplacer, 2);

      const defaultPath = `${safeFilename(student.displayName ?? student.name)}-session-report-${formatStamp(
        generatedAt,
      )}${passphrase ? ".vocab-report.enc.json" : ".vocab-report.json"}`;
      const dialogOptions = {
        title: "Export student session report",
        defaultPath,
        filters: [
          {
            name: passphrase ? "Encrypted Vocab Report" : "Vocab Report",
            extensions: passphrase ? ["enc.json"] : ["json"],
          },
        ],
      };
      const parent = ctx.getMainWindow?.() ?? null;
      const result = parent
        ? await dialog.showSaveDialog(parent, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) {
        return { canceled: true, filePath: null, encrypted: Boolean(passphrase), sha256 } as const;
      }

      fs.writeFileSync(result.filePath, body, "utf8");
      return {
        canceled: false,
        filePath: result.filePath,
        encrypted: Boolean(passphrase),
        sha256,
      } as const;
    },
  }),
];

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

function writeSnapshotFile(
  sessionId: number,
  capturedAt: Date,
  snapshot: { mimeType: string; buffer: Buffer },
): string {
  const ext =
    snapshot.mimeType === "image/png" ? "png" : snapshot.mimeType === "image/webp" ? "webp" : "jpg";
  const dirName = `session-${sessionId}`;
  const relativePath = path.join(dirName, `${formatStamp(capturedAt)}.${ext}`);
  const fullPath = safeEvidencePath(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, snapshot.buffer);
  return relativePath;
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
  };
}

function readSnapshotDataUrl(relativePath: string): string | null {
  const fullPath = safeEvidencePath(relativePath);
  if (!fs.existsSync(fullPath)) return null;
  const ext = path.extname(fullPath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mimeType};base64,${fs.readFileSync(fullPath).toString("base64")}`;
}

function encryptReport(payloadJson: string, passphrase: string, sha256: string) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const iterations = 210_000;
  const key = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payloadJson, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    schemaVersion: "vocab.encrypted-report.v1",
    generatedAt: new Date().toISOString(),
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
