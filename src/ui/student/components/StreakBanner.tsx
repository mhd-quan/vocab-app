/**
 * StreakBanner — large day-streak surface for the student header.
 *
 * Pure presentational over `StreakFlame` + a couple of labels. The
 * banner doesn't fetch its own data; the layout passes the resolved
 * StreakStats so we don't double-query alongside the home screen.
 */
import { cn } from "@/lib/cn";
import type { StreakStats } from "@/modules/rewards";
import { AppGlyph } from "@/ui/components/AppGlyph";
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
        "inline-flex h-8 items-center gap-1.5 rounded-md bg-surface-2 px-2.5 text-sm font-medium",
        current > 0 ? "text-app" : "text-muted",
        className,
      )}
      aria-label={`Day streak: ${current}`}
    >
      <StreakFlame streak={current} className="h-5 w-5" />
      <span>{current}</span>
      {variant === "full" ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
          {practicedToday ? (
            <>
              <span>today</span>
              <AppGlyph name="check" className="h-3.5 w-3.5 text-success" />
            </>
          ) : (
            "practice today!"
          )}
        </span>
      ) : null}
    </div>
  );
}
