import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

type BentoTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
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

type BentoElement = "section" | "article" | "div" | "li";

export interface BentoCardProps extends HTMLAttributes<HTMLElement> {
  as?: BentoElement;
  children: ReactNode;
  interactive?: boolean;
  tone?: BentoTone;
}

const TONES: Record<BentoTone, string> = {
  neutral: "border-border-subtle bg-surface-1 [--glow-rgb:var(--color-accent)]",
  accent: "border-accent/25 bg-accent/10 [--glow-rgb:var(--color-accent)]",
  success: "border-success/25 bg-success/10 [--glow-rgb:var(--color-success)]",
  warning: "border-warning/30 bg-warning/10 [--glow-rgb:var(--color-warning)]",
  danger: "border-danger/25 bg-danger/10 [--glow-rgb:var(--color-danger)]",
  xp: "border-xp/30 bg-xp/10 [--glow-rgb:var(--color-xp)]",
  rare: "border-rare/30 bg-rare/10 [--glow-rgb:var(--color-rare)]",
  epic: "border-epic/30 bg-epic/10 [--glow-rgb:var(--color-epic)]",
  mastery: "border-mastery/35 bg-mastery/10 [--glow-rgb:var(--color-mastery)]",
  focus: "border-focus/30 bg-focus/10 [--glow-rgb:var(--color-focus)]",
  sky: "border-sky/30 bg-sky/10 [--glow-rgb:var(--color-sky)]",
  coral: "border-coral/30 bg-coral/10 [--glow-rgb:var(--color-coral)]",
  lime: "border-lime/30 bg-lime/10 [--glow-rgb:var(--color-lime)]",
  pink: "border-pink/30 bg-pink/10 [--glow-rgb:var(--color-pink)]",
  ember: "border-ember/35 bg-ember/10 [--glow-rgb:var(--color-ember)]",
};

export function BentoCard({
  as: Component = "section",
  children,
  className,
  interactive,
  tone = "neutral",
  ...props
}: BentoCardProps) {
  return (
    <Component
      className={cn(
        "motion-card motion-enter isolate rounded-bento border p-5 shadow-card transition-[background-color,border-color,box-shadow]",
        "dark:shadow-card-dark",
        interactive && "hover:border-border-strong hover:shadow-lift",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
