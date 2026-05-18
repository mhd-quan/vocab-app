import type { ReactNode } from "react";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex min-h-[var(--tutor-header-height)] items-start justify-between gap-6 border-b border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] px-8 py-7">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <span className="text-xs font-semibold uppercase text-muted-2">{eyebrow}</span>
        ) : null}
        <h1 className="font-display text-4xl font-semibold leading-tight text-app">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
