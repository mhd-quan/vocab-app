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

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  /** Apply the default after the persisted preference has been removed. */
  resetTheme: () => void;
}

export const THEME_SETTING_KEY = "theme";
const DEFAULT_THEME: ThemePreference = "system";
const THEME_VALUES = new Set<ThemePreference>(["light", "dark", "system"]);
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(() => readSystemDark());

  useEffect(() => {
    let cancelled = false;
    api.settings
      .get<unknown>({ key: THEME_SETTING_KEY })
      .then((stored) => {
        if (!cancelled) setThemeState(normalizeTheme(stored));
      })
      .catch((err) => {
        console.error("[ThemeProvider] failed to read theme setting", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    api.settings.set({ key: THEME_SETTING_KEY, value: next }).catch((err) => {
      console.error("[ThemeProvider] failed to persist theme setting", err);
    });
  }, []);

  const resetTheme = useCallback(() => setThemeState(DEFAULT_THEME), []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, resetTheme }),
    [theme, resolvedTheme, setTheme, resetTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

function normalizeTheme(value: unknown): ThemePreference {
  return typeof value === "string" && THEME_VALUES.has(value as ThemePreference)
    ? (value as ThemePreference)
    : DEFAULT_THEME;
}

function readSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
