import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-5 w-5 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

export function SeenIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M5 6.5h9.5a3.5 3.5 0 0 1 0 7H5a3 3 0 0 1 0-6h9.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path d="M8 17.5h8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </Svg>
  );
}

export function DueIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 8v4l3 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </Svg>
  );
}

export function AccuracyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" opacity="0.22" />
      <path
        d="m14.5 9.5-3.2 4-1.8-1.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </Svg>
  );
}

export function LessonIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M5 5.5h8.5A3.5 3.5 0 0 1 17 9v10H8.5A3.5 3.5 0 0 1 5 15.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M8 9h5M8 12h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </Svg>
  );
}

export function StreakFlame({ streak, className }: IconProps & { streak: number }) {
  const stage = streakStage(streak);
  return (
    <Svg
      className={cn(
        stage >= 1 && "text-ember",
        stage >= 3 && "streak-glow",
        stage === 0 && "text-muted-2",
        className,
      )}
    >
      <path
        d="M12.1 3.3c.8 2.9 3.9 4.1 3.9 8.6 0 4-2.7 7.1-6.1 7.1-3.1 0-5.4-2.3-5.4-5.4 0-2.5 1.4-4.3 3.1-5.7-.1 2.4 1.2 3.3 2.2 3.4-.2-3.3.6-5.8 2.3-8Z"
        fill="currentColor"
        opacity={stage === 0 ? "0.38" : "1"}
      />
      {stage >= 3 ? (
        <path
          d="M12 10.7c1.2 1.1 2.2 2.2 2.2 4 0 2-1.4 3.4-3.3 3.4-1.7 0-3-1.2-3-3 0-1.4.8-2.4 1.7-3.2.1 1.2.8 1.7 1.5 1.7.1-1.2.3-2.1.9-2.9Z"
          fill="rgb(var(--color-mastery))"
        />
      ) : null}
      {stage >= 5 ? (
        <path
          d="M17.7 5.4c1.2.7 2.1 1.8 2.1 3.5M5.9 5.9C4.7 6.8 4 7.9 4 9.3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      ) : null}
      {stage >= 10 ? (
        <path
          d="M18.9 13.2 20 15.3l2.3.4-1.7 1.6.4 2.3-2.1-1.1-2.1 1.1.4-2.3-1.7-1.6 2.3-.4z"
          fill="rgb(var(--color-pink))"
        />
      ) : null}
    </Svg>
  );
}

export function streakStage(streak: number): 0 | 1 | 3 | 5 | 10 {
  if (streak >= 10) return 10;
  if (streak >= 5) return 5;
  if (streak >= 3) return 3;
  if (streak >= 1) return 1;
  return 0;
}
