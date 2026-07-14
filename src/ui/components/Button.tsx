import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/80",
  secondary:
    "border border-border-strong/65 bg-paper text-app hover:bg-surface-2 active:bg-surface-3",
  ghost: "bg-transparent text-app hover:bg-surface-2 active:bg-surface-3",
  danger: "bg-danger text-danger-fg hover:bg-danger/90 active:bg-danger/80",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-[var(--size-control-sm)] px-2.5 text-xs",
  md: "h-[var(--size-control-md)] px-3 text-[13px]",
  lg: "h-[var(--size-control-lg)] px-4 text-[13px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "ui-focus-ring inline-flex items-center justify-center gap-1.5 rounded-control font-medium",
        "transition-[background-color,border-color,color,box-shadow,filter] duration-fast",
        "active:shadow-[inset_0_0_0_1px_rgb(var(--color-border-strong)/0.45)] active:brightness-[0.97]",
        "disabled:pointer-events-none disabled:opacity-45",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
});
