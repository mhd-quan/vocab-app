import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";

export interface AvatarProps {
  name: string;
  avatarSeed?: string | null;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-lg",
};

export function Avatar({ name, avatarSeed, color, size = "md", className }: AvatarProps) {
  const initials = computeInitials(name);
  const imageSrc = parseAvatarImage(avatarSeed);
  const emoji = parseAvatarEmoji(avatarSeed);
  const bg = color || undefined;
  const fg = bg ? readableForeground(bg) : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex select-none items-center justify-center overflow-hidden rounded-full font-semibold",
        "ring-1 ring-inset ring-border-subtle",
        bg && !imageSrc && !emoji ? "" : "bg-surface-2 text-app",
        SIZES[size],
        emoji && "text-[1.35em] leading-none",
        className,
      )}
      style={bg && !imageSrc && !emoji ? { backgroundColor: bg, color: fg } : undefined}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : emoji ? (
        emoji
      ) : (
        <span className="relative grid h-full w-full place-items-center">
          <AppGlyph name="person" className="absolute h-[72%] w-[72%] opacity-18" />
          <span className="relative">{initials}</span>
        </span>
      )}
    </span>
  );
}

export function computeInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function parseAvatarEmoji(seed: string | null | undefined): string | null {
  if (!seed?.startsWith("emoji:")) return null;
  return seed.slice("emoji:".length) || null;
}

function parseAvatarImage(seed: string | null | undefined): string | null {
  if (!seed?.startsWith("image:")) return null;
  const src = seed.slice("image:".length);
  return src.startsWith("data:image/") ? src : null;
}

/** Keep initials at WCAG AA contrast, preferring the product's ink colors when they pass. */
function readableForeground(background: string): string {
  const channels = parseHexColor(background);
  if (!channels) return "#fcfcfa";
  const backgroundLuminance = relativeLuminance(channels);
  const identityInk = ["#222220", "#fcfcfa"] as const;
  const preferred = identityInk
    .map((color) => ({ color, contrast: contrastRatio(backgroundLuminance, color) }))
    .sort((a, b) => b.contrast - a.contrast)[0];
  if (preferred && preferred.contrast >= 4.5) return preferred.color;

  // Some mid-tone identity colors sit between the two editorial inks. In
  // that narrow case, accessibility wins over palette purity.
  return contrastRatio(backgroundLuminance, "#000000") >=
    contrastRatio(backgroundLuminance, "#ffffff")
    ? "#000000"
    : "#ffffff";
}

function contrastRatio(backgroundLuminance: number, foreground: string): number {
  const foregroundChannels = parseHexColor(foreground);
  if (!foregroundChannels) return 1;
  const foregroundLuminance = relativeLuminance(foregroundChannels);
  const lighter = Math.max(backgroundLuminance, foregroundLuminance);
  const darker = Math.min(backgroundLuminance, foregroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHexColor(color: string): [number, number, number] | null {
  const match = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match?.[1]) return null;
  const value =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function relativeLuminance(channels: [number, number, number]): number {
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}
