/**
 * `<md-outlined-select>` wrapper that renders an `<md-select-option>`
 * per option. Value binding is controlled — React owns state.
 *
 * `change` fires when the user picks a different option; the imperative
 * listener pulls the new `value` off the target.
 */
import { useEffect, useRef } from "react";

interface SelectElement extends HTMLElement {
  value: string;
}

export interface MdSelectFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MdSelectFieldProps {
  label: string;
  value: string;
  options: ReadonlyArray<MdSelectFieldOption>;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  supportingText?: string;
  className?: string;
}

export function MdSelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  required,
  supportingText,
  className,
}: MdSelectFieldProps) {
  const ref = useRef<SelectElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `options` is
  // intentional — when the option set changes the underlying md-select can
  // drop its previously-selected value, so we re-sync after the swap.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (node.value !== value) node.value = value;
  }, [value, options]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = (e: Event) => {
      const target = e.target as SelectElement | null;
      if (target) onChange(target.value);
    };
    node.addEventListener("change", handler);
    return () => node.removeEventListener("change", handler);
  }, [onChange]);

  return (
    <md-outlined-select
      ref={ref as unknown as React.Ref<HTMLElement>}
      label={label}
      value={value}
      disabled={disabled}
      required={required}
      supporting-text={supportingText}
      className={className}
    >
      {options.map((option) => (
        <md-select-option
          key={option.value}
          value={option.value}
          selected={option.value === value}
          disabled={option.disabled}
        >
          <div slot="headline">{option.label}</div>
        </md-select-option>
      ))}
    </md-outlined-select>
  );
}
