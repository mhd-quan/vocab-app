import { ipcMain } from "electron";
import type { AnyProcedure, ProcedureContext } from "./procedure";

const SLOW_IPC_WARN_MS = 100;

/**
 * Wire every procedure into Electron's `ipcMain.handle`. Registered names
 * must be unique — duplicates throw at startup so we catch typos early.
 *
 * If a handler throws, Electron rejects the renderer-side `invoke` promise
 * with the original Error message; we don't wrap with a Result envelope so
 * renderer code can use try/catch / TanStack Query naturally.
 */
export function registerIpcProcedures(
  procedures: ReadonlyArray<AnyProcedure>,
  ctx: ProcedureContext,
): void {
  const seen = new Set<string>();
  for (const proc of procedures) {
    if (seen.has(proc.name)) {
      throw new Error(`Duplicate IPC procedure registered: ${proc.name}`);
    }
    seen.add(proc.name);

    ipcMain.handle(proc.name, async (_event, rawInput) => {
      const startedAt = Date.now();
      try {
        const input = proc.inputSchema.parse(rawInput);
        return await proc.handler(input, ctx);
      } finally {
        const durationMs = Date.now() - startedAt;
        if (durationMs >= SLOW_IPC_WARN_MS) {
          console.warn("[ipc] slow handler", { channel: proc.name, durationMs });
        }
      }
    });
  }
}

export function unregisterIpcProcedures(procedures: ReadonlyArray<AnyProcedure>): void {
  for (const proc of procedures) {
    ipcMain.removeHandler(proc.name);
  }
}
