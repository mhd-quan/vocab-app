import { cn } from "@/lib/cn";

type ProgressTone =
  | "accent"
  | "success"
  | "warning"
  | "xp"
  | "rare"
  | "epic"
  | "mastery"
  | "sky"
  | "coral"
  | "lime"
  | "pink"
  | "ember";

export interface ProgressMeterProps {
  value: number;
  max: number;
  label: string;
  className?: string;
  showValue?: boolean;
  tone?: ProgressTone;
}

const TONES: Record<ProgressTone, string> = {
  accent: "bg-iris",
  success: "bg-moss",
  warning: "bg-ochre",
  xp: "bg-iris",
  rare: "bg-iris",
  epic: "bg-iris",
  mastery: "bg-ochre",
  sky: "bg-iris",
  coral: "bg-danger-fill",
  lime: "bg-moss",
  pink: "bg-iris",
  ember: "bg-ochre",
};

export function ProgressMeter({
  value,
  max,
  label,
  className,
  showValue,
  tone = "accent",
}: ProgressMeterProps) {
  const safeMax = Math.max(max, 1);
  const clampedValue = Math.min(Math.max(value, 0), safeMax);
  const pct = Math.round((clampedValue / safeMax) * 100);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <progress className="sr-only" value={clampedValue} max={safeMax} aria-label={label} />
      <div aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3/80">
        <div
          className={cn(
            "progress-shimmer h-full rounded-full transition-[width] duration-base ease-out",
            TONES[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue ? <span className="tabular-figure text-xs text-muted">{pct}%</span> : null}
    </div>
  );
}
