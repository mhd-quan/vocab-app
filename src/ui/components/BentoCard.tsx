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
  | "focus";

type BentoElement = "section" | "article" | "div" | "li";

export interface BentoCardProps extends HTMLAttributes<HTMLElement> {
  as?: BentoElement;
  children: ReactNode;
  interactive?: boolean;
  tone?: BentoTone;
}

const TONES: Record<BentoTone, string> = {
  neutral: "border-border-subtle bg-surface-1",
  accent: "border-accent/25 bg-accent/10",
  success: "border-success/25 bg-success/10",
  warning: "border-warning/30 bg-warning/10",
  danger: "border-danger/25 bg-danger/10",
  xp: "border-xp/30 bg-xp/10",
  rare: "border-rare/30 bg-rare/10",
  epic: "border-epic/30 bg-epic/10",
  mastery: "border-mastery/35 bg-mastery/10",
  focus: "border-focus/30 bg-focus/10",
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
        "rounded-bento border p-5 shadow-card transition-[background-color,border-color,box-shadow,transform]",
        "dark:shadow-card-dark",
        interactive && "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
