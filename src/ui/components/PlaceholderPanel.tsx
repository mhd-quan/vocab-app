import type { ReactNode } from "react";

export interface PlaceholderPanelProps {
  title: string;
  body: string;
  hint?: string;
  children?: ReactNode;
}

/**
 * Used by screens whose real implementation lands in a later PR. Communicates
 * intent + scope clearly so tester sessions don't mistake a stub for a bug.
 */
export function PlaceholderPanel({ title, body, hint, children }: PlaceholderPanelProps) {
  return (
    <div className="m-8 rounded-lg border border-dashed border-border-subtle bg-surface-1 px-8 py-10">
      <div className="flex flex-col items-start gap-3">
        <span className="rounded-full border border-border-subtle bg-surface-2 px-3 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted">
          Coming soon
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-2xl text-sm text-muted">{body}</p>
        {hint ? (
          <p className="max-w-2xl text-xs text-muted-2">
            <span className="font-mono">▸</span> {hint}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
