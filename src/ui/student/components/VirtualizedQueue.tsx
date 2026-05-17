/**
 * Windowed list for long card grids.
 *
 * Zero dependencies — pure scroll-window math. Designed for the personal
 * vocabulary inventory and unit-lesson lists that can balloon past a
 * hundred items on a 4GB / 1 GHz target.
 *
 * Constraints:
 *   - Fixed `rowHeight`. Variable-height windowing is out of scope; if
 *     a row needs to expand on hover it should expand within a
 *     reserved height, not push siblings.
 *   - `overscan` rows render above/below the visible window so a quick
 *     scroll doesn't flash empty space.
 *
 * Falls back gracefully: when the dataset is small (< `overscan` × 4)
 * we just render everything — the windowing overhead isn't worth it.
 */
import clsx from "clsx";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

export interface VirtualizedQueueProps<T> {
  items: ReadonlyArray<T>;
  rowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  /** Extra rows rendered above/below the visible window. Defaults to 4. */
  overscan?: number;
  /** Optional className for the scroll container. */
  className?: string;
  /** Inline style for the scroll container — typically maxHeight. */
  style?: CSSProperties;
  /** Optional key resolver — defaults to index. */
  rowKey?: (item: T, index: number) => string | number;
}

export function VirtualizedQueue<T>({
  items,
  rowHeight,
  renderRow,
  overscan = 4,
  className,
  style,
  rowKey,
}: VirtualizedQueueProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Track viewport size — content area can shrink/grow with window.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    setViewportHeight(node.clientHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Small-dataset shortcut: render everything when the cost of
  // windowing exceeds the cost of just rendering all rows.
  if (items.length <= overscan * 4) {
    return (
      <div ref={containerRef} className={clsx("overflow-auto", className)} style={style}>
        {items.map((item, index) => (
          <div key={rowKey ? rowKey(item, index) : index} style={{ minHeight: rowHeight }}>
            {renderRow(item, index)}
          </div>
        ))}
      </div>
    );
  }

  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, start + visibleCount + overscan * 2);
  const slice = items.slice(start, end);
  const topPad = start * rowHeight;
  const bottomPad = (items.length - end) * rowHeight;

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      className={clsx("overflow-auto", className)}
      style={style}
    >
      <div style={{ height: topPad }} aria-hidden />
      {slice.map((item, offset) => {
        const index = start + offset;
        return (
          <div key={rowKey ? rowKey(item, index) : index} style={{ minHeight: rowHeight }}>
            {renderRow(item, index)}
          </div>
        );
      })}
      <div style={{ height: bottomPad }} aria-hidden />
    </div>
  );
}
