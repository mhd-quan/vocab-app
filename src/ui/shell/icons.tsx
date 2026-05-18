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

function StrokeGlyph({ className, children }: GlyphProps & { children: ReactNode }) {
  return (
    <Glyph className={className}>
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      >
        {children}
      </g>
    </Glyph>
  );
}

export const DashboardIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <rect x="3.7" y="4" width="6.7" height="7" rx="1.6" />
    <rect x="13.6" y="4" width="6.7" height="4.8" rx="1.6" />
    <rect x="3.7" y="14.1" width="6.7" height="5.9" rx="1.6" />
    <rect x="13.6" y="11.8" width="6.7" height="8.2" rx="1.6" />
  </StrokeGlyph>
);

export const StudentsIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <path d="M9.4 11.2a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z" />
    <path d="M3.2 19.8c.5-3.6 2.7-5.6 6.2-5.6s5.7 2 6.2 5.6" />
    <path d="M16.8 11a3 3 0 1 0 0-6" />
    <path d="M17.4 14.1c1.9.7 3 2.5 3.4 5" />
  </StrokeGlyph>
);

export const ContentIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <path d="M6 3.7h7.7l4.3 4.4v12.2H6a2 2 0 0 1-2-2V5.7a2 2 0 0 1 2-2Z" />
    <path d="M13.4 3.9v4.5h4.4" />
    <path d="M7.8 11.6h7.8" />
    <path d="M7.8 15.1h7.8" />
    <path d="M7.8 18.5h4.8" />
  </StrokeGlyph>
);

export const DictionaryIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <path d="M5.4 4.2h11.3a2 2 0 0 1 2 2v13.6H6.4a2.7 2.7 0 0 1-2.7-2.7V5.9c0-1 .7-1.7 1.7-1.7Z" />
    <path d="M6.4 16.2h12.3" />
    <path d="M7.4 8.7h6.2" />
    <path d="M7.4 12h4.7" />
  </StrokeGlyph>
);

export const ImportsIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <path d="M12 3.4v10.4" />
    <path d="m7.9 9.9 4.1 4.1 4.1-4.1" />
    <path d="M5.2 14.8v3.1a2.1 2.1 0 0 0 2.1 2.1h9.4a2.1 2.1 0 0 0 2.1-2.1v-3.1" />
  </StrokeGlyph>
);

export const SettingsIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <path d="M4.6 6.5h6" />
    <path d="M14.7 6.5h4.7" />
    <circle cx="12.6" cy="6.5" r="2" />
    <path d="M4.6 12h3.8" />
    <path d="M12.5 12h6.9" />
    <circle cx="10.5" cy="12" r="2" />
    <path d="M4.6 17.5h7.1" />
    <path d="M15.8 17.5h3.6" />
    <circle cx="13.8" cy="17.5" r="2" />
  </StrokeGlyph>
);

export const LockIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <rect x="4.5" y="10" width="15" height="10" rx="2.2" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    <path d="M12 14.4v2.2" />
  </StrokeGlyph>
);

export const StudentModeIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <path d="m3.2 7.3 8.8-3.5 8.8 3.5-8.8 3.5-8.8-3.5Z" />
    <path d="M6.5 9.2v4.1c0 2.1 2.5 3.8 5.5 3.8s5.5-1.7 5.5-3.8V9.2" />
    <path d="M20.8 7.3v6" />
  </StrokeGlyph>
);

export const TutorModeIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <rect x="3.4" y="4.4" width="17.2" height="12.3" rx="2" />
    <path d="M9.2 20h5.6" />
    <path d="M12 16.7V20" />
    <path d="M7.3 8.5h9.4" />
    <path d="M7.3 12.2h5.7" />
  </StrokeGlyph>
);

export const EditIcon = ({ className }: GlyphProps) => (
  <StrokeGlyph className={className}>
    <path d="M4.6 16.2 15.7 5.1a2.3 2.3 0 0 1 3.2 0 2.3 2.3 0 0 1 0 3.2L7.8 19.4l-4.1.9.9-4.1Z" />
    <path d="m14.2 6.6 3.2 3.2" />
  </StrokeGlyph>
);
