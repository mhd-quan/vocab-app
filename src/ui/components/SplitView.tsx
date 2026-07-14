import { cn } from "@/lib/cn";
import {
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

interface SplitViewProps {
  children: [ReactNode, ReactNode];
  side?: "leading" | "trailing";
  initialSize: number;
  minSize: number;
  maxSize: number;
  /** Minimum width reserved for the pane opposite the resizable side. */
  contentMinSize?: number;
  label: string;
  storageKey?: string;
  className?: string;
}

/**
 * Desktop split view with a one-point divider and a deliberately wider hit
 * target. Pane size is keyboard-adjustable and persists between launches.
 */
export function SplitView({
  children,
  side = "leading",
  initialSize,
  minSize,
  maxSize,
  contentMinSize = minSize,
  label,
  storageKey,
  className,
}: SplitViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => readStoredSize(storageKey, initialSize, minSize, maxSize));
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const availableMax =
    containerWidth === null
      ? maxSize
      : Math.min(maxSize, Math.max(0, containerWidth - 1 - contentMinSize));
  const availableMin = Math.min(minSize, availableMax);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const width = root.getBoundingClientRect().width;
      if (width > 0) setContainerWidth(width);
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
    observer?.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (containerWidth === null) return;
    setSize((current) => clamp(current, availableMin, availableMax));
  }, [availableMax, availableMin, containerWidth]);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, String(size));
  }, [size, storageKey]);

  const updateFromPointer = (clientX: number) => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const next = side === "leading" ? clientX - bounds.left : bounds.right - clientX;
    const pointerMax = Math.min(maxSize, Math.max(0, bounds.width - 1 - contentMinSize));
    setSize(clamp(next, Math.min(minSize, pointerMax), pointerMax));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setSize((current) =>
      clamp(current + direction * (side === "leading" ? 16 : -16), availableMin, availableMax),
    );
  };

  const gridTemplateColumns =
    side === "leading" ? `${size}px 1px minmax(0, 1fr)` : `minmax(0, 1fr) 1px ${size}px`;
  const [first, second] = children;

  return (
    <div
      ref={rootRef}
      className={cn("grid min-h-0 min-w-0", className)}
      style={{ gridTemplateColumns }}
    >
      <div className="min-h-0 min-w-0">{first}</div>
      <div
        role="separator"
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={Math.round(availableMin)}
        aria-valuemax={Math.round(availableMax)}
        aria-valuenow={Math.round(size)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            updateFromPointer(event.clientX);
          }
        }}
        onDoubleClick={() => setSize(initialSize)}
        onKeyDown={onKeyDown}
        className="group relative z-10 w-px cursor-col-resize touch-none bg-border-subtle outline-none before:absolute before:inset-y-0 before:-left-1 before:w-[9px] after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-accent focus-visible:after:bg-accent"
      />
      <div className="min-h-0 min-w-0">{second}</div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredSize(
  storageKey: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (!storageKey || typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(storageKey);
  if (raw === null) return fallback;
  const stored = Number(raw);
  return Number.isFinite(stored) ? clamp(stored, min, max) : fallback;
}
