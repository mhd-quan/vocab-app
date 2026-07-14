import { cn } from "@/lib/cn";
import { type InputHTMLAttributes, forwardRef } from "react";

export interface PinInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  invalid?: boolean;
  density?: "default" | "compact";
}

export const PinInput = forwardRef<HTMLInputElement, PinInputProps>(function PinInput(
  { className, density = "default", invalid, "aria-invalid": ariaInvalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="password"
      inputMode="text"
      autoCapitalize="none"
      autoComplete="off"
      spellCheck={false}
      aria-invalid={ariaInvalid ?? (invalid ? true : undefined)}
      className={cn(
        "ui-focus-ring w-full rounded-control border bg-paper text-center font-mono text-app",
        "transition-[background-color,border-color] duration-fast placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-2",
        density === "compact"
          ? "h-[var(--size-control-md)] px-3 text-ui tracking-[0.12em]"
          : "h-[var(--size-control-lg)] px-4 text-base tracking-[0.18em]",
        invalid
          ? "border-danger/65 focus-visible:border-danger"
          : "border-border-strong/60 focus-visible:border-accent",
        "disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-surface-2 disabled:text-muted",
        className,
      )}
      {...props}
    />
  );
});
