import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";

interface IconProps {
  className?: string;
}

export function SeenIcon({ className }: IconProps) {
  return <AppGlyph name="book" className={className} />;
}

export function DueIcon({ className }: IconProps) {
  return <AppGlyph name="calendar" className={className} />;
}

export function AccuracyIcon({ className }: IconProps) {
  return <AppGlyph name="accuracy" className={className} />;
}

export function LessonIcon({ className }: IconProps) {
  return <AppGlyph name="lesson" className={className} />;
}

export function StreakFlame({ streak, className }: IconProps & { streak: number }) {
  const stage = streakStage(streak);
  return (
    <AppGlyph
      name="flame"
      className={cn(
        stage >= 1 && "text-ember",
        stage >= 3 && "streak-glow",
        stage === 0 && "text-muted-2 opacity-60",
        className,
      )}
    />
  );
}

export function streakStage(streak: number): 0 | 1 | 3 | 5 | 10 {
  if (streak >= 10) return 10;
  if (streak >= 5) return 5;
  if (streak >= 3) return 3;
  if (streak >= 1) return 1;
  return 0;
}
