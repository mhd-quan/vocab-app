import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "muted";

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
};

export function Badge({ tone = "neutral", children, className, uppercase }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider",
        uppercase && "uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
