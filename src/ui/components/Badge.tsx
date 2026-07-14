import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "xp"
  | "rare"
  | "epic"
  | "mastery"
  | "focus"
  | "sky"
  | "coral"
  | "lime"
  | "pink"
  | "ember";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-app",
  muted: "bg-surface-2 text-muted",
  accent: "bg-accent-fill/12 text-accent",
  success: "bg-success-fill/12 text-success",
  warning: "bg-warning-fill/12 text-warning",
  danger: "bg-danger-fill/12 text-danger",
  xp: "bg-accent-fill/12 text-accent",
  rare: "bg-accent-fill/12 text-accent",
  epic: "bg-accent-fill/12 text-accent",
  mastery: "bg-warning-fill/12 text-warning",
  focus: "bg-accent-fill/12 text-accent",
  sky: "bg-accent-fill/12 text-accent",
  coral: "bg-danger-fill/12 text-danger",
  lime: "bg-success-fill/12 text-success",
  pink: "bg-accent-fill/12 text-accent",
  ember: "bg-warning-fill/12 text-warning",
};

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center gap-1 rounded-control px-1.5 py-0.5 text-caption font-medium tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
