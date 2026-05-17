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
        d="M13.1 2.8 4.5 13.1c-.5.6-.1 1.5.7 1.5h5l-1.3 6.1c-.2.9.9 1.4 1.5.7l8.9-10.8c.5-.6.1-1.5-.7-1.5h-5.2l1.1-5.8c.2-.8-.8-1.3-1.4-.5Z"
      />
    </svg>
  );
}
