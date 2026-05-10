import { cn } from "@/lib/cn";
import type { AchievementDefinition } from "@/modules/rewards";

interface AchievementIconProps {
  icon: AchievementDefinition["icon"];
  className?: string;
}

/**
 * Tiny inline SVGs — one per icon hint in the achievement catalogue.
 * Inline (not an icon-font dep) so the player can colour them via
 * `currentColor` and the bundle stays small.
 *
 * Each icon ships a hidden `<title>` so the lint a11y rule passes;
 * the surrounding chip / toast already announces the title text via
 * its own copy, so a screen reader won't hear duplicates.
 */
export function AchievementIcon({ icon, className }: AchievementIconProps) {
  const baseClass = cn("h-4 w-4 shrink-0", className);
  switch (icon) {
    case "spark":
      return (
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          role="img"
          aria-hidden="true"
          focusable="false"
          className={baseClass}
        >
          <title>spark</title>
          <path d="M8 1 9 6.5 14.5 8 9 9.5 8 15 7 9.5 1.5 8 7 6.5z" />
        </svg>
      );
    case "flame":
      return (
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          role="img"
          aria-hidden="true"
          focusable="false"
          className={baseClass}
        >
          <title>flame</title>
          <path d="M8 1c-.5 2.5-3 3.5-3 6.5C5 11 6.5 13 8 14c1.5-1 3-3 3-6.5 0-1-.5-2-1-2.5C9.5 6 9 7 8 7c-.3-2 0-4 0-6Z" />
        </svg>
      );
    case "target":
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          role="img"
          aria-hidden="true"
          focusable="false"
          className={baseClass}
        >
          <title>target</title>
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="3" />
          <circle cx="8" cy="8" r="1" fill="currentColor" />
        </svg>
      );
    case "trophy":
      return (
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          role="img"
          aria-hidden="true"
          focusable="false"
          className={baseClass}
        >
          <title>trophy</title>
          <path d="M4 2h8v3a4 4 0 0 1-3 3.87V11h2v2H5v-2h2V8.87A4 4 0 0 1 4 5V2Zm-1 1H1v1a3 3 0 0 0 2 2.83V3Zm10 0v3.83A3 3 0 0 0 15 4V3h-2Z" />
        </svg>
      );
    case "calendar":
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          role="img"
          aria-hidden="true"
          focusable="false"
          className={baseClass}
        >
          <title>calendar</title>
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6h12M5 1v3M11 1v3" strokeLinecap="round" />
        </svg>
      );
    case "star":
      return (
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          role="img"
          aria-hidden="true"
          focusable="false"
          className={baseClass}
        >
          <title>star</title>
          <path d="M8 1.5 10 6l5 .5-3.7 3.3 1.1 4.7L8 12l-4.4 2.5L4.7 9.8 1 6.5 6 6Z" />
        </svg>
      );
  }
}
