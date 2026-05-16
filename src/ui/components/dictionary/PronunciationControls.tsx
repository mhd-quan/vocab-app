import type { DictionaryLearningAudioRef } from "@/data/dictionaryLearning";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Button } from "@/ui/components/Button";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

interface PronunciationControlsProps {
  audioRefs: DictionaryLearningAudioRef[];
  autoPlayKey?: string | null;
  preferredAccent?: "uk" | "us";
  className?: string;
}

export function PronunciationControls({
  audioRefs,
  autoPlayKey = null,
  preferredAccent = "uk",
  className,
}: PronunciationControlsProps) {
  const [playingRef, setPlayingRef] = useState<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayedKeyRef = useRef<string | null>(null);
  const visibleRefs = useMemo(() => visibleAudioRefs(audioRefs), [audioRefs]);
  const audioQueries = useQueries({
    queries: visibleRefs.map((audio) => ({
      queryKey: queryKeys.dictionary.audio(audio.ref),
      queryFn: () => api.dictionary.audio({ ref: audio.ref }),
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });

  const play = useMemo(
    () => async (ref: string, dataUrl: string | undefined) => {
      if (!dataUrl) return;
      audioElementRef.current?.pause();
      const player = new Audio(dataUrl);
      audioElementRef.current = player;
      setPlayingRef(ref);
      player.onended = () => setPlayingRef(null);
      player.onerror = () => setPlayingRef(null);
      await player.play().catch(() => setPlayingRef(null));
    },
    [],
  );

  useEffect(() => {
    if (!autoPlayKey || autoPlayedKeyRef.current === autoPlayKey) return;
    const preferredIndex = preferredAudioIndex(visibleRefs, preferredAccent);
    if (preferredIndex < 0) return;
    const audio = visibleRefs[preferredIndex];
    const asset = audioQueries[preferredIndex]?.data;
    if (!audio || !asset?.dataUrl) return;
    autoPlayedKeyRef.current = autoPlayKey;
    void play(audio.ref, asset.dataUrl);
  }, [audioQueries, autoPlayKey, play, preferredAccent, visibleRefs]);

  if (visibleRefs.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {visibleRefs.map((audio, index) => {
        const asset = audioQueries[index]?.data;
        const loading = audioQueries[index]?.isLoading;
        return (
          <Button
            key={audio.ref}
            variant="secondary"
            size="sm"
            onClick={() => void play(audio.ref, asset?.dataUrl)}
            disabled={!asset || playingRef === audio.ref}
          >
            {playingRef === audio.ref ? "Playing" : loading ? "Loading" : audioLabel(audio)}
          </Button>
        );
      })}
    </div>
  );
}

function visibleAudioRefs(audioRefs: DictionaryLearningAudioRef[]): DictionaryLearningAudioRef[] {
  const byAccent = new Map<DictionaryLearningAudioRef["accent"], DictionaryLearningAudioRef>();
  for (const audio of audioRefs) {
    if (!audio.ref.trim()) continue;
    if (!byAccent.has(audio.accent)) byAccent.set(audio.accent, audio);
  }
  return [byAccent.get("uk"), byAccent.get("us"), byAccent.get("other")].filter(
    (audio): audio is DictionaryLearningAudioRef => Boolean(audio),
  );
}

function preferredAudioIndex(
  audioRefs: DictionaryLearningAudioRef[],
  preferredAccent: "uk" | "us",
): number {
  const preferred = audioRefs.findIndex((audio) => audio.accent === preferredAccent);
  if (preferred >= 0) return preferred;
  const fallbackAccent = preferredAccent === "uk" ? "us" : "uk";
  const fallback = audioRefs.findIndex((audio) => audio.accent === fallbackAccent);
  return fallback >= 0 ? fallback : audioRefs.length > 0 ? 0 : -1;
}

function audioLabel(audio: DictionaryLearningAudioRef): string {
  if (audio.accent === "uk") return "UK";
  if (audio.accent === "us") return "US";
  return audio.label || "Audio";
}
