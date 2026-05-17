/**
 * RoleStyleProvider — mirrors `useAppMode().mode` onto the
 * `data-app-mode` attribute of `<html>`, so token files
 * (`src/styles/tokens/student.css`, `tutor.css`) can scope their
 * overrides via a single attribute selector.
 *
 * No DOM beyond an attribute write — children are passed through
 * unchanged. Keeps the existing provider chain in `App.tsx`
 * (Query → Theme → DisplayPrefs → AppMode → RoleStyle → AppRoot).
 *
 * Scoping rule:
 *   - mode === "tutor"   → data-app-mode="tutor"
 *   - mode === "student" → data-app-mode="student"
 *   - anything else      → attribute removed (pre-auth / loading screens
 *     should use the base palette so the lock screen doesn't flicker
 *     between role looks).
 */
import { useAppMode } from "@/providers/AppModeProvider";
import { type ReactNode, useEffect } from "react";

const ATTR = "data-app-mode";

export type RoleStyleScope = "tutor" | "student" | null;

function scopeForMode(mode: string): RoleStyleScope {
  if (mode === "tutor") return "tutor";
  if (mode === "student") return "student";
  return null;
}

export interface RoleStyleProviderProps {
  children: ReactNode;
}

export function RoleStyleProvider({ children }: RoleStyleProviderProps) {
  const { mode } = useAppMode();

  useEffect(() => {
    const root = document.documentElement;
    const scope = scopeForMode(mode);
    if (scope === null) {
      root.removeAttribute(ATTR);
    } else {
      root.setAttribute(ATTR, scope);
    }
    return () => {
      // Clean up only if we own the current value — avoids tearing
      // when StrictMode double-invokes the effect in dev.
      if (root.getAttribute(ATTR) === scope) {
        root.removeAttribute(ATTR);
      }
    };
  }, [mode]);

  return <>{children}</>;
}
