import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";

export interface SessionSummaryStats {
  total: number;
  correct: number;
  byKind: Record<string, { total: number; correct: number }>;
}

export function SessionSummary({
  stats,
  onRestart,
  onExit,
}: {
  stats: SessionSummaryStats;
  onRestart: () => void;
  onExit: () => void;
}) {
  const accuracy = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
  const tone = accuracy >= 80 ? "success" : accuracy >= 50 ? "warning" : "danger";

  return (
    <article className="flex flex-col gap-6 rounded-2xl border border-border-subtle bg-surface-1 p-8 text-center shadow-lg">
      <header className="flex flex-col items-center gap-2">
        <Badge tone={tone} uppercase>
          Session complete
        </Badge>
        <h2 className="text-3xl font-semibold tracking-tight">{accuracy}% accuracy</h2>
        <p className="text-sm text-muted">
          {stats.correct} of {stats.total} exercises right
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Object.entries(stats.byKind).map(([kind, bucket]) => (
          <li
            key={kind}
            className="flex items-baseline justify-between rounded-md border border-border-subtle bg-surface-0/50 px-4 py-2 text-left"
          >
            <span className="text-sm capitalize text-app">{kind.replace(/_/g, " ")}</span>
            <span className="font-mono text-xs text-muted">
              {bucket.correct} / {bucket.total}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex justify-center gap-2">
        <Button variant="secondary" onClick={onRestart}>
          Practice again
        </Button>
        <Button onClick={onExit}>Back to lessons</Button>
      </div>
    </article>
  );
}
