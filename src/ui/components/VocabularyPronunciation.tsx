import type { DictionaryAudioRef } from "@/data/dictionary";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import {
  type PreferredPronunciationAccent,
  PronunciationControls,
} from "@/ui/components/PronunciationControls";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const LOOKUP_GC_TIME_MS = 10 * 60_000;

export function VocabularyPronunciation({
  headword,
  fallbackRefs = [],
  autoPlayKey = null,
  preferredAccent = "uk",
  size = "sm",
  hotkeys,
  className,
}: {
  headword: string;
  fallbackRefs?: ReadonlyArray<DictionaryAudioRef>;
  autoPlayKey?: string | null;
  preferredAccent?: PreferredPronunciationAccent;
  size?: "sm" | "md";
  hotkeys?: Partial<Record<"uk" | "us" | "preferred", string>>;
  className?: string;
}) {
  const term = headword.trim();
  const entryQ = useQuery({
    queryKey: queryKeys.dictionary.lookup(term),
    queryFn: () => api.dictionary.lookup({ term }),
    enabled: term.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: LOOKUP_GC_TIME_MS,
  });

  const audioRefs = useMemo(
    () => mergeAudioRefs(entryQ.data?.audio ?? [], fallbackRefs),
    [entryQ.data?.audio, fallbackRefs],
  );

  if (audioRefs.length === 0) return null;

  return (
    <PronunciationControls
      audioRefs={audioRefs}
      autoPlayKey={autoPlayKey}
      preferredAccent={preferredAccent}
      size={size}
      hotkeys={hotkeys}
      className={className}
    />
  );
}

function mergeAudioRefs(
  primary: ReadonlyArray<DictionaryAudioRef>,
  fallback: ReadonlyArray<DictionaryAudioRef>,
): DictionaryAudioRef[] {
  const seen = new Set<string>();
  const out: DictionaryAudioRef[] = [];
  for (const audio of [...primary, ...fallback]) {
    if (!audio.ref.trim() || seen.has(audio.ref)) continue;
    seen.add(audio.ref);
    out.push(audio);
  }
  return out;
}
