import { cn } from "@/lib/cn";

export interface UnitStatusTrackProps {
  label: string;
  totalCount: number;
  reviewNowCount: number;
  learningCurrentCount: number;
  secureCurrentCount: number;
  newCount: number;
  dueLearningCount?: number;
  dueSecureCount?: number;
  className?: string;
}

const numberFormat = new Intl.NumberFormat();

/**
 * A composition track, not a completion meter. Every item belongs to one
 * mutually-exclusive state so a full track never implies that study is done.
 */
export function UnitStatusTrack({
  label,
  totalCount,
  reviewNowCount,
  learningCurrentCount,
  secureCurrentCount,
  newCount,
  dueLearningCount = 0,
  dueSecureCount = 0,
  className,
}: UnitStatusTrackProps) {
  const states = [
    {
      key: "review",
      label: "Review now",
      count: clampCount(reviewNowCount),
      tone: "bg-warning-fill",
    },
    {
      key: "learning",
      label: "Learning · current",
      count: clampCount(learningCurrentCount),
      tone: "bg-accent-fill",
    },
    {
      key: "secure",
      label: "Secure · current",
      count: clampCount(secureCurrentCount),
      tone: "bg-success-fill",
    },
    {
      key: "new",
      label: "New",
      count: clampCount(newCount),
      tone: "bg-border-strong",
    },
  ] as const;
  const total = clampCount(totalCount);
  const representedTotal = states.reduce((sum, state) => sum + state.count, 0);
  const accessibleLabel =
    total === 0
      ? `${label}: no practice items.`
      : [
          `${label}: ${numberFormat.format(states[0].count)} review now`,
          `${numberFormat.format(states[1].count)} learning and current`,
          `${numberFormat.format(states[2].count)} secure and current`,
          `${numberFormat.format(states[3].count)} new`,
          `${numberFormat.format(total)} items total`,
          states[0].count > 0
            ? `${numberFormat.format(clampCount(dueLearningCount))} learning items and ${numberFormat.format(clampCount(dueSecureCount))} secure items are due`
            : null,
        ]
          .filter(Boolean)
          .join(". ");

  return (
    <div
      role="img"
      aria-label={accessibleLabel}
      data-testid="unit-status-track"
      className={cn("min-w-0", className)}
    >
      <div
        aria-hidden="true"
        className="flex h-2 w-full overflow-hidden rounded-[var(--radius-control)] bg-surface-2"
      >
        {representedTotal > 0
          ? states.map((state) =>
              state.count > 0 ? (
                <span
                  key={state.key}
                  className={cn("h-full border-r border-paper/60 last:border-r-0", state.tone)}
                  style={{ flexGrow: state.count, flexBasis: 0 }}
                />
              ) : null,
            )
          : null}
      </div>

      <dl aria-hidden="true" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {states.map((state) => (
          <div key={state.key} className="flex min-w-0 items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-[2px]", state.tone)} />
            <dt className="text-muted">{state.label}</dt>
            <dd data-tabular className="font-medium text-app">
              {numberFormat.format(state.count)}
            </dd>
          </div>
        ))}
      </dl>
      {states[0].count > 0 ? (
        <p className="mt-1.5 text-[10px] leading-4 text-muted-2">
          Review mix: {numberFormat.format(clampCount(dueLearningCount))} learning ·{" "}
          {numberFormat.format(clampCount(dueSecureCount))} previously secure
        </p>
      ) : null}
    </div>
  );
}

function clampCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
