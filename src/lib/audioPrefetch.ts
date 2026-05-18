/**
 * Eagerly warm the React Query cache for upcoming audio refs.
 *
 * Why:
 *   Audio data crosses IPC + decodes a base64 blob from the dictionary
 *   pack. On a 4GB / 1 GHz target the first call for a fresh ref costs
 *   noticeable latency. By prefetching the *next* N cards' audio while
 *   the current card plays, the next card's autoplay starts instantly.
 *
 * How:
 *   `useAudioPrefetch(refs, lookAhead)` issues `prefetchQuery` for every
 *   ref in the look-ahead window. React Query handles deduping and LRU
 *   eviction (we set `gcTime: 5 min`, so audio we played 5 minutes ago
 *   eventually frees memory — fine for a 4GB device).
 *
 * The hook is fire-and-forget: it does not block render and does not
 * surface load state. The owning component drives playback via
 * `PronunciationControls`, which reuses the same query keys.
 */
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { PreferredPronunciationAccent } from "@/ui/components/PronunciationControls";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** Cap for in-memory audio cache. ~12 entries × <100 KB stays well under the 4GB envelope. */
const DEFAULT_LOOK_AHEAD = 3;
const AUDIO_GC_TIME_MS = 5 * 60_000;
const LOOKUP_GC_TIME_MS = 10 * 60_000;

export function useAudioPrefetch(
  refs: ReadonlyArray<string>,
  lookAhead: number = DEFAULT_LOOK_AHEAD,
): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (refs.length === 0) return;
    const slice = refs.slice(0, Math.max(0, lookAhead));
    for (const ref of slice) {
      void qc.prefetchQuery({
        queryKey: queryKeys.dictionary.audio(ref),
        queryFn: () => api.dictionary.audio({ ref }),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: AUDIO_GC_TIME_MS,
      });
    }
  }, [refs, lookAhead, qc]);
}

export function usePronunciationLookupPrefetch(
  terms: ReadonlyArray<string>,
  preferredAccent: PreferredPronunciationAccent = "uk",
  lookAhead: number = DEFAULT_LOOK_AHEAD,
): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (terms.length === 0) return;
    const unique = uniqueTerms(terms).slice(0, Math.max(0, lookAhead));
    for (const term of unique) {
      void qc
        .fetchQuery({
          queryKey: queryKeys.dictionary.lookup(term),
          queryFn: () => api.dictionary.lookup({ term }),
          staleTime: Number.POSITIVE_INFINITY,
          gcTime: LOOKUP_GC_TIME_MS,
        })
        .then((entry) => {
          const audio = choosePreferredAudio(entry?.audio ?? [], preferredAccent);
          if (!audio) return;
          void qc.prefetchQuery({
            queryKey: queryKeys.dictionary.audio(audio.ref),
            queryFn: () => api.dictionary.audio({ ref: audio.ref }),
            staleTime: Number.POSITIVE_INFINITY,
            gcTime: AUDIO_GC_TIME_MS,
          });
        })
        .catch((err) => {
          console.error("[audioPrefetch] dictionary lookup prefetch failed", err);
        });
    }
  }, [terms, preferredAccent, lookAhead, qc]);
}

function uniqueTerms(terms: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const normalized = term.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    out.push(normalized);
  }
  return out;
}

function choosePreferredAudio(
  audioRefs: ReadonlyArray<{ ref: string; accent: "uk" | "us" | "other" }>,
  preferredAccent: PreferredPronunciationAccent,
) {
  if (audioRefs.length === 0) return null;
  if (preferredAccent === "any") return audioRefs[0] ?? null;
  return (
    audioRefs.find((audio) => audio.accent === preferredAccent) ??
    audioRefs.find((audio) => audio.accent !== "other") ??
    audioRefs[0] ??
    null
  );
}
