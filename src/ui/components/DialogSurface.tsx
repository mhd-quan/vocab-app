import { cn } from "@/lib/cn";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogStackEntry {
  owner: symbol;
  viewport: HTMLElement;
}

interface SuppressedAppRoot {
  element: HTMLElement;
  ariaHidden: string | null;
  inert: boolean;
}

const dialogStack: DialogStackEntry[] = [];
let bodyOverflowBeforeDialogs = "";
let suppressedAppRoots: SuppressedAppRoot[] = [];

export interface DialogSurfaceProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  closeLabel: string;
  initialFocusSelector?: string;
  className?: string;
  viewportClassName?: string;
  zIndexClassName?: string;
}

/**
 * Shared window-scoped overlay behavior. Modal sheets, the dictionary and
 * the command palette all use the same scrim, focus trap, Escape behavior,
 * focus restoration and scroll lock; only their content geometry differs.
 */
export function DialogSurface({
  open,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  closeLabel,
  initialFocusSelector,
  className,
  viewportClassName,
  zIndexClassName = "z-50",
}: DialogSurfaceProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const ownerRef = useRef(Symbol("dialog-surface"));
  const onCloseRef = useRef(onClose);
  const initialFocusSelectorRef = useRef(initialFocusSelector);

  // Event listeners stay mounted for the lifetime of the open dialog. Keep
  // changing callback/selector identities out of that lifecycle.
  onCloseRef.current = onClose;
  initialFocusSelectorRef.current = initialFocusSelector;

  useEffect(() => {
    if (!open || !viewportRef.current) return;

    const owner = ownerRef.current;
    const viewport = viewportRef.current;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const isFirstDialog = registerDialog({ owner, viewport });

    // Establish stack ownership before moving focus so an existing dialog's
    // focus guard recognises the new top layer. Only then make lower layers
    // inert; this avoids hiding an ancestor that still owns active focus.
    focusInsideDialog(dialogRef.current, initialFocusSelectorRef.current);
    if (isFirstDialog) suppressAppBackground();
    syncDialogStackAccessibility();

    const frame = requestAnimationFrame(() => {
      if (!isTopmostDialog(owner)) return;
      focusInsideDialog(dialogRef.current, initialFocusSelectorRef.current);
    });

    function onKeyDown(event: KeyboardEvent) {
      if (!isTopmostDialog(owner)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const root = dialogRef.current;
      const focusable = getVisibleFocusableElements(root);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!root || !first || !last) {
        event.preventDefault();
        root?.focus();
        return;
      }

      if (!root.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onFocusIn(event: FocusEvent) {
      const root = dialogRef.current;
      if (
        !root ||
        !isTopmostDialog(owner) ||
        (event.target instanceof Node && root.contains(event.target))
      ) {
        return;
      }
      focusInsideDialog(root, initialFocusSelectorRef.current);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const wasTopmost = unregisterDialog(owner);
      if (wasTopmost && previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={viewportRef}
      data-dialog-surface
      className={cn(
        "motion-scrim-in fixed inset-0 flex justify-center overflow-y-auto bg-black/30 px-4",
        zIndexClassName,
        viewportClassName ?? "items-start pt-[max(4.25rem,8vh)]",
      )}
    >
      <button
        type="button"
        aria-label={closeLabel}
        data-dialog-backdrop
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (isTopmostDialog(ownerRef.current)) onCloseRef.current();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={cn(
          "overlay-material motion-sheet-in relative flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-[var(--radius-overlay)] shadow-lift ring-1 ring-black/10 dark:ring-white/10",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function registerDialog(entry: DialogStackEntry): boolean {
  const isFirstDialog = dialogStack.length === 0;
  dialogStack.push(entry);
  return isFirstDialog;
}

function unregisterDialog(owner: symbol): boolean {
  const index = dialogStack.findIndex((entry) => entry.owner === owner);
  if (index < 0) return false;

  const wasTopmost = index === dialogStack.length - 1;
  const [removed] = dialogStack.splice(index, 1);
  if (removed) {
    setElementInert(removed.viewport, false);
    removed.viewport.removeAttribute("aria-hidden");
  }
  syncDialogStackAccessibility();
  if (dialogStack.length === 0) restoreAppBackground();
  return wasTopmost;
}

function isTopmostDialog(owner: symbol): boolean {
  return dialogStack.at(-1)?.owner === owner;
}

function syncDialogStackAccessibility() {
  const topmost = dialogStack.at(-1);
  for (const entry of dialogStack) {
    const inactive = entry !== topmost;
    setElementInert(entry.viewport, inactive);
    if (inactive) entry.viewport.setAttribute("aria-hidden", "true");
    else entry.viewport.removeAttribute("aria-hidden");
  }
}

function suppressAppBackground() {
  bodyOverflowBeforeDialogs = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  suppressedAppRoots = Array.from(document.querySelectorAll<HTMLElement>("[data-app-window]")).map(
    (element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.inert,
    }),
  );

  for (const { element } of suppressedAppRoots) {
    setElementInert(element, true);
    element.setAttribute("aria-hidden", "true");
  }
}

function restoreAppBackground() {
  document.body.style.overflow = bodyOverflowBeforeDialogs;
  for (const { element, ariaHidden, inert } of suppressedAppRoots) {
    setElementInert(element, inert);
    if (ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", ariaHidden);
  }
  suppressedAppRoots = [];
}

function setElementInert(element: HTMLElement, inert: boolean) {
  element.inert = inert;
  if (inert) element.setAttribute("inert", "");
  else element.removeAttribute("inert");
}

function focusInsideDialog(root: HTMLElement | null, selector?: string) {
  if (!root) return;
  const initial = findInitialFocus(root, selector);
  const focusable = getVisibleFocusableElements(root);
  const fallback =
    focusable.find((element) => !element.hasAttribute("data-modal-skip-focus")) ?? focusable[0];
  (initial ?? fallback ?? root).focus();
}

function getVisibleFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisiblyFocusable);
}

function isVisiblyFocusable(element: HTMLElement): boolean {
  if (element.matches(":disabled") || element.closest("[hidden], [inert], [aria-hidden='true']")) {
    return false;
  }
  if (element instanceof HTMLInputElement && element.type === "hidden") return false;
  let current: HTMLElement | null = element;
  while (current) {
    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden"
    ) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function findInitialFocus(root: HTMLElement, selector: string | undefined): HTMLElement | null {
  if (!selector) return null;
  if (selector.startsWith("#")) {
    const candidate = document.getElementById(selector.slice(1));
    return candidate instanceof HTMLElement &&
      root.contains(candidate) &&
      isVisiblyFocusable(candidate)
      ? candidate
      : null;
  }
  try {
    return (
      Array.from(root.querySelectorAll<HTMLElement>(selector)).find(isVisiblyFocusable) ?? null
    );
  } catch {
    return null;
  }
}
