import { cn } from "@/lib/cn";
import type { HeatmapCell } from "@/modules/analytics";
import { useState } from "react";

export interface HeatmapProps {
  cells: HeatmapCell[];
  /** Optional title displayed above the grid. */
  title?: string;
  /** Optional sub-text under the title (e.g. "Last 90 days"). */
  caption?: string;
  density?: "compact" | "roomy";
  className?: string;
}

const INTENSITY_BG: Record<HeatmapCell["intensity"], string> = {
  0: "bg-surface-3/70",
  1: "bg-focus/25",
  2: "bg-focus/45",
  3: "bg-success/65",
  4: "bg-success/95",
};

/**
 * GitHub-style activity grid. Cells are laid out top-to-bottom, then
 * left-to-right (columns are weeks, rows are weekdays Sun→Sat) so the
 * shape stays narrow horizontally regardless of the window length.
 *
 * The first column starts on the weekday of the earliest cell — we
 * pad the column with empty placeholders above so subsequent columns
 * align to a 7-row grid. This keeps Sunday on row 0 across the whole
 * grid, matching what tutors expect from GitHub / Lingvist.
 */
export function Heatmap({ cells, title, caption, density = "compact", className }: HeatmapProps) {
  const [activeCell, setActiveCell] = useState<HeatmapCell | null>(null);
  if (cells.length === 0) {
    return (
      <div
        className={cn(
          "rounded-bento border border-dashed border-border-subtle bg-surface-1 px-5 py-4 text-xs text-muted-2",
          className,
        )}
      >
        No activity yet.
      </div>
    );
  }

  const columns = packIntoColumns(cells);
  const summary = summarizeCells(cells);
  return (
    <section
      className={cn(
        "rounded-bento border border-border-subtle bg-surface-1 px-5 py-4",
        density === "roomy" && "p-5 lg:p-6",
        className,
      )}
    >
      {title || caption ? (
        <header
          className={cn(
            "mb-3 flex items-baseline justify-between gap-2",
            density === "roomy" && "mb-5",
          )}
        >
          {title ? (
            <h3 className={cn("text-sm font-semibold", density === "roomy" && "text-base")}>
              {title}
            </h3>
          ) : (
            <span />
          )}
          <span className={cn("text-[10px] text-muted-2", density === "roomy" && "text-xs")}>
            {formatActiveCell(activeCell) ?? caption}
          </span>
        </header>
      ) : null}
      <div
        className={cn(
          "flex flex-col gap-4",
          density === "roomy" && "lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-stretch",
        )}
      >
        <div
          className={cn(
            "overflow-x-auto",
            density === "roomy" && "rounded-[var(--shape-corner-lg)] bg-surface-0/50 p-4",
          )}
        >
          <div
            className={cn(
              "flex min-w-max gap-1",
              density === "roomy" && "justify-start gap-1.5 lg:justify-center",
            )}
          >
            {columns.map((col, ci) => (
              <div
                key={col.weekKey ?? `pad-${ci}`}
                className={cn("flex flex-col gap-1", density === "roomy" && "gap-1.5")}
              >
                {col.cells.map((cell, ri) => (
                  <Cell
                    key={cell ? cell.date : `${ci}-${ri}`}
                    cell={cell}
                    density={density}
                    onActivate={setActiveCell}
                    onClear={() => setActiveCell(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {density === "roomy" ? <HeatmapSummary summary={summary} /> : null}
      </div>
    </section>
  );
}

function Cell({
  cell,
  density,
  onActivate,
  onClear,
}: {
  cell: HeatmapCell | null;
  density: NonNullable<HeatmapProps["density"]>;
  onActivate: (cell: HeatmapCell) => void;
  onClear: () => void;
}) {
  if (!cell) {
    return <div aria-hidden className={cn("h-3 w-3", density === "roomy" && "h-4 w-4")} />;
  }
  return (
    <button
      type="button"
      title={`${cell.date} — ${cell.count} ${cell.count === 1 ? "event" : "events"}`}
      aria-label={`${cell.date}: ${cell.count} practice reps`}
      onMouseEnter={() => onActivate(cell)}
      onFocus={() => onActivate(cell)}
      onMouseLeave={onClear}
      onBlur={onClear}
      className={cn(
        "h-3 w-3 rounded-[3px] transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40",
        density === "roomy" && "h-4 w-4 rounded-[4px]",
        INTENSITY_BG[cell.intensity],
      )}
    />
  );
}

interface HeatmapSummaryStats {
  total: number;
  activeDays: number;
  bestDay: HeatmapCell | null;
  lastActiveDay: HeatmapCell | null;
}

function HeatmapSummary({ summary }: { summary: HeatmapSummaryStats }) {
  return (
    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-1">
      <SummaryStat label="Total reps" value={summary.total} />
      <SummaryStat label="Active days" value={summary.activeDays} />
      <SummaryStat
        label="Best day"
        value={summary.bestDay ? summary.bestDay.count : 0}
        hint={summary.bestDay?.date ?? "No practice yet"}
      />
      <SummaryStat
        label="Last active"
        value={summary.lastActiveDay ? shortDate(summary.lastActiveDay.date) : "None"}
        hint={summary.lastActiveDay ? `${summary.lastActiveDay.count} reps` : "No practice yet"}
      />
    </dl>
  );
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--shape-corner-lg)] border border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] px-3 py-3">
      <dt className="text-[10px] font-semibold uppercase text-muted-2">{label}</dt>
      <dd className="mt-1 font-mono text-2xl leading-none text-app">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

interface Column {
  /** Stable key for React; null for the leading pad column. */
  weekKey: string | null;
  /** Length 7. Index 0 = Sunday, 6 = Saturday. */
  cells: Array<HeatmapCell | null>;
}

/**
 * Slice the dense day list into 7-tall columns aligned on Sunday rows.
 * The first column may have leading nulls if the earliest cell is mid-
 * week; the last column may have trailing nulls if `now` isn't on a
 * Saturday.
 */
function packIntoColumns(cells: HeatmapCell[]): Column[] {
  const first = cells[0];
  if (!first) return [];
  const firstWeekday = new Date(first.date).getDay(); // 0..6 (Sun..Sat)

  const columns: Column[] = [];
  let current: Column | null = null;

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    if (!cell) continue;
    const weekday = i === 0 ? firstWeekday : (firstWeekday + i) % 7;
    if (weekday === 0 || current === null) {
      current = { weekKey: cell.date, cells: Array(7).fill(null) };
      columns.push(current);
    }
    current.cells[weekday] = cell;
  }
  return columns;
}

function summarizeCells(cells: HeatmapCell[]): HeatmapSummaryStats {
  let total = 0;
  let activeDays = 0;
  let bestDay: HeatmapCell | null = null;
  let lastActiveDay: HeatmapCell | null = null;
  for (const cell of cells) {
    total += cell.count;
    if (cell.count === 0) continue;
    activeDays += 1;
    lastActiveDay = cell;
    if (!bestDay || cell.count > bestDay.count) bestDay = cell;
  }
  return { total, activeDays, bestDay, lastActiveDay };
}

function formatActiveCell(cell: HeatmapCell | null): string | null {
  if (!cell) return null;
  return `${cell.date} · ${cell.count} ${cell.count === 1 ? "practice rep" : "practice reps"}`;
}

function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return month && day ? `${month}/${day}` : date;
}
