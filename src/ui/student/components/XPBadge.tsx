import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";

export interface XPBadgeProps {
  xp: number;
  className?: string;
}

export function XPBadge({ xp, className }: XPBadgeProps) {
  const safeXp = Math.max(0, Math.round(xp));
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-control bg-surface-2 px-2.5 font-medium text-xp",
        className,
      )}
      aria-label={`${safeXp} XP`}
    >
      <AppGlyph name="spark" filled className="h-4 w-4" />
      <span className="tabular-figure text-sm text-app">{safeXp}</span>
      <span className="text-xs text-muted">XP</span>
    </div>
  );
}
