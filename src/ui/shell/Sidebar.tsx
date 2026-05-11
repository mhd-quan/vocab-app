import { cn } from "@/lib/cn";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export interface SidebarItem {
  to: string;
  label: string;
  icon: ReactNode;
  hint?: string;
  disabled?: boolean;
}

export interface SidebarProps {
  brand: ReactNode;
  items: SidebarItem[];
  footer?: ReactNode;
  topInset?: boolean;
}

export function Sidebar({ brand, items, footer, topInset }: SidebarProps) {
  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border-subtle bg-surface-1/95">
      {topInset && <div className="h-10 w-full shrink-0 [-webkit-app-region:drag]" />}
      <div className={cn("px-5 pb-6", topInset ? "pt-2" : "pt-6")}>{brand}</div>
      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Tutor navigation">
        {items.map((item) => {
          const active = currentPath === item.to || currentPath.startsWith(`${item.to}/`);
          return <SidebarLink key={item.to} item={item} active={active} />;
        })}
      </nav>
      {footer ? <div className="border-t border-border-subtle px-3 py-3">{footer}</div> : null}
    </aside>
  );
}

function SidebarLink({ item, active }: { item: SidebarItem; active: boolean }) {
  const className = cn(
    "group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow,transform]",
    item.disabled
      ? "cursor-not-allowed text-muted-2"
      : active
        ? "bg-accent/10 text-app shadow-[0_0_0_1px_rgb(var(--color-accent)/0.18),0_10px_34px_rgb(var(--color-accent)/0.12)]"
        : "text-muted hover:-translate-y-0.5 hover:bg-surface-2 hover:text-app",
  );

  if (item.disabled) {
    return (
      <span aria-disabled className={className}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted-2">
          {item.icon}
        </span>
        <span className="flex-1">{item.label}</span>
        {item.hint ? <span className="text-[10px] text-muted-2">{item.hint}</span> : null}
      </span>
    );
  }

  return (
    <Link to={item.to} className={className}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl transition-[background-color,color,box-shadow]",
          active
            ? "bg-accent text-accent-fg shadow-[0_8px_22px_rgb(var(--color-accent)/0.24)]"
            : "bg-surface-2/80 text-muted group-hover:bg-surface-3 group-hover:text-app",
        )}
      >
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.hint ? <span className="text-[10px] text-muted-2">{item.hint}</span> : null}
    </Link>
  );
}
