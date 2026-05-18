import { cn } from "@/lib/cn";
import type { AchievementDefinition } from "@/modules/rewards";
import type { ReactNode } from "react";

interface AchievementIconProps {
  icon: AchievementDefinition["icon"];
  className?: string;
}

function Glyph({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-5 w-5 shrink-0 overflow-visible", className)}
    >
      {children}
    </svg>
  );
}

export function AchievementIcon({ icon, className }: AchievementIconProps) {
  switch (icon) {
    case "spark":
      return (
        <Glyph className={className}>
          <path d="M12 2.3 13.8 9l6.7 1.8-6.7 1.8L12 21.3l-1.8-6.7-6.7-1.8 6.7-1.8L12 2.3Zm6.2 1.5.6 2.2 2.2.6-2.2.6-.6 2.2-.6-2.2-2.2-.6 2.2-.6.6-2.2Z" />
        </Glyph>
      );
    case "flame":
      return (
        <Glyph className={className}>
          <path d="M12.1 2.6c.8 3.6 4.9 5.1 4.9 10.7 0 5-3.3 8-7.4 8-3.7 0-6.6-2.7-6.6-6.6 0-3.1 1.8-5.4 3.8-7.1-.1 3 1.5 4.1 2.8 4.3-.3-4.1.7-7.1 2.5-9.3Z" />
          <path d="M12 11.5c1.3 1.1 2.3 2.4 2.3 4.2 0 2.1-1.5 3.7-3.5 3.7-1.8 0-3.2-1.3-3.2-3.2 0-1.4.8-2.5 1.8-3.3.1 1.3.9 1.8 1.6 1.8.1-1.3.4-2.3 1-3.2Z" />
        </Glyph>
      );
    case "target":
      return (
        <Glyph className={className}>
          <path d="M12 2.6a9.4 9.4 0 1 0 9.4 9.4A9.4 9.4 0 0 0 12 2.6Zm0 16.4a7 7 0 1 1 7-7 7 7 0 0 1-7 7Z" />
          <path d="M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5Zm0 7.3a2.3 2.3 0 1 1 2.3-2.3 2.3 2.3 0 0 1-2.3 2.3Z" />
        </Glyph>
      );
    case "trophy":
      return (
        <Glyph className={className}>
          <path d="M7.1 3.2h9.8v3.6c0 3.4-1.9 6.1-4.4 6.8v2.2h2.7c.7 0 1.2.5 1.2 1.2v1.4h2.2c.7 0 1.2.5 1.2 1.2v.9H4.2v-.9c0-.7.5-1.2 1.2-1.2h2.2V17c0-.7.5-1.2 1.2-1.2h2.7v-2.2c-2.5-.7-4.4-3.4-4.4-6.8V3.2Z" />
          <path d="M5.5 4.5H2.8v2.1c0 2.4 1.5 4.3 3.6 4.8a9.2 9.2 0 0 1-.9-4.1V4.5Zm13 0v2.8c0 1.5-.3 2.9-.9 4.1 2.1-.5 3.6-2.4 3.6-4.8V4.5h-2.7Z" />
        </Glyph>
      );
    case "calendar":
      return (
        <Glyph className={className}>
          <path d="M7.2 2.2c.6 0 1 .4 1 1v1h7.6v-1c0-.6.4-1 1-1s1 .4 1 1v1h.6c1.8 0 2.8 1 2.8 2.8v10.9c0 1.8-1 2.8-2.8 2.8H5.6c-1.8 0-2.8-1-2.8-2.8V7c0-1.8 1-2.8 2.8-2.8h.6v-1c0-.6.4-1 1-1Zm12 8.1H4.8v7.5c0 .6.3.9.9.9h12.6c.6 0 .9-.3.9-.9v-7.5Zm-11.5 3h2.5v2.5H7.7v-2.5Zm4.1 0h2.5v2.5h-2.5v-2.5Z" />
        </Glyph>
      );
    case "star":
      return (
        <Glyph className={className}>
          <path d="M12 2.6c.5 0 .8.3 1 .8l2.2 4.6 5 .7c.9.1 1.2 1.2.6 1.8l-3.6 3.6.9 5c.1.8-.7 1.5-1.4 1.1L12 17.8l-4.5 2.4c-.8.4-1.6-.3-1.4-1.1l.9-5-3.6-3.6c-.6-.6-.3-1.7.6-1.8L9 8l2.2-4.6c.1-.5.5-.8.8-.8Z" />
        </Glyph>
      );
    case "compass":
      return (
        <Glyph className={className}>
          <path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm3.9 5.6-1.6 5.4a1.2 1.2 0 0 1-.8.8l-5.4 1.6 1.6-5.4c.1-.4.4-.7.8-.8l5.4-1.6Z" />
        </Glyph>
      );
    case "phoenix":
      return (
        <Glyph className={className}>
          <path d="M12 2.2c1.6 3.3 5.8 3.1 8.1 6.6-2.8-.6-4.5.1-5.4 1.3 2.6.8 4.4 2.9 4.4 5.4 0 3.5-3.1 6-7.1 6s-7.1-2.5-7.1-6c0-2.5 1.8-4.6 4.4-5.4-.9-1.2-2.6-1.9-5.4-1.3C6.2 5.3 10.4 5.5 12 2.2Z" />
          <path d="M12 12.5c1.1.9 2 1.9 2 3.3 0 1.7-.9 3-2 3s-2-1.3-2-3c0-1.4.9-2.4 2-3.3Z" />
        </Glyph>
      );
    case "gem":
      return (
        <Glyph className={className}>
          <path d="M7.2 3.4h9.6l4.3 5.2L12 21 2.9 8.6l4.3-5.2Zm.9 2.2L5.6 8.7l4.1-.1 1.1-3H8.1Zm5.1 0 1.1 3 4.1.1-2.5-3.1h-2.7ZM12 17.1l2-6.3h-4l2 6.3Z" />
        </Glyph>
      );
    case "crown":
      return (
        <Glyph className={className}>
          <path d="M3.5 18.8h17v2.1h-17v-2.1Zm.6-12.6 4.6 4 3.3-6.8 3.3 6.8 4.6-4 .9 10.4H3.2l.9-10.4Z" />
        </Glyph>
      );
  }
}
