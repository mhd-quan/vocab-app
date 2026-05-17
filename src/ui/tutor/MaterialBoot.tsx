/**
 * MaterialBoot — lazy-loads `@material/web` only inside the tutor tree.
 *
 * Why:
 *   `@material/web` registers ~30 custom elements + pulls Lit 3 at import
 *   time. Loading it eagerly would put that cost in the student bundle,
 *   which never renders any `md-*` element. We instead dynamic-import
 *   inside this provider, which mounts at the tutor route subtree only
 *   (via TutorLayout). Once registered, `customElements.define` is a
 *   one-time-per-tag operation — subsequent renders are free.
 *
 * Behaviour:
 *   - Returns `null` until the import resolves; children render after.
 *   - On import failure (e.g. offline + uncached), logs and renders
 *     children anyway — better to show a slightly-unstyled tutor screen
 *     than to block the UI entirely.
 *
 * The `imported` flag is module-scoped so a re-mount during navigation
 * doesn't re-await the same module. Lit's CE registry is process-wide.
 */
import { type ReactNode, useEffect, useState } from "react";

let importStarted = false;
let importPromise: Promise<unknown> | null = null;

function ensureMaterialImport(): Promise<unknown> {
  if (importPromise) return importPromise;
  importStarted = true;
  importPromise = import("@material/web/all.js").catch((err) => {
    console.error("[MaterialBoot] failed to load @material/web", err);
    // Reset so a future remount can retry.
    importPromise = null;
    importStarted = false;
    throw err;
  });
  return importPromise;
}

export interface MaterialBootProps {
  children: ReactNode;
}

export function MaterialBoot({ children }: MaterialBootProps) {
  const [ready, setReady] = useState<boolean>(importStarted && importPromise === null);

  useEffect(() => {
    let cancelled = false;
    ensureMaterialImport()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // Render children anyway so the tutor screen isn't blocked.
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-muted">
        Loading workspace…
      </div>
    );
  }
  return <>{children}</>;
}
