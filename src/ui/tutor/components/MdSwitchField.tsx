/**
 * Thin React wrapper around `<md-switch>`.
 *
 * React 18 hands non-standard JSX attributes to custom elements as
 * stringified HTML attributes — that's fine for `selected` (Lit parses
 * "true"/"false" via its boolean converter). But two-way state binding
 * needs a `change` event listener attached imperatively, because React
 * 18's synthetic-event system doesn't bridge CustomEvents.
 */
import { type ReactNode, useEffect, useId, useRef } from "react";

export interface MdSwitchFieldProps {
  /** Label shown next to the switch. */
  label: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  /** Optional secondary line under the label. */
  description?: ReactNode;
}

interface SwitchElement extends HTMLElement {
  selected: boolean;
}

export function MdSwitchField({
  label,
  checked,
  disabled,
  onChange,
  description,
}: MdSwitchFieldProps) {
  const id = useId();
  const ref = useRef<SwitchElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Keep the DOM in sync with React state — JSX attribute alone is
    // sometimes ignored after the first paint, so we set the property.
    node.selected = checked;
  }, [checked]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = (e: Event) => {
      const target = e.target as SwitchElement | null;
      onChange(target?.selected === true);
    };
    node.addEventListener("change", handler);
    return () => node.removeEventListener("change", handler);
  }, [onChange]);

  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-4 rounded-button border border-border-subtle bg-surface-0 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-app">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        ) : null}
      </div>
      <md-switch
        ref={ref as unknown as React.Ref<HTMLElement>}
        id={id}
        selected={checked}
        disabled={disabled}
      />
    </label>
  );
}
