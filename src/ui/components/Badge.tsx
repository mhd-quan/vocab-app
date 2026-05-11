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
  uppercase?: boolean;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border-subtle bg-surface-2 text-app",
  muted: "border-border-subtle bg-surface-1 text-muted",
  accent: "border-accent/40 bg-accent/10 text-accent",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
  xp: "border-xp/40 bg-xp/10 text-xp",
  rare: "border-rare/40 bg-rare/10 text-rare",
  epic: "border-epic/40 bg-epic/10 text-epic",
  mastery: "border-mastery/40 bg-mastery/10 text-mastery",
  focus: "border-focus/40 bg-focus/10 text-focus",
  sky: "border-sky/40 bg-sky/10 text-sky",
  coral: "border-coral/40 bg-coral/10 text-coral",
  lime: "border-lime/40 bg-lime/10 text-lime",
  pink: "border-pink/40 bg-pink/10 text-pink",
  ember: "border-ember/40 bg-ember/10 text-ember",
};

export function Badge({ tone = "neutral", children, className, uppercase }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        uppercase && "uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
