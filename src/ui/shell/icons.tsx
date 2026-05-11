import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface GlyphProps {
  className?: string;
}

function Glyph({ className, children }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-5 w-5 shrink-0 overflow-visible", className)}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M4.2 3.6h6.2c.9 0 1.5.6 1.5 1.5v6.2c0 .9-.6 1.5-1.5 1.5H4.2c-.9 0-1.5-.6-1.5-1.5V5.1c0-.9.6-1.5 1.5-1.5Zm10.1 0h5.5c.9 0 1.5.6 1.5 1.5v3.6c0 .9-.6 1.5-1.5 1.5h-5.5c-.9 0-1.5-.6-1.5-1.5V5.1c0-.9.6-1.5 1.5-1.5ZM4.2 14h5.5c.9 0 1.5.6 1.5 1.5v3.4c0 .9-.6 1.5-1.5 1.5H4.2c-.9 0-1.5-.6-1.5-1.5v-3.4c0-.9.6-1.5 1.5-1.5Zm10.1-2.6h5.5c.9 0 1.5.6 1.5 1.5v6c0 .9-.6 1.5-1.5 1.5h-5.5c-.9 0-1.5-.6-1.5-1.5v-6c0-.9.6-1.5 1.5-1.5Z"
    />
  </Glyph>
);

export const StudentsIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M9.4 11.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Zm8.1-.6a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM9.4 12.9c-4 0-7 2.3-7 5.3 0 1.5 1 2.4 2.6 2.4h8.8c1.6 0 2.6-.9 2.6-2.4 0-3-3-5.3-7-5.3Zm8.2.4c-.9 0-1.7.2-2.5.5 1.7 1.1 2.8 2.7 2.8 4.6 0 .7-.2 1.4-.5 1.9h2.1c1.3 0 2.1-.8 2.1-2 0-2.8-2-5-4-5Z"
    />
  </Glyph>
);

export const ContentIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M5.4 2.8h8.1c.5 0 .9.2 1.3.5l3.5 3.5c.3.3.5.8.5 1.3v11.1c0 1.2-.8 2-2 2H5.4c-1.2 0-2-.8-2-2V4.8c0-1.2.8-2 2-2Zm8.3 1.7v2.9c0 .7.4 1.1 1.1 1.1h2.9l-4-4Zm-6 6.3c-.5 0-.9.4-.9.9s.4.9.9.9h8.4c.5 0 .9-.4.9-.9s-.4-.9-.9-.9H7.7Zm0 3.6c-.5 0-.9.4-.9.9s.4.9.9.9h8.4c.5 0 .9-.4.9-.9s-.4-.9-.9-.9H7.7Zm0 3.6c-.5 0-.9.4-.9.9s.4.9.9.9h5.8c.5 0 .9-.4.9-.9s-.4-.9-.9-.9H7.7Z"
    />
  </Glyph>
);

export const ImportsIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M11.1 3.2c0-.6.4-1 1-1s1 .4 1 1v8.2l2.5-2.5c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4l-4.2 4.2c-.4.4-1 .4-1.4 0l-4.2-4.2a1 1 0 0 1 1.4-1.4l2.5 2.5V3.2Zm-5.5 11c.6 0 1 .4 1 1v2.6c0 .5.3.8.8.8h9.4c.5 0 .8-.3.8-.8v-2.6c0-.6.4-1 1-1s1 .4 1 1v2.7c0 1.7-1.1 2.8-2.8 2.8H7.4c-1.7 0-2.8-1.1-2.8-2.8v-2.7c0-.6.4-1 1-1Z"
    />
  </Glyph>
);

export const SettingsIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M5.4 6.8h6.8a2.7 2.7 0 0 0 5.1 0h1.3a1 1 0 1 0 0-2h-1.3a2.7 2.7 0 0 0-5.1 0H5.4a1 1 0 0 0 0 2Zm9.3-.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2ZM5.4 13h1.3a2.7 2.7 0 0 0 5.1 0h6.8a1 1 0 1 0 0-2h-6.8a2.7 2.7 0 0 0-5.1 0H5.4a1 1 0 1 0 0 2Zm3.8-.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm-3.8 6.1h6.8a2.7 2.7 0 0 0 5.1 0h1.3a1 1 0 1 0 0-2h-1.3a2.7 2.7 0 0 0-5.1 0H5.4a1 1 0 1 0 0 2Zm9.3-.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z"
    />
  </Glyph>
);

export const LockIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M7 9.4V7.2a5 5 0 0 1 10 0v2.2h.4c1.4 0 2.3.9 2.3 2.3v6.7c0 1.4-.9 2.3-2.3 2.3H6.6c-1.4 0-2.3-.9-2.3-2.3v-6.7c0-1.4.9-2.3 2.3-2.3H7Zm2.1 0h5.8V7.2a2.9 2.9 0 0 0-5.8 0v2.2Zm2.9 7.1c.7 0 1.2-.5 1.2-1.2S12.7 14 12 14s-1.2.5-1.2 1.3.5 1.2 1.2 1.2Z"
    />
  </Glyph>
);

export const StudentModeIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M12 3.1 2.9 6.6c-.8.3-.8 1.5 0 1.8l9.1 3.5 7-2.7v4.1c-.6.3-1 .9-1 1.6 0 .6.3 1.2.8 1.5l-.8 2.7c-.1.5.2.9.7.9h2c.5 0 .8-.5.7-.9l-.8-2.7c.5-.3.8-.9.8-1.5 0-.7-.4-1.3-1-1.6V8.6l.7-.2c.8-.3.8-1.5 0-1.8L12 3.1Zm-5.7 7.5v2.1c0 2.2 2.5 4 5.7 4s5.7-1.8 5.7-4v-2.1L12 12.8l-5.7-2.2Z"
    />
  </Glyph>
);

export const TutorModeIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M4.4 4h15.2c1.1 0 1.9.8 1.9 1.9v9.2c0 1.1-.8 1.9-1.9 1.9h-5.8v1.8h2.7a1 1 0 1 1 0 2h-9a1 1 0 1 1 0-2h2.7V17H4.4c-1.1 0-1.9-.8-1.9-1.9V5.9C2.5 4.8 3.3 4 4.4 4Zm3.1 4.2a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2h-9Zm0 3.6a1 1 0 1 0 0 2h5.9a1 1 0 1 0 0-2H7.5Z"
    />
  </Glyph>
);

export const EditIcon = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path
      fill="currentColor"
      d="M15.7 3.8c1-1 2.6-1 3.6 0l.9.9c1 1 1 2.6 0 3.6L9.3 19.2c-.3.3-.6.5-1 .6l-4.1 1.1c-.7.2-1.3-.4-1.1-1.1l1.1-4.1c.1-.4.3-.7.6-1L15.7 3.8Zm-9.5 12-.6 2.6 2.6-.6 8.5-8.5-2-2-8.5 8.5Z"
    />
  </Glyph>
);
