import type { AnyProcedure } from "./procedure";

export const REQUIRED_IPC_CHANNELS = [
  "meta.ping",
  "permissions.microphoneStatus",
  "permissions.requestMicrophone",
  "permissions.openMicrophoneSettings",
] as const;

export function missingRequiredIpcChannels(
  procedures: ReadonlyArray<Pick<AnyProcedure, "name">>,
): string[] {
  const registered = new Set(procedures.map((procedure) => procedure.name));
  return REQUIRED_IPC_CHANNELS.filter((channel) => !registered.has(channel));
}

export function assertRequiredIpcChannels(
  procedures: ReadonlyArray<Pick<AnyProcedure, "name">>,
): void {
  const missing = missingRequiredIpcChannels(procedures);
  if (missing.length > 0) {
    throw new Error(`[ipc] missing required procedure channels: ${missing.join(", ")}`);
  }
}
