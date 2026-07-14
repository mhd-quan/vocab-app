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
  neutral: "[--trace-rgb:var(--color-iris)]",
  accent: "[--trace-rgb:var(--color-iris)]",
  success: "[--trace-rgb:var(--color-moss)]",
  warning: "[--trace-rgb:var(--color-ochre)]",
  danger: "[--trace-rgb:var(--color-danger-fill)]",
  xp: "[--trace-rgb:var(--color-iris)]",
  rare: "[--trace-rgb:var(--color-iris)]",
  epic: "[--trace-rgb:var(--color-iris)]",
  mastery: "[--trace-rgb:var(--color-ochre)]",
  focus: "[--trace-rgb:var(--color-iris)]",
  sky: "[--trace-rgb:var(--color-iris)]",
  coral: "[--trace-rgb:var(--color-danger-fill)]",
  lime: "[--trace-rgb:var(--color-moss)]",
  pink: "[--trace-rgb:var(--color-iris)]",
  ember: "[--trace-rgb:var(--color-ochre)]",
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
        "object-surface p-4",
        tone !== "neutral" && "learning-trace",
        interactive &&
          "transition-colors duration-fast hover:bg-surface-2/70 active:bg-surface-3/55",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
