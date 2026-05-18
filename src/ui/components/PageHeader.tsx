import type { ReactNode } from "react";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="relative isolate flex min-h-[var(--tutor-header-height)] items-start justify-between gap-6 overflow-hidden border-b border-border-subtle bg-[color:var(--md-sys-color-surface)] px-8 py-5">
      <span
        aria-hidden
        className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-accent/35 via-focus/20 to-transparent"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? (
          <span className="text-[11px] font-semibold uppercase text-muted-2">{eyebrow}</span>
        ) : null}
        <h1 className="font-display text-[1.7rem] font-semibold leading-tight text-app">{title}</h1>
        {subtitle ? <p className="max-w-3xl text-sm leading-6 text-muted">{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
