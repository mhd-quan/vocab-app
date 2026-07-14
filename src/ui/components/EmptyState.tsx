import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm leading-5 text-muted">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
