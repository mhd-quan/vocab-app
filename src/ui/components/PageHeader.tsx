import type { ReactNode } from "react";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-6 px-[var(--space-window-x)] pb-4 pt-[var(--space-window-y)]">
      <div className="min-w-0">
        {eyebrow ? <span className="sr-only">{eyebrow}</span> : null}
        <h1 className="font-display text-title font-semibold text-app">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-3xl text-[13px] leading-[18px] text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
