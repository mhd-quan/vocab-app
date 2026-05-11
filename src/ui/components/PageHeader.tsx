import type { ReactNode } from "react";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-6 border-b border-border-subtle bg-surface-0/75 px-8 py-7">
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <span className="text-xs font-semibold uppercase text-muted-2">{eyebrow}</span>
        ) : null}
        <h1 className="text-3xl font-semibold leading-tight text-app">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
