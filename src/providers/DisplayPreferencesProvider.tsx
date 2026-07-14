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
export type PronunciationAccentPreference = "uk" | "us" | "any";

interface DisplayPreferencesContextValue {
  fontSize: DisplayFontSize;
  setFontSize: (value: DisplayFontSize) => void;
  /**
   * When true, exercise cards with audio (audio recall, flashcard front)
   * auto-play the pronunciation on each new card. Tutor-tunable via
   * Settings; key `pronunciation_autoplay` in app_settings.
   */
  pronunciationAutoplay: boolean;
  setPronunciationAutoplay: (value: boolean) => void;
  pronunciationAccent: PronunciationAccentPreference;
  setPronunciationAccent: (value: PronunciationAccentPreference) => void;
  /** Apply defaults after the persisted display preferences have been removed. */
  resetDisplayPreferences: () => void;
}

export const DISPLAY_PREFERENCE_SETTING_KEYS = {
  fontSize: "display_font_size",
  pronunciationAutoplay: "pronunciation_autoplay",
  pronunciationAccent: "pronunciation_default_accent",
} as const;
const FONT_SIZE_VALUES = new Set<DisplayFontSize>(["small", "medium", "large"]);
const PRONUNCIATION_ACCENT_VALUES = new Set<PronunciationAccentPreference>(["uk", "us", "any"]);
const FONT_SIZE_DEFAULT: DisplayFontSize = "medium";
const ROOT_FONT_SIZE: Record<DisplayFontSize, string> = {
  small: "15px",
  medium: "16px",
  large: "17px",
};
const PRONUNCIATION_AUTOPLAY_DEFAULT = true;
const PRONUNCIATION_ACCENT_DEFAULT: PronunciationAccentPreference = "uk";

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue | null>(null);

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<DisplayFontSize>(FONT_SIZE_DEFAULT);
  const [pronunciationAutoplay, setPronunciationAutoplayState] = useState<boolean>(
    PRONUNCIATION_AUTOPLAY_DEFAULT,
  );
  const [pronunciationAccent, setPronunciationAccentState] =
    useState<PronunciationAccentPreference>(PRONUNCIATION_ACCENT_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api.settings.get<unknown>({ key: DISPLAY_PREFERENCE_SETTING_KEYS.fontSize }),
      api.settings.get<unknown>({ key: DISPLAY_PREFERENCE_SETTING_KEYS.pronunciationAutoplay }),
      api.settings.get<unknown>({ key: DISPLAY_PREFERENCE_SETTING_KEYS.pronunciationAccent }),
    ])
      .then(([fontStored, autoplayStored, accentStored]) => {
        if (cancelled) return;
        setFontSizeState(normalizeFontSize(fontStored));
        setPronunciationAutoplayState(normalizeAutoplay(autoplayStored));
        setPronunciationAccentState(normalizePronunciationAccent(accentStored));
      })
      .catch((err) => {
        console.error("[DisplayPreferencesProvider] failed to read display settings", err);
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
    api.settings
      .set({ key: DISPLAY_PREFERENCE_SETTING_KEYS.fontSize, value: next })
      .catch((err) => {
        console.error("[DisplayPreferencesProvider] failed to persist display setting", err);
      });
  }, []);

  const setPronunciationAutoplay = useCallback((next: boolean) => {
    setPronunciationAutoplayState(next);
    api.settings
      .set({ key: DISPLAY_PREFERENCE_SETTING_KEYS.pronunciationAutoplay, value: next })
      .catch((err) => {
        console.error("[DisplayPreferencesProvider] failed to persist autoplay setting", err);
      });
  }, []);

  const setPronunciationAccent = useCallback((next: PronunciationAccentPreference) => {
    setPronunciationAccentState(next);
    api.settings
      .set({ key: DISPLAY_PREFERENCE_SETTING_KEYS.pronunciationAccent, value: next })
      .catch((err) => {
        console.error("[DisplayPreferencesProvider] failed to persist accent setting", err);
      });
  }, []);

  const resetDisplayPreferences = useCallback(() => {
    setFontSizeState(FONT_SIZE_DEFAULT);
    setPronunciationAutoplayState(PRONUNCIATION_AUTOPLAY_DEFAULT);
    setPronunciationAccentState(PRONUNCIATION_ACCENT_DEFAULT);
  }, []);

  const value = useMemo(
    () => ({
      fontSize,
      setFontSize,
      pronunciationAutoplay,
      setPronunciationAutoplay,
      pronunciationAccent,
      setPronunciationAccent,
      resetDisplayPreferences,
    }),
    [
      fontSize,
      setFontSize,
      pronunciationAutoplay,
      setPronunciationAutoplay,
      pronunciationAccent,
      setPronunciationAccent,
      resetDisplayPreferences,
    ],
  );

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
    : FONT_SIZE_DEFAULT;
}

function normalizeAutoplay(value: unknown): boolean {
  // Treat anything not explicitly `false` as `true` so a fresh install
  // (null/undefined) gets the kid-friendly default. Tutor can flip via
  // Settings → Pronunciation autoplay.
  if (value === false) return false;
  if (value === "false") return false;
  return PRONUNCIATION_AUTOPLAY_DEFAULT;
}

function normalizePronunciationAccent(value: unknown): PronunciationAccentPreference {
  return typeof value === "string" &&
    PRONUNCIATION_ACCENT_VALUES.has(value as PronunciationAccentPreference)
    ? (value as PronunciationAccentPreference)
    : PRONUNCIATION_ACCENT_DEFAULT;
}
