import { z } from "zod";
import {
  getMicrophonePermissionStatus,
  openMicrophonePermissionSettings,
  requestMicrophonePermission,
} from "../../permissions/microphone";
import { defineProcedure } from "../procedure";

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
];
