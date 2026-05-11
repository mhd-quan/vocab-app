import { cn } from "@/lib/cn";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Defaults to `md`. */
  size?: "sm" | "md" | "lg";
  /**
   * Element id of the input that should receive focus when the modal opens.
   * Falls back to the first focusable element inside the dialog.
   */
  initialFocusId?: string;
}

const SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/**
 * Headless dialog implementation. Renders into a portal so the dialog can
 * escape clipping ancestors, traps Escape to close, and focuses the body
 * after mount so keyboard users land on the form rather than the page
 * they came from.
 *
 * Backdrop click closes; Escape closes. Tab focus is NOT trapped — for the
 * forms we use here, native tabbing through a small set of fields plus the
 * close button is enough and keeps a11y predictable.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  initialFocusId,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      if (initialFocusId) {
        const el = document.getElementById(initialFocusId) as HTMLElement | null;
        if (el) {
          el.focus();
          return;
        }
      }
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        "input, textarea, select, button:not([data-modal-skip-focus])",
      );
      firstFocusable?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, initialFocusId]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        data-modal-skip-focus
        className="absolute inset-0 bg-surface-0/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full overflow-hidden rounded-lg border border-border-subtle bg-surface-1 shadow-2xl",
          SIZE[size],
        )}
      >
        <header className="border-b border-border-subtle px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border-subtle bg-surface-0/40 px-6 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
