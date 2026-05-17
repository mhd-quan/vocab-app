/**
 * JSX intrinsic declarations for the Material Web Components we use.
 *
 * React 18 doesn't yet ship native typings for unknown custom elements,
 * so each `md-*` element we touch from JSX needs an entry here. We keep
 * the prop surface deliberately narrow — only the attributes the wrapper
 * components actually pass through. Anything richer goes via a `ref` +
 * imperative assignment.
 *
 * Boolean props are typed as `boolean | undefined`; at render time React
 * converts those to the literal string "true"/"false" attributes, which
 * Lit elements parse correctly for their `@property({ type: Boolean })`
 * declarations. Event listeners are typed as `(e: Event) => void`
 * because the underlying events are `CustomEvent`s — the wrapper layer
 * narrows them to the right payload shape.
 */

import type * as React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": MdButtonProps;
      "md-outlined-button": MdButtonProps;
      "md-text-button": MdButtonProps;
      "md-elevated-button": MdButtonProps;
      "md-tonal-button": MdButtonProps;

      "md-switch": MdSwitchProps;

      "md-outlined-text-field": MdTextFieldProps;
      "md-filled-text-field": MdTextFieldProps;

      "md-outlined-select": MdSelectProps;
      "md-filled-select": MdSelectProps;
      "md-select-option": MdSelectOptionProps;

      "md-list": MdGenericProps;
      "md-list-item": MdListItemProps;
      "md-divider": MdGenericProps;

      "md-icon": MdGenericProps;
      "md-ripple": MdGenericProps;
    }
  }
}

type MdGenericProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  // Always-allowed common ARIA attributes Lit elements forward to internals.
  "aria-label"?: string;
};

interface MdButtonProps extends MdGenericProps {
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  trailingIcon?: boolean;
  href?: string;
  target?: string;
  form?: string;
  name?: string;
  value?: string;
}

interface MdSwitchProps extends MdGenericProps {
  selected?: boolean;
  disabled?: boolean;
  icons?: boolean;
  "show-only-selected-icon"?: boolean;
  required?: boolean;
  value?: string;
  name?: string;
}

interface MdTextFieldProps extends MdGenericProps {
  value?: string;
  label?: string;
  type?: "text" | "email" | "number" | "password" | "search" | "tel" | "url" | "textarea";
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  "supporting-text"?: string;
  "error-text"?: string;
  error?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  pattern?: string;
  prefix?: string;
  suffix?: string;
  rows?: number;
  cols?: number;
  name?: string;
  inputMode?: string;
}

interface MdSelectProps extends MdGenericProps {
  value?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  "supporting-text"?: string;
  "menu-positioning"?: "absolute" | "fixed" | "popover";
}

interface MdSelectOptionProps extends MdGenericProps {
  value?: string;
  selected?: boolean;
  disabled?: boolean;
  headline?: string;
}

interface MdListItemProps extends MdGenericProps {
  type?: "text" | "button" | "link";
  href?: string;
  disabled?: boolean;
  selected?: boolean;
}
