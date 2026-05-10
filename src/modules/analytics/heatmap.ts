/**
 * Daily-activity heatmap math. Given a stream of event timestamps and a
 * window length in days, produce a dense list of `{ date, count, intensity }`
 * cells running from `(now - days + 1)` through `now` inclusive — one
 * cell per local-calendar day, never skipping gaps.
 *
 * Pure: no `Date.now()` reads, no DB, no clamp on the input range. The
 * caller pins "now" so timezone-edge tests remain trivial.
 *
 * Intensity is bucketed 0–4 against the maximum count in the window so
 * the renderer can map it to a fixed colour scale without re-walking the
 * cells. A day with zero practice is intensity 0; the busiest day is 4.
 */

export interface HeatmapCell {
  /** YYYY-MM-DD in local time. Stable, sortable, locale-free. */
  date: string;
  /** Distinct local-calendar bucket count (events on that day). */
  count: number;
  /** 0..4 bucket relative to window max — 0 means no events. */
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface BucketByDayInput {
  /** Any timestamps from the student's event log. Order doesn't matter. */
  eventTimestamps: Date[];
  /** Inclusive end of the window (its local-day bucket is the last cell). */
  now: Date;
  /** Number of days to render. Must be ≥ 1. */
  days: number;
}

const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Map a raw `count` to a 0..4 bucket using `max` as the top of the
 * scale. The first bucket above zero is 1, regardless of how big `max`
 * is — a day with one event always shows up.
 */
function intensityFor(count: number, max: number): HeatmapCell["intensity"] {
  if (count === 0) return 0;
  if (max <= 1) return 1;
  // Quartile slicing: 1, 25%, 50%, 75% of max → buckets 1..4.
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function bucketByDay({ eventTimestamps, now, days }: BucketByDayInput): HeatmapCell[] {
  if (days < 1) return [];

  const counts = new Map<string, number>();
  for (const ts of eventTimestamps) {
    const key = dateKey(ts);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const end = startOfDay(now);
  const start = new Date(end.getTime() - (days - 1) * MS_PER_DAY);

  const cells: HeatmapCell[] = [];
  let maxCount = 0;
  // Walk the window day-by-day, materialising every cell — gaps included.
  for (let i = 0; i < days; i += 1) {
    const day = new Date(start.getTime() + i * MS_PER_DAY);
    const key = dateKey(day);
    const count = counts.get(key) ?? 0;
    if (count > maxCount) maxCount = count;
    cells.push({ date: key, count, intensity: 0 });
  }

  // Second pass: now that we know max, assign intensities. Cheaper than
  // building it incrementally because we'd otherwise rewalk.
  if (maxCount > 0) {
    for (const cell of cells) {
      cell.intensity = intensityFor(cell.count, maxCount);
    }
  }
  return cells;
}
