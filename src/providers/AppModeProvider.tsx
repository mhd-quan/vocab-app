import { api } from "@/lib/api";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppMode = "loading" | "locked" | "tutor" | "student";

export interface AppModeState {
  mode: AppMode;
  /** True once we've checked whether a tutor PIN is configured. */
  pinReady: boolean;
  /** True when there's a stored tutor PIN. False on first run. */
  hasPin: boolean;
  unlockTutor: (pin: string) => Promise<{ ok: true } | { ok: false; reason: "no_pin" | "invalid" }>;
  setupPin: (pin: string) => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<void>;
  enterStudent: () => void;
  /** Switch from tutor → student without locking (no PIN required). */
  switchToStudent: () => void;
  /** Drop back to the lock screen; tutor will need to re-enter their PIN. */
  lock: () => void;
}

const AppModeContext = createContext<AppModeState | null>(null);

export interface AppModeProviderProps {
  children: ReactNode;
  /** Test seam: skip the initial `auth.hasPin` IPC call. */
  initialMode?: AppMode;
  initialHasPin?: boolean;
}

export function AppModeProvider({ children, initialMode, initialHasPin }: AppModeProviderProps) {
  const [mode, setMode] = useState<AppMode>(initialMode ?? "loading");
  const [hasPin, setHasPin] = useState<boolean>(initialHasPin ?? false);
  const [pinReady, setPinReady] = useState<boolean>(initialMode !== undefined);

  useEffect(() => {
    if (initialMode !== undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const exists = await api.auth.hasPin();
        if (cancelled) return;
        setHasPin(exists);
        setPinReady(true);
        setMode("locked");
      } catch (err) {
        console.error("[AppMode] hasPin probe failed", err);
        if (cancelled) return;
        setPinReady(true);
        setMode("locked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialMode]);

  const unlockTutor: AppModeState["unlockTutor"] = useCallback(async (pin) => {
    const result = await api.auth.verifyPin({ pin });
    if (result.ok) {
      setMode("tutor");
    }
    return result;
  }, []);

  const setupPin: AppModeState["setupPin"] = useCallback(async (pin) => {
    await api.auth.setupPin({ pin });
    setHasPin(true);
    setMode("tutor");
  }, []);

  const changePin: AppModeState["changePin"] = useCallback(async (currentPin, newPin) => {
    await api.auth.changePin({ currentPin, newPin });
  }, []);

  const enterStudent = useCallback(() => setMode("student"), []);
  const switchToStudent = useCallback(() => setMode("student"), []);
  const lock = useCallback(() => setMode("locked"), []);

  const value = useMemo<AppModeState>(
    () => ({
      mode,
      hasPin,
      pinReady,
      unlockTutor,
      setupPin,
      changePin,
      enterStudent,
      switchToStudent,
      lock,
    }),
    [mode, hasPin, pinReady, unlockTutor, setupPin, changePin, enterStudent, switchToStudent, lock],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeState {
  const ctx = useContext(AppModeContext);
  if (!ctx) {
    throw new Error("useAppMode must be used inside <AppModeProvider>");
  }
  return ctx;
}
