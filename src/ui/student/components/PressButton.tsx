/**
 * Student-facing action button. It shares the same geometry and keyboard
 * contract as the rest of the app; the separate name remains as a stable
 * API for exercise components, not as a second visual language.
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
  return <Button ref={ref} size={size} className={cn(block && "w-full", className)} {...props} />;
});
