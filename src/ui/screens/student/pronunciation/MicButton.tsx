import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";

interface MicButtonProps {
  state: "idle" | "recording" | "ready" | "assessing";
  durationMs: number;
  maxDurationMs: number;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Central record affordance for the pronunciation lab. A single button
 * toggles between start → stop; stopping automatically triggers the
 * assess flow (the caller chains it). The visual state covers idle,
 * actively recording (with pulse + timer), holding a recorded attempt
 * (ready to retry), and assessing (busy spinner).
 */
export function MicButton({ state, durationMs, maxDurationMs, disabled, onClick }: MicButtonProps) {
  const recording = state === "recording";
  const assessing = state === "assessing";
  const ready = state === "ready";
  const label =
    state === "recording"
      ? "Stop recording"
      : state === "assessing"
        ? "Checking attempt"
        : state === "ready"
          ? "Record again"
          : "Tap to record";
  const helper =
    state === "recording"
      ? `${formatDuration(durationMs)} / ${formatDuration(maxDurationMs)}`
      : state === "assessing"
        ? "Scoring your attempt…"
        : state === "ready"
          ? "Audio captured · tap to retry"
          : "Click, speak, then click again to check";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || assessing}
        aria-label={label}
        className={cn(
          "relative grid h-24 w-24 place-items-center rounded-full border-2 shadow-card transition-[transform,box-shadow,background-color,border-color]",
          recording
            ? "border-danger/55 bg-danger/15 text-danger shadow-lift"
            : assessing
              ? "border-accent/35 bg-accent/10 text-accent"
              : ready
                ? "border-success/45 bg-success/10 text-success hover:-translate-y-0.5 hover:shadow-lift"
                : "border-sky/50 bg-sky/10 text-sky hover:-translate-y-0.5 hover:shadow-lift",
          disabled && !assessing && "cursor-not-allowed opacity-50",
        )}
      >
        {recording ? <PulseRing /> : null}
        {assessing ? (
          <AppGlyph name="spinner" className="h-8 w-8 animate-spin" />
        ) : recording ? (
          <AppGlyph name="stop" filled className="h-8 w-8" />
        ) : (
          <AppGlyph name="microphone" className="h-9 w-9" />
        )}
      </button>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-semibold text-app">{label}</span>
        <span className="text-xs text-muted-2">{helper}</span>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  return `${Math.max(0, Math.round(ms / 100) / 10).toFixed(1)}s`;
}

function PulseRing() {
  return (
    <>
      <span className="pointer-events-none absolute inset-0 animate-ping rounded-full border border-danger/40" />
      <span className="pointer-events-none absolute inset-0 rounded-full border border-danger/25" />
    </>
  );
}
