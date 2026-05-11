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
        d="M5.2 5.2h9.8a4.6 4.6 0 0 1 0 9.2H5.4a2.6 2.6 0 0 0 0 5.2h10.9a1.1 1.1 0 1 0 0-2.2H5.4a.4.4 0 0 1 0-.8H15a6.8 6.8 0 0 0 0-13.6H5.2a1.1 1.1 0 1 0 0 2.2Z"
        fill="currentColor"
      />
      <path
        d="M8.4 7.4h5.5a1 1 0 1 1 0 2H8.4a1 1 0 1 1 0-2Zm0 3.7h3.8a1 1 0 1 1 0 2H8.4a1 1 0 1 1 0-2Z"
        fill="rgb(var(--color-surface-0))"
        opacity="0.75"
      />
    </Svg>
  );
}

export function DueIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M12 2.8a9.2 9.2 0 1 0 9.2 9.2A9.2 9.2 0 0 0 12 2.8Zm1 4.7v4l3 1.9a1.1 1.1 0 0 1-1.2 1.8l-3.5-2.3a1.1 1.1 0 0 1-.5-.9V7.5a1.1 1.1 0 1 1 2.2 0Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function AccuracyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M12 2.8a9.2 9.2 0 1 0 9.2 9.2A9.2 9.2 0 0 0 12 2.8Zm0 3.1a6.1 6.1 0 1 1-6.1 6.1A6.1 6.1 0 0 1 12 5.9Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path d="M12 8.9a3.1 3.1 0 1 0 3.1 3.1A3.1 3.1 0 0 0 12 8.9Z" fill="currentColor" />
      <path
        d="m14.8 9.6-3.4 4.3-2-1.9"
        fill="none"
        stroke="rgb(var(--color-surface-0))"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function LessonIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M5.5 3.3h8.2a4.8 4.8 0 0 1 4.8 4.8v12.6H9.2a4.8 4.8 0 0 1-4.8-4.8V4.4c0-.6.5-1.1 1.1-1.1Z"
        fill="currentColor"
      />
      <path
        d="M8.5 8h6.1a1 1 0 1 1 0 2H8.5a1 1 0 0 1 0-2Zm0 3.7h4.7a1 1 0 1 1 0 2H8.5a1 1 0 1 1 0-2Z"
        fill="rgb(var(--color-surface-0))"
        opacity="0.78"
      />
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
