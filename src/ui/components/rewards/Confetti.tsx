import { useEffect } from "react";

export interface ConfettiBurstProps {
  /**
   * Bumping this triggers a fresh burst — every render with a new value
   * fires confetti once. Pass a counter from the parent.
   */
  fireKey: number;
  /** Particle count multiplier; defaults to 80. */
  particleCount?: number;
  /** Spread arc in degrees; defaults to 70. */
  spread?: number;
  /** Vertical origin (0 = top, 1 = bottom). */
  originY?: number;
}

/**
 * Headless trigger for canvas-confetti. Mount it once near the top of the
 * session UI and bump `fireKey` to celebrate; the component owns no state
 * other than the dynamic import handle.
 *
 * Loaded lazily so non-celebrating screens don't pay the bundle cost, and
 * so jsdom-based tests (which lack a canvas) don't fail at import time.
 */
export function ConfettiBurst({
  fireKey,
  particleCount = 80,
  spread = 70,
  originY = 0.4,
}: ConfettiBurstProps) {
  useEffect(() => {
    if (fireKey <= 0) return;
    let cancelled = false;
    void import("canvas-confetti")
      .then((mod) => {
        if (cancelled) return;
        const fire = mod.default;
        try {
          fire({
            particleCount,
            spread,
            origin: { y: originY },
            disableForReducedMotion: true,
          });
        } catch (err) {
          // Reduced-motion or canvas-less env (jsdom) — silent.
          console.debug("[Confetti] suppressed", err);
        }
      })
      .catch((err) => {
        console.warn("[Confetti] failed to load", err);
      });
    return () => {
      cancelled = true;
    };
  }, [fireKey, particleCount, spread, originY]);

  return null;
}
