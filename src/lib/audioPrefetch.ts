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
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** Cap for in-memory audio cache. ~12 entries × <100 KB stays well under the 4GB envelope. */
const DEFAULT_LOOK_AHEAD = 3;
const AUDIO_GC_TIME_MS = 5 * 60_000;

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
