import type { AchievementDefinition } from "@/modules/rewards";
import { AppGlyph, type AppGlyphName } from "@/ui/components/AppGlyph";

interface AchievementIconProps {
  icon: AchievementDefinition["icon"];
  className?: string;
}

const ACHIEVEMENT_GLYPHS: Record<AchievementDefinition["icon"], AppGlyphName> = {
  calendar: "calendar",
  compass: "target",
  crown: "crown",
  flame: "flame",
  gem: "gem",
  phoenix: "spark",
  spark: "spark",
  star: "star",
  target: "target",
  trophy: "trophy",
};

export function AchievementIcon({ icon, className }: AchievementIconProps) {
  return <AppGlyph name={ACHIEVEMENT_GLYPHS[icon]} className={className} />;
}
