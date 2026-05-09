import { cn } from "@/lib/cn";

export interface PillProps {
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}

const TONES: Record<NonNullable<PillProps["tone"]>, string> = {
  neutral: "border-border-subtle bg-surface-1 text-app",
  accent: "border-accent/40 bg-accent/10 text-accent",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

export function Pill({ label, value, tone = "neutral" }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs",
        TONES[tone],
      )}
    >
      <span className="text-muted-2">{label}</span>
      <span className="text-muted-2">·</span>
      <span>{value}</span>
    </span>
  );
}
