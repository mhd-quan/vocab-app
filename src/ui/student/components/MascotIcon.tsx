/**
 * MascotIcon — tiny SVG character set used for empty / completion /
 * onboarding states in student mode. Pure SVG, no external dependency.
 *
 * Variants:
 *   happy     — neutral default
 *   cheering  — arms up, used on session-completion celebrations
 *   thinking  — for "ready?" prompts
 *   sad       — for empty / no-results states
 *
 * The character uses `currentColor` for the body so it adapts to the
 * surrounding text colour; eyes + mouth use a fixed dark stroke for
 * readability across light/dark themes.
 */
import { cn } from "@/lib/cn";

export type MascotMood = "happy" | "cheering" | "thinking" | "sad";

export interface MascotIconProps {
  mood?: MascotMood;
  className?: string;
}

export function MascotIcon({ mood = "happy", className }: MascotIconProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label={`Mascot — ${mood}`}
      className={cn("h-24 w-24 text-success", className)}
    >
      {/* Body — currentColor so the mascot inherits the surrounding tone. */}
      <ellipse cx="48" cy="62" rx="32" ry="28" fill="currentColor" />
      <ellipse cx="48" cy="58" rx="32" ry="26" fill="currentColor" opacity="0.92" />

      {/* Belly highlight */}
      <ellipse cx="48" cy="68" rx="20" ry="14" fill="rgb(255 255 255 / 0.18)" />

      {/* Eyes — variant by mood. */}
      {renderEyes(mood)}

      {/* Mouth */}
      {renderMouth(mood)}

      {/* Optional decorations */}
      {mood === "cheering" ? (
        <>
          <path
            d="M16 30 L22 24 M80 30 L74 24 M48 14 L48 8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          />
        </>
      ) : null}
    </svg>
  );
}

function renderEyes(mood: MascotMood) {
  if (mood === "cheering") {
    // Closed crescent eyes (^^).
    return (
      <g stroke="rgb(20 30 50)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M36 50 q4 -5 8 0" />
        <path d="M52 50 q4 -5 8 0" />
      </g>
    );
  }
  if (mood === "sad") {
    return (
      <g fill="rgb(20 30 50)">
        <circle cx="40" cy="52" r="3" />
        <circle cx="56" cy="52" r="3" />
      </g>
    );
  }
  // happy / thinking — round eyes with a highlight dot
  return (
    <g>
      <circle cx="40" cy="50" r="4" fill="rgb(20 30 50)" />
      <circle cx="56" cy="50" r="4" fill="rgb(20 30 50)" />
      <circle cx="41.5" cy="48.5" r="1.2" fill="rgb(255 255 255 / 0.9)" />
      <circle cx="57.5" cy="48.5" r="1.2" fill="rgb(255 255 255 / 0.9)" />
    </g>
  );
}

function renderMouth(mood: MascotMood) {
  switch (mood) {
    case "happy":
      return (
        <path
          d="M40 62 q8 7 16 0"
          stroke="rgb(20 30 50)"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      );
    case "cheering":
      return <path d="M40 60 q8 10 16 0 q-8 -3 -16 0 Z" fill="rgb(20 30 50)" />;
    case "thinking":
      return <path d="M42 64 h12" stroke="rgb(20 30 50)" strokeWidth="2.4" strokeLinecap="round" />;
    case "sad":
      return (
        <path
          d="M40 66 q8 -7 16 0"
          stroke="rgb(20 30 50)"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}
