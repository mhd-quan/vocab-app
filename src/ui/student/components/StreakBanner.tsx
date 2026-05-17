/**
 * StreakBanner — large day-streak surface for the student header.
 *
 * Pure presentational over `StreakFlame` + a couple of labels. The
 * banner doesn't fetch its own data; the layout passes the resolved
 * StreakStats so we don't double-query alongside the home screen.
 */
import { cn } from "@/lib/cn";
import type { StreakStats } from "@/modules/rewards";
import { StreakFlame } from "@/ui/components/LearningIcons";

export interface StreakBannerProps {
  stats: StreakStats | undefined;
  /** Compact = single chip; full = chip + sub-label. Defaults to compact. */
  variant?: "compact" | "full";
  className?: string;
}

export function StreakBanner({ stats, variant = "compact", className }: StreakBannerProps) {
  const current = stats?.currentStreak ?? 0;
  const practicedToday = stats?.practicedToday ?? false;

  // While the streak query is in flight we still render a muted shell so
  // the layout doesn't jump when data arrives.
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm font-semibold",
        current > 0 ? "text-app" : "text-muted",
        className,
      )}
      aria-label={`Day streak: ${current}`}
    >
      <StreakFlame streak={current} className="h-5 w-5" />
      <span>{current}</span>
      {variant === "full" ? (
        <span className="text-xs font-medium text-muted">
          {practicedToday ? "today ✓" : "practice today!"}
        </span>
      ) : null}
    </div>
  );
}
