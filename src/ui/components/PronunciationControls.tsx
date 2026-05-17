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
 *   - `audioRefs`     : ordered preference list. Index 0 is the "best"
 *                       audio (already deduped accent-aware by the
 *                       pack reader; this component does not re-rank).
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
import { Button } from "@/ui/components/Button";
import { useQueries } from "@tanstack/react-query";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PronunciationControlsProps {
  audioRefs: ReadonlyArray<DictionaryAudioRef>;
  /**
   * Identity-by-string of the current card. When this value transitions
   * from `null`/previous → non-null and the audio is ready, the first
   * audio auto-plays. No-op when null.
   */
  autoPlayKey?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function PronunciationControls({
  audioRefs,
  autoPlayKey = null,
  size = "sm",
  className,
}: PronunciationControlsProps) {
  const [playingRef, setPlayingRef] = useState<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const playedForKey = useRef<string | null>(null);

  const queries = useQueries({
    queries: audioRefs.map((audio) => ({
      queryKey: queryKeys.dictionary.audio(audio.ref),
      queryFn: () => api.dictionary.audio({ ref: audio.ref }),
      staleTime: Number.POSITIVE_INFINITY,
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

  // Autoplay effect — fires once per `autoPlayKey` transition once
  // the preferred audio is loaded. We compare against `playedForKey`
  // so React StrictMode's double-invoke doesn't double-fire.
  useEffect(() => {
    if (!autoPlayKey) return;
    if (playedForKey.current === autoPlayKey) return;
    const first = audioRefs[0];
    if (!first) return;
    const data = queries[0]?.data;
    if (!data?.dataUrl) return; // wait for load
    playedForKey.current = autoPlayKey;
    void play(first.ref, data.dataUrl);
  }, [autoPlayKey, audioRefs, queries, play]);

  // Stop playback + clear key tracker when the component unmounts.
  useEffect(() => {
    return () => {
      audioElementRef.current?.pause();
      audioElementRef.current = null;
    };
  }, []);

  if (audioRefs.length === 0) return null;

  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      {audioRefs.map((audio, index) => {
        const asset = queries[index]?.data;
        const loading = queries[index]?.isLoading;
        return (
          <Button
            key={audio.ref}
            variant="secondary"
            size={size}
            onClick={() => void play(audio.ref, asset?.dataUrl)}
            disabled={!asset || playingRef === audio.ref}
          >
            {playingRef === audio.ref ? "Playing..." : loading ? "Loading" : audio.label}
          </Button>
        );
      })}
    </div>
  );
}
