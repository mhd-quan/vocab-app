import type { DictionaryAudioRef } from "@/data/dictionary";
/**
 * Reusable pronunciation playback strip.
 *
 * Why this exists:
 *   Audio playback was duplicated across `DictionaryLookupPanel.tsx`
 *   and the personal-dict session card. v0.10 also needs autoplay
 *   wired into curated-YAML flashcards (`FlashcardCard`,
 *   `AudioRecallCard`). Centralising the play logic + the autoplay
 *   key contract in one place keeps every surface consistent — and
 *   means the autoplay setting (Phase 7) only has to flow to one prop.
 *
 * Contract:
 *   - `audioRefs`     : candidate pronunciations. The control reorders
 *                       them by the tutor's preferred accent before
 *                       autoplay/manual buttons render.
 *   - `autoPlayKey`   : when non-null, the FIRST ready audio plays as
 *                       soon as it loads. Passing the same key twice
 *                       does NOT replay — change the key per card.
 *                       Pass `null` to disable autoplay entirely.
 *   - `size`          : "sm" (toolbar) or "md" (card hero) padding.
 *
 * All audio data is cached forever via React Query (`staleTime:
 * Infinity`), so prefetched cards play instantly.
 */
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Button } from "@/ui/components/Button";
import { useQueries } from "@tanstack/react-query";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PreferredPronunciationAccent = "uk" | "us" | "any";

const AUDIO_GC_TIME_MS = 5 * 60_000;

export interface PronunciationControlsProps {
  audioRefs: ReadonlyArray<DictionaryAudioRef>;
  /**
   * Identity-by-string of the current card. When this value transitions
   * from `null`/previous → non-null and the audio is ready, the first
   * audio auto-plays. No-op when null.
   */
  autoPlayKey?: string | null;
  preferredAccent?: PreferredPronunciationAccent;
  showLabel?: boolean;
  size?: "sm" | "md";
  hotkeys?: Partial<Record<"uk" | "us" | "preferred", string>>;
  className?: string;
}

