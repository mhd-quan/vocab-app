/**
 * Seeded PRNG + helpers. We deliberately avoid `Math.random` so the deck a
 * student sees on a given seed is reproducible (useful for debugging and
 * for replay-style features later).
 *
 * mulberry32 is a tiny well-distributed 32-bit PRNG. cyrb53 is a fast
 * non-cryptographic string hash; we use it to turn the session seed
 * string into the integer state mulberry32 needs.
 */

export function cyrb53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // Combine to a 32-bit unsigned int — that's all mulberry32 needs.
  return (h1 ^ h2) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFromSeed(seedString: string): () => number {
  return mulberry32(cyrb53(seedString) || 1);
}

/** Fisher–Yates with the supplied RNG. Returns a new array (input untouched). */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Pick `count` distinct items uniformly without replacement. */
export function sampleWithoutReplacement<T>(
  items: readonly T[],
  count: number,
  rng: () => number,
): T[] {
  if (count >= items.length) return shuffle(items, rng);
  return shuffle(items, rng).slice(0, count);
}
