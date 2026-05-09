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
}

export function Sidebar({ brand, items, footer }: SidebarProps) {
  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border-subtle bg-surface-1">
      <div className="px-5 py-6">{brand}</div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Tutor navigation">
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
    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
    item.disabled
      ? "cursor-not-allowed text-muted-2"
      : active
        ? "bg-surface-2 text-app"
        : "text-muted hover:bg-surface-2 hover:text-app",
  );

  if (item.disabled) {
    return (
      <span aria-disabled className={className}>
        <span className="flex h-4 w-4 items-center justify-center text-muted-2">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {item.hint ? <span className="text-[10px] text-muted-2">{item.hint}</span> : null}
      </span>
    );
  }

  return (
    <Link to={item.to} className={className}>
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center",
          active ? "text-accent" : "text-muted",
        )}
      >
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.hint ? <span className="text-[10px] text-muted-2">{item.hint}</span> : null}
    </Link>
  );
}
