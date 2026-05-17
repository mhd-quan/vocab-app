/**
 * `<md-outlined-text-field>` wrapper with React-friendly value binding.
 *
 * Like `MdSwitchField`, we attach the `input` listener imperatively
 * because React 18 doesn't bridge CustomEvents. The component remains
 * controlled — pass `value` + `onChange`, no internal state.
 */
import { useEffect, useRef } from "react";

interface TextFieldElement extends HTMLElement {
  value: string;
}

export interface MdTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "number" | "password" | "search" | "tel" | "url";
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  supportingText?: string;
  errorText?: string;
  error?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function MdTextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  required,
  supportingText,
  errorText,
  error,
  min,
  max,
  step,
  className,
}: MdTextFieldProps) {
  const ref = useRef<TextFieldElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (node.value !== value) node.value = value;
  }, [value]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = (e: Event) => {
      const target = e.target as TextFieldElement | null;
      if (target) onChange(target.value);
    };
    node.addEventListener("input", handler);
    return () => node.removeEventListener("input", handler);
  }, [onChange]);

  return (
    <md-outlined-text-field
      ref={ref as unknown as React.Ref<HTMLElement>}
      label={label}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      supporting-text={supportingText}
      error-text={errorText}
      error={error}
      min={min}
      max={max}
      step={step}
      className={className}
    />
  );
}
