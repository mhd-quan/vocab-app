import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";

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
      className={cn("inline-flex h-8 items-center gap-1 rounded-md bg-surface-2 px-2.5", className)}
      aria-label={`${safeRemaining} of ${safeTotal} hearts remaining`}
    >
      {slots.map((slot) => (
        <AppGlyph
          key={slot.id}
          name="heart"
          filled={slot.active}
          className={cn(
            "h-4 w-4 transition-[color,transform]",
            slot.active ? "text-danger" : "text-muted-2/45",
          )}
        />
      ))}
    </div>
  );
}
