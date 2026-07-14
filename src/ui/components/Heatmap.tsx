import { cn } from "@/lib/cn";
import type { HeatmapCell } from "@/modules/analytics";
import { type KeyboardEvent, useMemo, useState } from "react";

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
  1: "bg-iris/20",
  2: "bg-iris/40",
  3: "bg-iris/60",
  4: "bg-iris/90",
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
  const [rovingIndex, setRovingIndex] = useState(Math.max(0, cells.length - 1));
  const cellIndexByDate = useMemo(
    () => new Map(cells.map((cell, index) => [cell.date, index])),
    [cells],
  );
  if (cells.length === 0) {
    return (
      <div className={cn("object-surface px-5 py-4 text-xs text-muted", className)}>
        No activity yet.
      </div>
    );
  }

  const columns = packIntoColumns(cells);
  const summary = summarizeCells(cells);
  const safeRovingIndex = Math.min(rovingIndex, cells.length - 1);
  const navigateCell = (currentIndex: number, delta: number) => {
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), cells.length - 1);
    setRovingIndex(nextIndex);
    const target = document.querySelector<HTMLButtonElement>(`[data-heatmap-index="${nextIndex}"]`);
    target?.focus();
  };
  return (
    <section
      className={cn("object-surface px-5 py-4", density === "roomy" && "p-5 lg:p-6", className)}
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
          <span className={cn("text-caption text-muted", density === "roomy" && "text-xs")}>
            {formatActiveCell(activeCell) ?? caption}
          </span>
        </header>
      ) : null}
      <div
        className={cn(
          "flex flex-col gap-4",
          density === "roomy" && "lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-stretch",
        )}
      >
        <div className={cn("overflow-x-auto", density === "roomy" && "bg-ground/55 p-4")}>
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
                    index={cell ? (cellIndexByDate.get(cell.date) ?? -1) : -1}
                    rovingIndex={safeRovingIndex}
                    density={density}
                    onActivate={setActiveCell}
                    onClear={() => setActiveCell(null)}
                    onNavigate={navigateCell}
                    onFocusIndex={setRovingIndex}
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
  index,
  rovingIndex,
  density,
  onActivate,
  onClear,
  onNavigate,
  onFocusIndex,
}: {
  cell: HeatmapCell | null;
  index: number;
  rovingIndex: number;
  density: NonNullable<HeatmapProps["density"]>;
  onActivate: (cell: HeatmapCell) => void;
  onClear: () => void;
  onNavigate: (currentIndex: number, delta: number) => void;
  onFocusIndex: (index: number) => void;
}) {
  if (!cell) {
    return <div aria-hidden className="h-6 w-6" />;
  }
  return (
    <button
      type="button"
      title={`${cell.date} — ${cell.count} ${cell.count === 1 ? "event" : "events"}`}
      aria-label={`${cell.date}: ${cell.count} practice reps`}
      data-heatmap-index={index}
      tabIndex={index === rovingIndex ? 0 : -1}
      onMouseEnter={() => onActivate(cell)}
      onFocus={() => {
        onFocusIndex(index);
        onActivate(cell);
      }}
      onMouseLeave={onClear}
      onBlur={onClear}
      onKeyDown={(event) => onCellKeyDown(event, index, onNavigate)}
      className={cn(
        "ui-focus-ring group grid h-6 w-6 place-items-center rounded-control transition-colors duration-fast hover:bg-iris/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-3 w-3 rounded-[3px] transition-shadow duration-fast group-hover:ring-1 group-hover:ring-iris/35",
          density === "roomy" && "h-4 w-4 rounded-[4px]",
          INTENSITY_BG[cell.intensity],
        )}
      />
    </button>
  );
}

function onCellKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  navigate: (currentIndex: number, delta: number) => void,
) {
  const delta =
    event.key === "ArrowUp"
      ? -1
      : event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft"
          ? -7
          : event.key === "ArrowRight"
            ? 7
            : null;
  if (delta === null) return;
  event.preventDefault();
  navigate(index, delta);
}

interface HeatmapSummaryStats {
  total: number;
  activeDays: number;
  bestDay: HeatmapCell | null;
  lastActiveDay: HeatmapCell | null;
}

function HeatmapSummary({ summary }: { summary: HeatmapSummaryStats }) {
  return (
    <dl className="grid grid-cols-2 border-t border-border-subtle pt-3 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pb-1 lg:pl-4 lg:pt-0">
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
    <div className="border-b border-border-subtle px-2 py-2.5 last:border-b-0 lg:px-0">
      <dt className="text-caption font-medium text-muted">{label}</dt>
      <dd className="tabular-figure mt-0.5 text-base font-semibold leading-5 text-app">{value}</dd>
      {hint ? <p className="mt-0.5 text-caption text-muted">{hint}</p> : null}
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
