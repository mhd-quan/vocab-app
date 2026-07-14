import { cn } from "@/lib/cn";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface RewardToastProps {
  /** Stable id — re-mounting the component on the same id is a no-op. */
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  /** ms before auto-dismiss. Pass `Infinity` to keep it open. */
  durationMs?: number;
  onDismiss: () => void;
  /** Subtle visual flavour. */
  tone?: "celebrate" | "streak";
}

const DEFAULT_DURATION = 2_500;

/**
 * Slide-in toast for in-session reward feedback. Renders into a portal so
 * stacking inside SessionPlayer's flex column doesn't push exercises down,
 * and unmounts itself after `durationMs` via `onDismiss`.
 *
 * The component intentionally renders nothing during SSR / before mount so
 * the portal target (`document.body`) is always available.
 */
export function RewardToast({
  id,
  title,
  description,
  icon,
  durationMs = DEFAULT_DURATION,
  onDismiss,
  tone = "celebrate",
}: RewardToastProps) {
  const [visible, setVisible] = useState(false);

  // Mount → fade in next frame → schedule dismiss.
  useEffect(() => {
    const enter = window.setTimeout(() => setVisible(true), 16);
    if (durationMs === Number.POSITIVE_INFINITY) {
      return () => window.clearTimeout(enter);
    }
    const exit = window.setTimeout(() => {
      setVisible(false);
      // Give the slide-out 200ms before unmounting upstream.
      window.setTimeout(onDismiss, 220);
    }, durationMs);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(exit);
    };
  }, [durationMs, onDismiss]);

  if (typeof document === "undefined") return null;

  const palette =
    tone === "streak" ? "border-warning/45 text-warning" : "border-success/45 text-success";

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-testid={`reward-toast-${id}`}
      className={cn(
        "pointer-events-none fixed left-1/2 top-[calc(var(--size-toolbar)+0.75rem)] z-50 -translate-x-1/2 transition-all duration-200 motion-reduce:translate-y-0 motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
      )}
    >
      <div
        className={cn(
          "popover-material pointer-events-auto flex items-center gap-3 overflow-hidden rounded-overlay border px-4 py-3 shadow-lift",
          palette,
        )}
      >
        {icon ? <span className="grid h-8 w-8 place-items-center">{icon}</span> : null}
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold text-app">{title}</span>
          {description ? <span className="text-[11px] text-muted">{description}</span> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
