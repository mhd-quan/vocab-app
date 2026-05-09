import { cn } from "@/lib/cn";

export interface AvatarProps {
  name: string;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function Avatar({ name, color, size = "md", className }: AvatarProps) {
  const initials = computeInitials(name);
  const bg = color || undefined;
  // When the tutor picks a color, derive a readable foreground; otherwise
  // fall back to the surface-2 token so themed surfaces still match.
  const fg = bg ? "rgb(var(--color-accent-fg))" : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold uppercase",
        bg ? "" : "bg-surface-2 text-app",
        SIZES[size],
        className,
      )}
      style={bg ? { backgroundColor: bg, color: fg } : undefined}
    >
      {initials}
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
