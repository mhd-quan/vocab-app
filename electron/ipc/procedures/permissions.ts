import { z } from "zod";
import {
  getMicrophonePermissionStatus,
  openMicrophonePermissionSettings,
  requestMicrophonePermission,
} from "../../permissions/microphone";
import { defineProcedure } from "../procedure";

const microphoneCaptureDiagnosticSchema = z
  .object({
    event: z.string().min(1).max(80),
    phase: z.string().min(1).max(40),
    backend: z.string().min(1).max(40).optional(),
    permission: z
      .object({
        platform: z.string().min(1).max(30),
        status: z.string().min(1).max(40),
        granted: z.boolean(),
        readyForCapture: z.boolean(),
        canPrompt: z.boolean(),
        canOpenSettings: z.boolean(),
        requiresSystemSettings: z.boolean(),
        requiresRestart: z.boolean(),
        reason: z.string().max(500).nullable(),
      })
      .nullable()
      .optional(),
    context: z
      .object({
        state: z.string().max(40).nullable(),
        sampleRate: z.number().finite().positive().nullable(),
      })
      .optional(),
    worklet: z
      .object({
        protocol: z.string().max(20),
        path: z.string().max(160),
      })
      .optional(),
    error: z
      .object({
        name: z.string().max(120).nullable(),
        message: z.string().max(800),
        code: z.number().optional(),
      })
      .optional(),
    detail: z.string().max(800).optional(),
    atIso: z.string().max(40),
  })
  .strict();

export const permissionsProcedures = [
  defineProcedure({
    name: "permissions.microphoneStatus",
    input: z.void(),
    handler: () => getMicrophonePermissionStatus(),
  }),
  defineProcedure({
    name: "permissions.requestMicrophone",
    input: z.void(),
    handler: () => requestMicrophonePermission(),
  }),
  defineProcedure({
    name: "permissions.openMicrophoneSettings",
    input: z.void(),
    handler: () => openMicrophonePermissionSettings(),
  }),
  defineProcedure({
    name: "permissions.logMicrophoneCaptureDiagnostic",
    input: microphoneCaptureDiagnosticSchema,
    handler: (input) => {
      const level = input.event.endsWith("failed") ? "warn" : "log";
      console[level]("[capt-recorder]", input);
      return { ok: true };
    },
  }),
];
