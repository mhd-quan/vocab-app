/**
 * 3D press button — Duolingo-style affordance for kid-friendly screens.
 *
 * Wraps the existing `Button` so variant / size / aria contracts stay
 * identical. The visual upgrade is a stacked solid drop-shadow
 * (`shadow-press`) that compresses on `:active` (`shadow-press-active`)
 * with a small vertical translate. Those shadow tokens are defined in
 * `src/styles/tokens/student.css` and shift saturation per role — so a
 * PressButton in tutor mode would render with the muted neutral shadow
 * instead of the saturated green one.
 *
 * Use case: student-facing CTAs (Start lesson, Check answer, Continue).
 * For tutor productivity UI keep using `Button` directly.
 */
import { cn } from "@/lib/cn";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { forwardRef } from "react";

export interface PressButtonProps extends ButtonProps {
  /** When true, the button stretches to its container width. */
  block?: boolean;
}

export const PressButton = forwardRef<HTMLButtonElement, PressButtonProps>(function PressButton(
  { className, block, size = "lg", ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      size={size}
      className={cn(
        // The "press" feel: shadow stack on rest, collapses on press.
        // We also disable the inherited `hover:-translate-y-0.5` so the
        // shadow movement reads as the only Z-axis motion.
        "press-bounce rounded-button uppercase tracking-wide",
        "hover:translate-y-0 active:translate-y-[3px] disabled:shadow-none disabled:active:translate-y-0",
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
});
