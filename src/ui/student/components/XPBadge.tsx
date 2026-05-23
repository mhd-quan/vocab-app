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
        "inline-flex h-10 items-center gap-2 rounded-pill border border-xp/30 bg-xp/10 px-3 font-semibold text-xp",
        className,
      )}
      aria-label={`${safeXp} XP`}
    >
      <AppGlyph name="spark" filled className="h-4 w-4" />
      <span className="font-mono text-sm text-app">{safeXp}</span>
      <span className="text-xs uppercase text-muted">XP</span>
    </div>
  );
}
