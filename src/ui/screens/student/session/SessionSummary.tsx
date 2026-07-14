import { Badge } from "@/ui/components/Badge";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { PressButton } from "@/ui/student/components/PressButton";
import { Mascot } from "@/ui/student/mascot";

export interface SessionSummaryStats {
  total: number;
  correct: number;
  byKind: Record<string, { total: number; correct: number }>;
}

export function SessionSummary({
  stats,
  onRestart,
  onExit,
  studentId,
}: {
  stats: SessionSummaryStats;
  onRestart: () => void;
  onExit: () => void;
  studentId?: number | string | null;
}) {
  const accuracy = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
  const tone = accuracy >= 80 ? "success" : accuracy >= 50 ? "warning" : "danger";
  const variant = accuracy >= 80 ? "cheer" : accuracy < 50 ? "concern" : "idle";

  return (
    <article className="object-surface overflow-hidden bg-surface-1">
      <header className="grid gap-4 px-6 py-6 text-center sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:text-left">
        <Mascot variant={variant} studentId={studentId} className="mx-auto h-20 w-20 sm:mx-0" />
        <div className="min-w-0">
          <Badge tone={tone}>Session complete</Badge>
          <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.025em]">
            {accuracy}% accuracy
          </h2>
          <p className="mt-1 text-sm text-muted">
            {stats.correct} of {stats.total} exercises correct
          </p>
          <ProgressMeter
            value={stats.correct}
            max={stats.total}
            label="Session accuracy"
            tone={accuracy >= 80 ? "success" : "warning"}
            className="mt-4 w-full"
          />
        </div>
      </header>

      <ul className="grid grid-cols-1 border-t border-border-subtle sm:grid-cols-2">
        {Object.entries(stats.byKind).map(([kind, bucket]) => (
          <li
            key={kind}
            className="flex items-baseline justify-between border-b border-border-subtle px-5 py-3 text-left sm:odd:border-r"
          >
            <span className="text-sm capitalize text-app">{kind.replace(/_/g, " ")}</span>
            <span className="tabular-figure text-xs text-muted">
              {bucket.correct} / {bucket.total}
            </span>
          </li>
        ))}
      </ul>

      <footer
        className="flex flex-wrap items-center justify-end gap-2 px-5 py-4"
        data-content-action-bar
      >
        <PressButton variant="secondary" onClick={onRestart}>
          Practice again
        </PressButton>
        <PressButton onClick={onExit}>Back to lessons</PressButton>
      </footer>
    </article>
  );
}
