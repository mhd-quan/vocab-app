/**
 * ProgressBubble — large rounded chip used to surface session progress
 * (e.g. "7 / 15") in the student session header. The bubble fills with
 * the accent colour as `current / total` advances; an ARIA progressbar
 * role keeps it accessible to screen readers.
 *
 * Pure presentational — no data fetching. The session player passes its
 * own index + deck length.
 */
import { cn } from "@/lib/cn";

export interface ProgressBubbleProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export function ProgressBubble({ current, total, label, className }: ProgressBubbleProps) {
  const safeTotal = Math.max(0, total);
  const safeCurrent = Math.max(0, Math.min(current, safeTotal));
  const pct = safeTotal === 0 ? 0 : Math.round((safeCurrent / safeTotal) * 100);

  return (
    // Progress is read-only — screen readers announce it via role="progressbar"
    // but it doesn't accept keyboard focus. tabIndex={-1} silences the
    // focusable-interactive lint without putting the bubble in the tab order.
    <div
      role="progressbar"
      tabIndex={-1}
      aria-valuenow={safeCurrent}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-label={label ?? `${safeCurrent} of ${safeTotal}`}
      className={cn(
        "relative inline-flex h-8 min-w-24 items-center overflow-hidden rounded-md bg-surface-2 px-3 text-sm font-medium text-app",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-accent/15 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
      <span className="relative">{`${safeCurrent} / ${safeTotal}`}</span>
    </div>
  );
}
