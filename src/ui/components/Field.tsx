import { cn } from "@/lib/cn";
import {
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  forwardRef,
  useId,
} from "react";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Layout wrapper for one form field. Renders an explicit `<label>` element
 * whose text content is exactly `label` (so `getByLabelText` matches
 * cleanly), plus a sibling hint or error block. Hints and errors should be
 * exposed to the input through `aria-describedby` — consumers control that
 * association by reading `htmlFor` and naming the help text accordingly.
 */
export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
          {label}
        </label>
      ) : (
        <span className="text-xs font-medium text-muted">{label}</span>
      )}
      {children}
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-muted-2">{hint}</span>
      ) : null}
    </div>
  );
}

const inputBase =
  "ui-focus-ring h-[var(--size-control-md)] w-full rounded-control border bg-paper px-2.5 text-[13px] text-app placeholder:text-muted-2 " +
  "transition-[background-color,border-color]";

const inputTone = (invalid: boolean | undefined) =>
  invalid
    ? "border-danger/60 focus-visible:ring-danger/50"
    : "border-border-subtle focus-visible:border-accent";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, invalid, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(inputBase, inputTone(invalid), className)}
      {...props}
    />
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, invalid, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(inputBase, "h-auto min-h-24 resize-y py-2", inputTone(invalid), className)}
      {...props}
    />
  );
});

/** Generate a unique id for label/control association. */
export function useFieldId(prefix: string): string {
  const id = useId();
  return `${prefix}-${id}`;
}
