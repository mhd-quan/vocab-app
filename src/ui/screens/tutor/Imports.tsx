import type { ImportRun } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Badge, type BadgeTone } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export function TutorImports() {
  const runsQ = useQuery({
    queryKey: queryKeys.imports.listRuns(),
    queryFn: () => api.imports.listRuns(),
    refetchInterval: 5_000,
  });
  const runs = runsQ.data ?? [];
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Import history"
        subtitle="Every `npm run import` invocation is logged. Click a row to inspect per-entry outcomes."
      />
      <section className="px-8 py-6">
        {runsQ.isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : runs.length === 0 ? (
          <EmptyState
            title="No imports yet"
            body="Run `npm run import` from a terminal — completed runs appear here automatically."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                expanded={expandedId === run.id}
                onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

const STATUS_TONE: Record<ImportRun["status"], BadgeTone> = {
  pending: "muted",
  success: "success",
  partial: "warning",
  failed: "danger",
};

function RunRow({
  run,
  expanded,
  onToggle,
}: {
  run: ImportRun;
  expanded: boolean;
  onToggle: () => void;
}) {
  const stats = run.stats ?? {};
  const inserted = numStat(stats.inserted);
  const updated = numStat(stats.updated);
  const skipped = numStat(stats.skipped);
  const failed = numStat(stats.failed);
  const duration =
    run.finishedAt && run.startedAt
      ? Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime())
      : null;

  return (
    <li className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface-2"
      >
        <Badge tone={STATUS_TONE[run.status]} uppercase>
          {run.status}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-app">{shortenPath(run.sourcePath)}</p>
          <p className="truncate font-mono text-[10px] text-muted-2">
            {formatTimestamp(run.startedAt)}
            {duration !== null ? ` · ${duration}ms` : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 font-mono text-xs">
          <Stat label="+" value={inserted} tone={inserted > 0 ? "success" : "muted"} />
          <Stat label="~" value={updated} tone={updated > 0 ? "warning" : "muted"} />
          <Stat label="=" value={skipped} tone="muted" />
          <Stat label="!" value={failed} tone={failed > 0 ? "danger" : "muted"} />
        </div>
        <span
          aria-hidden
          className={cn(
            "ml-2 text-muted-2 transition-transform",
            expanded ? "rotate-90" : "rotate-0",
          )}
        >
          ▸
        </span>
      </button>
      {expanded ? <RunItems runId={run.id} errorLog={run.errorLog} /> : null}
    </li>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex w-12 items-center justify-center rounded-md border px-1.5 py-0.5",
        tone === "success" && "border-success/40 bg-success/10 text-success",
        tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
        tone === "danger" && "border-danger/40 bg-danger/10 text-danger",
        tone === "muted" && "border-border-subtle bg-surface-0/50 text-muted-2",
      )}
    >
      <span className="mr-1 text-muted-2">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function RunItems({ runId, errorLog }: { runId: number; errorLog: string | null }) {
  const itemsQ = useQuery({
    queryKey: queryKeys.imports.listItems(runId),
    queryFn: () => api.imports.listItems({ runId }),
  });
  const items = itemsQ.data ?? [];

  return (
    <div className="border-t border-border-subtle bg-surface-0/40 px-4 py-3">
      {itemsQ.isLoading ? (
        <p className="text-xs text-muted">Loading items…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-2">No item rows recorded for this run.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline gap-2">
              <ItemActionBadge action={item.action} />
              <span className="truncate font-mono text-[11px] text-app">{item.targetTable}</span>
              <span className="truncate text-muted">{item.sourceId ?? "—"}</span>
              {item.error ? <span className="text-danger">— {item.error}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {errorLog ? (
        <details className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-3">
          <summary className="cursor-pointer text-xs text-danger">Error log</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-danger">
            {errorLog}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

const ITEM_ACTION_TONE: Record<string, BadgeTone> = {
  inserted: "success",
  updated: "warning",
  skipped: "muted",
  failed: "danger",
  deleted: "danger",
};

function ItemActionBadge({ action }: { action: string }) {
  return (
    <Badge tone={ITEM_ACTION_TONE[action] ?? "muted"} uppercase>
      {action}
    </Badge>
  );
}

function numStat(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function shortenPath(absolute: string): string {
  const idx = absolute.lastIndexOf("/content/");
  return idx >= 0 ? absolute.slice(idx + 1) : absolute;
}

function formatTimestamp(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}
