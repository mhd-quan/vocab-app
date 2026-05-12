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

export type DisplayFontSize = "small" | "medium" | "large";

interface DisplayPreferencesContextValue {
  fontSize: DisplayFontSize;
  setFontSize: (value: DisplayFontSize) => void;
}

const FONT_SIZE_KEY = "display_font_size";
const FONT_SIZE_VALUES = new Set<DisplayFontSize>(["small", "medium", "large"]);
const ROOT_FONT_SIZE: Record<DisplayFontSize, string> = {
  small: "15px",
  medium: "16px",
  large: "17px",
};

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue | null>(null);

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<DisplayFontSize>("medium");

  useEffect(() => {
    let cancelled = false;
    api.settings
      .get<unknown>({ key: FONT_SIZE_KEY })
      .then((stored) => {
        if (!cancelled) setFontSizeState(normalizeFontSize(stored));
      })
      .catch((err) => {
        console.error("[DisplayPreferencesProvider] failed to read display setting", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.displayFontSize = fontSize;
    document.documentElement.style.fontSize = ROOT_FONT_SIZE[fontSize];
  }, [fontSize]);

  const setFontSize = useCallback((next: DisplayFontSize) => {
    setFontSizeState(next);
    api.settings.set({ key: FONT_SIZE_KEY, value: next }).catch((err) => {
      console.error("[DisplayPreferencesProvider] failed to persist display setting", err);
    });
  }, []);

  const value = useMemo(() => ({ fontSize, setFontSize }), [fontSize, setFontSize]);

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences(): DisplayPreferencesContextValue {
  const value = useContext(DisplayPreferencesContext);
  if (!value)
    throw new Error("useDisplayPreferences must be used inside DisplayPreferencesProvider");
  return value;
}

function normalizeFontSize(value: unknown): DisplayFontSize {
  return typeof value === "string" && FONT_SIZE_VALUES.has(value as DisplayFontSize)
    ? (value as DisplayFontSize)
    : "medium";
}
