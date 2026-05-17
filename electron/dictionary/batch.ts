/**
 * Batch dictionary lookup.
 *
 * Why this exists:
 *   `prepareUnitLesson` (personal-dict track) and any future session-prep
 *   flow that enriches N headwords with dictionary data was firing one
 *   IPC + one pack `lookup()` per term, serialised. On a 4GB / 1GHz
 *   target with a 50-entry lesson that was visibly stalling the session
 *   load. This module exposes a single-trip API: pack opens once, then
 *   walks the dedup-ed term list in a tight loop. The pack itself
 *   already keeps its file handle open across calls (see `mdict.ts`),
 *   so the win here is removing the IPC and renderer-side scheduling
 *   overhead.
 *
 * Behaviour: returns a keyed map `{ term → DictionaryEntry | null }`.
 * Terms that resolve to the same headword still get separate keys so
 * the caller can correlate input → result without re-normalising.
 *
 * Input cap: callers pass at most 200 terms per call. The IPC layer
 * enforces this via Zod.
 */

import type { DictionaryEntry } from "../../src/data/dictionary";
import { dictionaryLookup } from "./index";

export interface BatchLookupResult {
  /** Keyed by the *input* term — preserves whitespace/case the caller used. */
  entries: Record<string, DictionaryEntry | null>;
}

export function dictionaryBatchLookup(
  terms: ReadonlyArray<string>,
  configuredPath?: string | null,
): BatchLookupResult {
  const entries: Record<string, DictionaryEntry | null> = {};
  // Dedupe by normalised key to avoid re-doing identical lookups within
  // the same batch. We still return entries keyed by the original input.
  const cache = new Map<string, DictionaryEntry | null>();
  for (const term of terms) {
    if (term in entries) continue; // exact duplicate input
    const norm = term.trim().toLowerCase();
    let result: DictionaryEntry | null;
    if (cache.has(norm)) {
      result = cache.get(norm) ?? null;
    } else {
      result = dictionaryLookup(term, configuredPath);
      cache.set(norm, result);
    }
    entries[term] = result;
  }
  return { entries };
}
