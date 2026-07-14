import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { useId } from "react";

interface MicButtonProps {
  state: "idle" | "recording" | "ready" | "assessing";
  durationMs: number;
  maxDurationMs: number;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}

/**
 * Primary record affordance for pronunciation practice. A single button
 * toggles between start → stop; stopping automatically triggers the
 * assess flow (the caller chains it). The visual state covers idle,
 * actively recording (with a restrained pulse + timer), holding a recorded attempt
 * (ready to retry), and assessing (busy spinner).
 */
export function MicButton({
  state,
  durationMs,
  maxDurationMs,
  disabled,
  disabledReason,
  onClick,
}: MicButtonProps) {
  const helperId = useId();
  const recording = state === "recording";
  const assessing = state === "assessing";
  const ready = state === "ready";
  const label =
    state === "recording"
      ? "Stop and check"
      : state === "assessing"
        ? "Checking attempt"
        : state === "ready"
          ? "Record again"
          : "Start recording";
  const helper =
    disabled && disabledReason
      ? disabledReason
      : state === "recording"
        ? "Finish the phrase, then stop to score it."
        : state === "assessing"
          ? "Comparing your recording with the sound guide…"
          : state === "ready"
            ? "Record another attempt when you’re ready."
            : `Speak naturally; recording stops at ${formatDuration(maxDurationMs)}.`;
  const elapsed = Math.min(Math.max(durationMs, 0), Math.max(maxDurationMs, 1));
  const progress = (elapsed / Math.max(maxDurationMs, 1)) * 100;

  return (
    <div className="w-full max-w-64">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || assessing}
        aria-label={label}
        aria-describedby={helperId}
        aria-pressed={recording}
        aria-busy={assessing}
        className={cn(
          "ui-focus-ring flex h-11 w-full items-center gap-2 rounded-control border px-3 text-sm font-medium",
          "transition-[background-color,border-color,color,box-shadow] duration-fast",
          recording
            ? "border-danger-fill bg-danger-fill text-danger-fg"
            : assessing
              ? "border-border-subtle bg-surface-2 text-app"
              : ready
                ? "border-border-strong bg-paper text-app hover:bg-surface-2"
                : "border-accent bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/80",
          disabled && !assessing && "cursor-not-allowed opacity-50",
        )}
      >
        {assessing ? (
          <AppGlyph name="spinner" className="animate-spin motion-reduce:animate-none" />
        ) : recording ? (
          <AppGlyph name="stop" filled className="animate-pulse motion-reduce:animate-none" />
        ) : (
          <AppGlyph name="microphone" className={ready ? "text-accent" : undefined} />
        )}
        <span className="min-w-0 flex-1 text-left">{label}</span>
        {recording ? (
          <span data-tabular className="text-xs font-normal text-danger-fg/[0.85]" aria-live="off">
            {formatDuration(durationMs)}
          </span>
        ) : null}
      </button>
      <div aria-hidden="true" className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3/70">
        <div
          className={cn(
            "h-full transition-[width] duration-fast",
            recording ? "bg-danger-fill" : "bg-transparent",
          )}
          style={{ width: recording ? `${progress}%` : "0%" }}
        />
      </div>
      <p id={helperId} className="mt-1.5 min-h-4 text-xs leading-4 text-muted" aria-live="polite">
        {helper}
      </p>
    </div>
  );
}

function formatDuration(ms: number): string {
  return `${Math.max(0, Math.round(ms / 100) / 10).toFixed(1)}s`;
}
