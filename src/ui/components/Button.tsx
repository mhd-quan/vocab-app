import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-sm shadow-accent/20 hover:bg-accent/90 focus-visible:ring-accent/50 disabled:bg-accent/40 disabled:shadow-none",
  secondary:
    "border border-border-strong bg-surface-1 text-app hover:bg-surface-2 focus-visible:ring-border-strong/60 disabled:opacity-50",
  ghost:
    "bg-transparent text-app hover:bg-surface-2 focus-visible:ring-border-subtle disabled:opacity-50",
  danger:
    "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/50 disabled:bg-danger/40",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
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
        "inline-flex items-center justify-center gap-2 rounded-button font-semibold transition-[background-color,border-color,color,box-shadow,transform]",
        "hover:-translate-y-0.5 active:translate-y-px disabled:hover:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0",
        "disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
});
