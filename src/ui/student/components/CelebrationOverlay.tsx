/**
 * CelebrationOverlay — single mount that fires confetti + chime + slide-in
 * toasts in response to in-session milestones.
 *
 * Composes the existing rewards primitives so each surface (curated
 * session, personal-vocab session, future grammar drill) gets a
 * consistent celebration without re-wiring confetti/chime/toast plumbing.
 *
 * Contract:
 *   - `burstKey`: bump from the parent each time a confetti burst should
 *     fire (e.g. on a 5-streak). Reusing the same value is a no-op.
 *   - `chimeEnabled`: forwarded to `useChime`; respects the tutor's
 *     "Reward sounds" setting.
 *   - `toasts`: ordered queue of unlock toasts. The overlay renders the
 *     head; `onDismiss` removes it so the next one slides in.
 *
 * The overlay doesn't own state besides the chime context — telemetry
 * (achievement evaluation, persistence) stays in the caller.
 */
import {
  ConfettiBurst,
  type ConfettiBurstProps,
  RewardToast,
  useChime,
} from "@/ui/components/rewards";
import { type ReactNode, useEffect } from "react";

export interface CelebrationToast {
  /** Stable key — React reconciliation + parent's queue identity. */
  key: number;
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  tone?: "celebrate" | "streak";
}

export interface CelebrationOverlayProps {
  burstKey: number;
  chimeEnabled: boolean;
  toasts: ReadonlyArray<CelebrationToast>;
  onDismiss: (key: number) => void;
  /** Forwarded to ConfettiBurst — controls how showy the burst is. */
  confetti?: Pick<ConfettiBurstProps, "particleCount" | "spread" | "originY">;
}

export function CelebrationOverlay({
  burstKey,
  chimeEnabled,
  toasts,
  onDismiss,
  confetti,
}: CelebrationOverlayProps) {
  const playChime = useChime(chimeEnabled);

  // Fire the chime alongside each confetti burst — keeping the two
  // sensory channels in sync is what makes the moment feel rewarding.
  useEffect(() => {
    if (burstKey <= 0) return;
    playChime();
  }, [burstKey, playChime]);

  const head = toasts[0];

  return (
    <>
      <ConfettiBurst
        fireKey={burstKey}
        particleCount={confetti?.particleCount}
        spread={confetti?.spread}
        originY={confetti?.originY}
      />
      {head ? (
        <RewardToast
          id={head.id}
          title={head.title}
          description={head.description}
          icon={head.icon}
          tone={head.tone}
          onDismiss={() => onDismiss(head.key)}
        />
      ) : null}
    </>
  );
}