export function PronunciationControls({
  audioRefs,
  autoPlayKey = null,
  preferredAccent = "uk",
  showLabel = true,
  size = "sm",
  hotkeys,
  className,
}: PronunciationControlsProps) {
  const [playingRef, setPlayingRef] = useState<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const playedForKey = useRef<string | null>(null);
  const orderedAudioRefs = useMemo(
    () => orderAudioRefs(audioRefs, preferredAccent),
    [audioRefs, preferredAccent],
  );
  const visibleAudioRefs = useMemo(
    () => visiblePronunciations(orderedAudioRefs),
    [orderedAudioRefs],
  );

  const queries = useQueries({
    queries: orderedAudioRefs.map((audio) => ({
      queryKey: queryKeys.dictionary.audio(audio.ref),
      queryFn: () => api.dictionary.audio({ ref: audio.ref }),
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: AUDIO_GC_TIME_MS,
    })),
  });

  const play = useCallback(async (ref: string, dataUrl: string | undefined) => {
    if (!dataUrl) return;
    audioElementRef.current?.pause();
    const player = new Audio(dataUrl);
    audioElementRef.current = player;
    setPlayingRef(ref);
    player.onended = () => setPlayingRef(null);
    player.onerror = () => setPlayingRef(null);
    await player.play().catch(() => setPlayingRef(null));
  }, []);

  const playRef = useCallback(
    (ref: string) => {
      const index = orderedAudioRefs.findIndex((audio) => audio.ref === ref);
      if (index < 0) return;
      const dataUrl = queries[index]?.data?.dataUrl;
      void play(ref, dataUrl);
    },
    [orderedAudioRefs, play, queries],
  );

  const playAccent = useCallback(
    (accent: "uk" | "us" | "preferred") => {
      const audio =
        accent === "preferred"
          ? orderedAudioRefs[0]
          : orderedAudioRefs.find((item) => item.accent === accent);
      if (!audio) return;
      playRef(audio.ref);
    },
    [orderedAudioRefs, playRef],
  );

  // Autoplay effect — fires once per `autoPlayKey` transition once
  // the preferred audio is loaded. We compare against `playedForKey`
  // so React StrictMode's double-invoke doesn't double-fire.
  useEffect(() => {
    if (!autoPlayKey) return;
    if (playedForKey.current === autoPlayKey) return;
    const first = orderedAudioRefs[0];
    if (!first) return;
    const data = queries[0]?.data;
    if (!data?.dataUrl) return; // wait for load
    playedForKey.current = autoPlayKey;
    void play(first.ref, data.dataUrl);
  }, [autoPlayKey, orderedAudioRefs, queries, play]);

  useEffect(() => {
    if (!hotkeys) return;
    const activeHotkeys = hotkeys;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      }
      const key = e.key.toLowerCase();
      const matched = (["uk", "us", "preferred"] as const).find(
        (accent) => activeHotkeys[accent]?.toLowerCase() === key,
      );
      if (!matched) return;
      e.preventDefault();
      playAccent(matched);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, playAccent]);

  // Stop playback + clear key tracker when the component unmounts.
  useEffect(() => {
    return () => {
      audioElementRef.current?.pause();
      audioElementRef.current = null;
    };
  }, []);

  if (orderedAudioRefs.length === 0) return null;

  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      {visibleAudioRefs.map((audio) => {
        const index = orderedAudioRefs.findIndex((item) => item.ref === audio.ref);
        const asset = queries[index]?.data;
        const loading = queries[index]?.isLoading;
        const hotkey =
          audio.accent === "uk" ? hotkeys?.uk : audio.accent === "us" ? hotkeys?.us : undefined;
        return (
          <Button
            key={audio.ref}
            variant="secondary"
            size={size}
            onClick={() => void play(audio.ref, asset?.dataUrl)}
            disabled={!asset || playingRef === audio.ref}
            title={
              hotkey ? `${audioLabel(audio)} pronunciation (${hotkey.toUpperCase()})` : undefined
            }
          >
            <AppGlyph
              name={playingRef === audio.ref ? "playAudio" : "volume"}
              className="h-4 w-4"
            />
            {playingRef === audio.ref
              ? "Playing..."
              : loading
                ? "Loading"
                : showLabel
                  ? hotkey
                    ? `${audioLabel(audio)} ${hotkey.toUpperCase()}`
                    : audioLabel(audio)
                  : "Play audio"}
          </Button>
        );
      })}
    </div>
  );
}

function orderAudioRefs(
  refs: ReadonlyArray<DictionaryAudioRef>,
  preferredAccent: PreferredPronunciationAccent,
): DictionaryAudioRef[] {
  const normalized = refs.map(normalizeAudioRef);
  const seen = new Set<string>();
  const unique = normalized.filter((ref) => {
    if (seen.has(ref.ref)) return false;
    seen.add(ref.ref);
    return true;
  });
  if (preferredAccent === "any") return unique;
  return [...unique].sort(
    (a, b) => accentRank(a.accent, preferredAccent) - accentRank(b.accent, preferredAccent),
  );
}

function visiblePronunciations(refs: ReadonlyArray<DictionaryAudioRef>): DictionaryAudioRef[] {
  const out: DictionaryAudioRef[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const key = ref.accent === "other" ? `other:${ref.ref}` : ref.accent;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function accentRank(
  accent: DictionaryAudioRef["accent"],
  preferredAccent: Exclude<PreferredPronunciationAccent, "any">,
): number {
  if (accent === preferredAccent) return 0;
  if (accent === "other") return 2;
  return 1;
}

function normalizeAudioRef(audio: DictionaryAudioRef): DictionaryAudioRef {
  const inferred = inferAccent(audio.ref);
  return {
    ...audio,
    accent: audio.accent === "other" ? inferred : audio.accent,
  };
}

function inferAccent(ref: string): DictionaryAudioRef["accent"] {
  const lower = ref.toLowerCase();
  if (lower.includes("__gb_") || lower.includes("_gb_")) return "uk";
  if (lower.includes("__us_") || lower.includes("_us_")) return "us";
  return "other";
}

function audioLabel(audio: DictionaryAudioRef): string {
  if (audio.accent === "uk") return "UK";
  if (audio.accent === "us") return "US";
  return audio.label || "Audio";
}
