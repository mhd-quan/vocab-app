import { cn } from "@/lib/cn";

export interface XPBadgeProps {
  xp: number;
  className?: string;
}

export function XPBadge({ xp, className }: XPBadgeProps) {
  const safeXp = Math.max(0, Math.round(xp));
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-pill border border-xp/30 bg-xp/10 px-3 font-semibold text-xp",
        className,
      )}
      aria-label={`${safeXp} XP`}
    >
      <SparkIcon className="h-4 w-4" />
      <span className="font-mono text-sm text-app">{safeXp}</span>
      <span className="text-xs uppercase text-muted">XP</span>
    </div>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M12 2.8 14.2 8l5.6.5-4.2 3.7 1.3 5.5-4.9-2.9-4.9 2.9 1.3-5.5-4.2-3.7L9.8 8 12 2.8Z"
      />
    </svg>
  );
}
