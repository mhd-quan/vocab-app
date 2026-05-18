import { cn } from "@/lib/cn";
import type { HeatmapCell } from "@/modules/analytics";
import { useState } from "react";

export interface HeatmapProps {
  cells: HeatmapCell[];
  /** Optional title displayed above the grid. */
  title?: string;
  /** Optional sub-text under the title (e.g. "Last 90 days"). */
  caption?: string;
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
export function Heatmap({ cells, title, caption, className }: HeatmapProps) {
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
  return (
    <section
      className={cn("rounded-bento border border-border-subtle bg-surface-1 px-5 py-4", className)}
    >
      {title || caption ? (
        <header className="mb-3 flex items-baseline justify-between gap-2">
          {title ? <h3 className="text-sm font-semibold">{title}</h3> : <span />}
          <span className="text-[10px] text-muted-2">
            {activeCell
              ? `${activeCell.date} · ${activeCell.count} ${
                  activeCell.count === 1 ? "practice rep" : "practice reps"
                }`
              : caption}
          </span>
        </header>
      ) : null}
      <div className="flex gap-1 overflow-x-auto">
        {columns.map((col, ci) => (
          <div key={col.weekKey ?? `pad-${ci}`} className="flex flex-col gap-1">
            {col.cells.map((cell, ri) => (
              <Cell
                key={cell ? cell.date : `${ci}-${ri}`}
                cell={cell}
                onActivate={setActiveCell}
                onClear={() => setActiveCell(null)}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Cell({
  cell,
  onActivate,
  onClear,
}: {
  cell: HeatmapCell | null;
  onActivate: (cell: HeatmapCell) => void;
  onClear: () => void;
}) {
  if (!cell) {
    return <div aria-hidden className="h-3 w-3" />;
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
        INTENSITY_BG[cell.intensity],
      )}
    />
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
