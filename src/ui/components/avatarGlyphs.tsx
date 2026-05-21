import { AppGlyph, type AppGlyphName } from "@/ui/components/AppGlyph";

export type AvatarGlyphId =
  | "star"
  | "flame"
  | "spark"
  | "rocket"
  | "target"
  | "brain"
  | "book"
  | "rainbow"
  | "clover"
  | "gem"
  | "game"
  | "trophy";

export interface AvatarGlyphOption {
  id: AvatarGlyphId;
  label: string;
  seed: `glyph:${AvatarGlyphId}`;
  glyph: AppGlyphName;
  toneClassName: string;
}

export const AVATAR_GLYPH_OPTIONS: readonly AvatarGlyphOption[] = [
  avatarGlyph("star", "Star", "star", "text-mastery"),
  avatarGlyph("flame", "Flame", "flame", "text-ember"),
  avatarGlyph("spark", "Spark", "spark", "text-rare"),
  avatarGlyph("rocket", "Rocket", "arrowRight", "text-sky"),
  avatarGlyph("target", "Target", "target", "text-focus"),
  avatarGlyph("brain", "Brain", "dashboard", "text-epic"),
  avatarGlyph("book", "Book", "book", "text-accent"),
  avatarGlyph("rainbow", "Rainbow", "spark", "text-pink"),
  avatarGlyph("clover", "Clover", "studentMode", "text-lime"),
  avatarGlyph("gem", "Gem", "gem", "text-xp"),
  avatarGlyph("game", "Game", "keyboard", "text-coral"),
  avatarGlyph("trophy", "Trophy", "trophy", "text-warning"),
];

const GLYPH_BY_ID = new Map(AVATAR_GLYPH_OPTIONS.map((option) => [option.id, option]));

const LEGACY_EMOJI_TO_GLYPH: Record<string, AvatarGlyphId> = {
  "⭐": "star",
  "🔥": "flame",
  "⚡": "spark",
  "🚀": "rocket",
  "🎯": "target",
  "🧠": "brain",
  "📚": "book",
  "🌈": "rainbow",
  "🍀": "clover",
  "💎": "gem",
  "🎮": "game",
  "🏆": "trophy",
};

export function parseAvatarGlyph(seed: string | null | undefined): AvatarGlyphOption | null {
  if (!seed) return null;
  if (seed.startsWith("glyph:")) {
    return glyphOptionById(seed.slice("glyph:".length));
  }
  if (seed.startsWith("emoji:")) {
    return glyphOptionById(LEGACY_EMOJI_TO_GLYPH[seed.slice("emoji:".length)]);
  }
  return null;
}

export function AvatarGlyph({
  option,
  className,
}: {
  option: AvatarGlyphOption;
  className?: string;
}) {
  return <AppGlyph name={option.glyph} className={className} />;
}

function avatarGlyph(
  id: AvatarGlyphId,
  label: string,
  glyph: AppGlyphName,
  toneClassName: string,
): AvatarGlyphOption {
  return { id, label, seed: `glyph:${id}`, glyph, toneClassName };
}

function glyphOptionById(id: string | undefined): AvatarGlyphOption | null {
  if (!id) return null;
  return GLYPH_BY_ID.get(id as AvatarGlyphId) ?? null;
}
