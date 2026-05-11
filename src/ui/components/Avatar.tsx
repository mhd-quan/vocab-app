import { cn } from "@/lib/cn";

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
  // When the tutor picks a color, derive a readable foreground; otherwise
  // fall back to the surface-2 token so themed surfaces still match.
  const fg = bg ? "rgb(var(--color-accent-fg))" : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex select-none items-center justify-center overflow-hidden rounded-full font-semibold uppercase",
        "ring-2 ring-surface-1 shadow-sm",
        bg && !imageSrc ? "" : "bg-surface-2 text-app",
        SIZES[size],
        emoji && "text-[1.35em] leading-none",
        className,
      )}
      style={bg && !imageSrc ? { backgroundColor: bg, color: fg } : undefined}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        (emoji ?? initials)
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
