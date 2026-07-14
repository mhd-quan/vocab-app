import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { DialogSurface } from "@/ui/components/DialogSurface";
import { type ReactNode, useId } from "react";

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
 * Backdrop click and Escape close the sheet. Tab and Shift+Tab stay within
 * the dialog, and focus returns to the invoking control when the sheet closes.
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
  const titleId = useId();
  const descriptionId = useId();
  return (
    <DialogSurface
      open={open}
      onClose={onClose}
      closeLabel="Close dialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={description ? descriptionId : undefined}
      initialFocusSelector={initialFocusId ? `#${initialFocusId}` : undefined}
      className={cn("w-full", SIZE[size])}
    >
      <header className="flex shrink-0 items-start gap-4 px-5 pb-2 pt-5">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-[13px] leading-5 text-muted">
              {description}
            </p>
          ) : null}
        </div>
        {!footer ? (
          <button
            type="button"
            data-modal-skip-focus
            aria-label="Close"
            onClick={onClose}
            className="ui-focus-ring grid h-7 w-7 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-app"
          >
            <AppGlyph name="x" className="h-4 w-4" />
          </button>
        ) : null}
      </header>
      <div data-modal-body className="min-h-0 overflow-y-auto px-5 pb-5 pt-3">
        {children}
      </div>
      {footer ? (
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border-subtle bg-surface-2/45 px-5 py-3">
          {footer}
        </footer>
      ) : null}
    </DialogSurface>
  );
}
