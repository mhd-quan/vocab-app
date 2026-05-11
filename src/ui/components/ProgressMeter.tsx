import { cn } from "@/lib/cn";

type ProgressTone = "accent" | "success" | "warning" | "xp" | "rare" | "epic" | "mastery";

export interface ProgressMeterProps {
  value: number;
  max: number;
  label: string;
  className?: string;
  showValue?: boolean;
  tone?: ProgressTone;
}

const TONES: Record<ProgressTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  xp: "bg-xp",
  rare: "bg-rare",
  epic: "bg-epic",
  mastery: "bg-mastery",
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
      <div aria-hidden className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3/80">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", TONES[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue ? <span className="font-mono text-xs text-muted">{pct}%</span> : null}
    </div>
  );
}
