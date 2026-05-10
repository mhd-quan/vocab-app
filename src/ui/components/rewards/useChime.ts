import { useCallback, useRef } from "react";

/**
 * Returns a `playChime()` handle backed by a lazy-initialised AudioContext.
 * Synthesised — no asset file. Calling `playChime()` is a no-op when
 * `enabled` is false or the host environment lacks Web Audio (jsdom,
 * Safari pre-user-gesture, etc.).
 *
 * Two short sine tones at C5 + E5 give a warm "got one!" feedback that
 * works across speakers without sounding shrill or cartoonish.
 */
export function useChime(enabled: boolean): () => void {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    try {
      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = new Ctx();
        ctxRef.current = ctx;
      }
      // Some browsers suspend the context until a user gesture; resume is
      // safe to call from inside the click handler that triggered the chime.
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      playTone(ctx, 523.25, now, 0.18); // C5
      playTone(ctx, 659.25, now + 0.07, 0.22); // E5
    } catch (err) {
      console.debug("[useChime] suppressed", err);
    }
  }, [enabled]);
}

function playTone(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  // Quick attack, gentle release — avoids the click of a hard cut.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}
