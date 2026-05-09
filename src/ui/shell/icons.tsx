/**
 * Tiny set of monochrome 16x16 icons drawn inline. Avoids pulling a whole
 * icon library for the handful of nav items we have. Replace with lucide /
 * heroicons later if breadth is needed.
 */
import type { ReactNode } from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" role="img" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const DashboardIcon = () => (
  <Svg>
    <rect x="2" y="2" width="5" height="5" rx="1" {...stroke} />
    <rect x="9" y="2" width="5" height="3" rx="1" {...stroke} />
    <rect x="9" y="7" width="5" height="7" rx="1" {...stroke} />
    <rect x="2" y="9" width="5" height="5" rx="1" {...stroke} />
  </Svg>
);

export const StudentsIcon = () => (
  <Svg>
    <circle cx="6" cy="6" r="2.5" {...stroke} />
    <path d="M2 13c.5-2 2-3 4-3s3.5 1 4 3" {...stroke} />
    <circle cx="11.5" cy="5" r="1.8" {...stroke} />
    <path d="M10 11c.5-1.2 1.4-1.8 2.5-1.8" {...stroke} />
  </Svg>
);

export const ContentIcon = () => (
  <Svg>
    <path d="M3 3h7l3 3v7H3z" {...stroke} />
    <path d="M5 7h6M5 9h6M5 11h4" {...stroke} />
  </Svg>
);

export const ImportsIcon = () => (
  <Svg>
    <path d="M8 2v8m0 0l-3-3m3 3l3-3" {...stroke} />
    <path d="M3 12v1.5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V12" {...stroke} />
  </Svg>
);

export const SettingsIcon = () => (
  <Svg>
    <circle cx="8" cy="8" r="2" {...stroke} />
    <path
      d="M8 1.5v1.8M8 12.7v1.8M2.5 8h1.8M11.7 8h1.8M3.8 3.8l1.3 1.3M10.9 10.9l1.3 1.3M3.8 12.2l1.3-1.3M10.9 5.1l1.3-1.3"
      {...stroke}
    />
  </Svg>
);

export const LockIcon = () => (
  <Svg>
    <rect x="3" y="7" width="10" height="7" rx="1" {...stroke} />
    <path d="M5 7V5a3 3 0 0 1 6 0v2" {...stroke} />
  </Svg>
);

export const StudentModeIcon = () => (
  <Svg>
    <path d="M2 4l6-2 6 2-6 2-6-2z" {...stroke} />
    <path d="M5 5.5V8c0 1 1.3 2 3 2s3-1 3-2V5.5" {...stroke} />
    <path d="M14 4v3" {...stroke} />
  </Svg>
);
