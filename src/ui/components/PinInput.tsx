import { cn } from "@/lib/cn";
import { type InputHTMLAttributes, forwardRef } from "react";

export interface PinInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  invalid?: boolean;
  density?: "default" | "compact";
}

export const PinInput = forwardRef<HTMLInputElement, PinInputProps>(function PinInput(
  { className, density = "default", invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      className={cn(
        "w-full rounded-xl border bg-surface-1 text-center font-mono text-app",
        density === "compact" ? "h-10 px-3 text-sm tracking-[0.12em]" : "px-4 py-3 text-2xl",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0",
        invalid
          ? "border-danger/60 focus-visible:ring-danger/50"
          : "border-border-subtle focus-visible:border-accent focus-visible:ring-accent/40",
        className,
      )}
      {...props}
    />
  );
});
