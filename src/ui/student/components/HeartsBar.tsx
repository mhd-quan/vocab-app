import { cn } from "@/lib/cn";

export interface HeartsBarProps {
  remaining: number;
  total?: number;
  className?: string;
}

export function HeartsBar({ remaining, total = 5, className }: HeartsBarProps) {
  const safeTotal = Math.max(1, total);
  const safeRemaining = Math.max(0, Math.min(remaining, safeTotal));
  const slots = Array.from({ length: safeTotal }, (_, index) => ({
    id: `heart-${index + 1}`,
    active: index < safeRemaining,
  }));

  return (
    <div
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-pill border border-danger/25 bg-danger/10 px-3",
        className,
      )}
      aria-label={`${safeRemaining} of ${safeTotal} hearts remaining`}
    >
      {slots.map((slot) => (
        <HeartIcon
          key={slot.id}
          className={cn(
            "h-4 w-4 transition-[color,transform]",
            slot.active ? "text-danger" : "text-muted-2/45",
          )}
        />
      ))}
    </div>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M12 21.2 10.7 20C5.8 15.6 2.6 12.7 2.6 8.9 2.6 5.8 5 3.5 8.1 3.5c1.7 0 3.3.8 4.3 2.1 1-1.3 2.6-2.1 4.3-2.1 3.1 0 5.5 2.3 5.5 5.4 0 3.8-3.2 6.7-8.1 11.1L12 21.2Z"
      />
    </svg>
  );
}
