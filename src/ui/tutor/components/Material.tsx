import { cn } from "@/lib/cn";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
  useId,
} from "react";

export interface TutorNavItem {
  to: string;
  label: string;
  icon: ReactNode;
  hint?: string;
  disabled?: boolean;
}

export interface TutorNavigationRailProps {
  brand: ReactNode;
  items: TutorNavItem[];
  footer?: ReactNode;
  topInset?: boolean;
}

export function TutorNavigationRail({ brand, items, footer, topInset }: TutorNavigationRailProps) {
  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <aside className="flex h-full w-[var(--tutor-nav-width)] shrink-0 flex-col border-r border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)] shadow-[var(--md-sys-elevation-1)]">
      {topInset ? <div className="h-10 w-full shrink-0 [-webkit-app-region:drag]" /> : null}
      <div className={cn("px-4 pb-5", topInset ? "pt-2" : "pt-5")}>{brand}</div>
      <nav className="flex flex-1 flex-col gap-1.5 px-3" aria-label="Tutor navigation">
        {items.map((item) => {
          const active = currentPath === item.to || currentPath.startsWith(`${item.to}/`);
          return <TutorNavigationItem key={item.to} item={item} active={active} />;
        })}
      </nav>
      {footer ? (
        <div className="border-t border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] px-3 py-3">
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

function TutorNavigationItem({ item, active }: { item: TutorNavItem; active: boolean }) {
  const className = cn(
    "group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-[var(--shape-corner-lg)] border px-3 text-sm font-semibold",
    "transition-[background-color,color,box-shadow,transform] duration-200 ease-[var(--motion-emphasized)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0",
    item.disabled
      ? "cursor-not-allowed text-muted-2"
      : active
        ? "border-transparent bg-[color:var(--md-sys-color-primary-container)] text-[color:var(--md-sys-color-on-primary-container)] shadow-[var(--md-sys-elevation-1)]"
        : "border-transparent text-muted hover:border-border-subtle hover:bg-[color:var(--md-sys-color-surface-container)] hover:text-app active:bg-accent/[var(--state-pressed)]",
  );

  const content = (
    <>
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-[var(--shape-corner-md)] transition-[background-color,color,transform]",
          active
            ? "bg-[color:var(--md-sys-color-primary)] text-[color:var(--md-sys-color-on-primary)]"
            : "bg-[color:var(--md-sys-color-surface-container)] text-muted group-hover:bg-[color:var(--md-sys-color-surface-container-high)] group-hover:text-app",
        )}
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.hint ? <span className="text-[10px] text-muted-2">{item.hint}</span> : null}
    </>
  );

  if (item.disabled) {
    return (
      <span aria-disabled className={className}>
        {content}
      </span>
    );
  }

  return (
    <Link to={item.to} className={className} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}

export function TutorBrand({ version }: { version: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--shape-corner-lg)] bg-[color:var(--md-sys-color-primary)] text-base font-black text-[color:var(--md-sys-color-on-primary)] shadow-[var(--md-sys-elevation-2)]">
        V
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase text-muted-2">
          Tutor workspace
        </span>
        <span className="block truncate font-display text-lg font-semibold leading-tight text-app">
          Vocab App
        </span>
        <span className="block font-mono text-[11px] text-muted-2">{version}</span>
      </span>
    </div>
  );
}

export function TutorPanel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "motion-enter rounded-[var(--shape-corner-xl)] border border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)] p-5 shadow-card",
        className,
      )}
    >
      {title || description || actions ? (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-base font-semibold text-app">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function TutorMetricCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "primary" | "secondary" | "tertiary" | "success" | "warning";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "motion-card motion-enter relative isolate flex min-h-32 flex-col justify-between overflow-hidden rounded-[var(--shape-corner-xl)] border bg-[color:var(--md-sys-color-surface-container-lowest)] p-4 shadow-card",
        metricTone(tone),
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-0.5 rounded-b-full bg-current opacity-70"
      />
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-normal text-current">
          {label}
        </span>
        {icon ? <span className="text-muted-2">{icon}</span> : null}
      </div>
      <div>
        <p className="font-mono text-3xl leading-none text-app">{value}</p>
        {hint ? <p className="mt-2 text-xs text-muted-2">{hint}</p> : null}
      </div>
    </div>
  );
}

function metricTone(tone: "primary" | "secondary" | "tertiary" | "success" | "warning") {
  switch (tone) {
    case "secondary":
      return "border-[color:var(--md-sys-color-secondary-container)] text-[color:var(--md-sys-color-secondary)]";
    case "tertiary":
      return "border-[color:var(--md-sys-color-tertiary-container)] text-[color:var(--md-sys-color-tertiary)]";
    case "success":
      return "border-success/25 text-success";
    case "warning":
      return "border-warning/30 text-warning";
    case "primary":
      return "border-[color:var(--md-sys-color-primary-container)] text-[color:var(--md-sys-color-primary)]";
  }
}

export function TutorDataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--shape-corner-xl)] border border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)] shadow-card",
        className,
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export interface TutorSelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label: string;
  options: Array<{ value: string; label: string }>;
  supportingText?: string;
  onChange: (value: string) => void;
  containerClassName?: string;
}

export function TutorSelectField({
  label,
  options,
  supportingText,
  value,
  onChange,
  disabled,
  className,
  containerClassName,
  id,
  ...props
}: TutorSelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const supportingId = supportingText ? `${fieldId}-supporting` : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", containerClassName)}>
      <label htmlFor={fieldId} className="text-xs font-semibold uppercase text-muted-2">
        {label}
      </label>
      <span className="relative block min-w-0">
        <select
          id={fieldId}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          aria-describedby={supportingId}
          className={cn(tutorFieldClassName, "appearance-none pr-10", className)}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
      </span>
      {supportingText ? (
        <span id={supportingId} className="text-xs text-muted-2">
          {supportingText}
        </span>
      ) : null}
    </div>
  );
}

export interface TutorTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  supportingText?: string;
  containerClassName?: string;
}

export const TutorTextField = forwardRef<HTMLInputElement, TutorTextFieldProps>(
  function TutorTextField(
    { label, supportingText, containerClassName, className, id, ...props },
    ref,
  ) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const supportingId = supportingText ? `${fieldId}-supporting` : undefined;
    return (
      <div className={cn("flex min-w-0 flex-col gap-1.5", containerClassName)}>
        <label htmlFor={fieldId} className="text-xs font-semibold uppercase text-muted-2">
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-describedby={supportingId}
          className={cn(tutorFieldClassName, className)}
          {...props}
        />
        {supportingText ? (
          <span id={supportingId} className="text-xs text-muted-2">
            {supportingText}
          </span>
        ) : null}
      </div>
    );
  },
);

export interface TutorTextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  supportingText?: string;
  containerClassName?: string;
}

export const TutorTextAreaField = forwardRef<HTMLTextAreaElement, TutorTextAreaFieldProps>(
  function TutorTextAreaField(
    { label, supportingText, containerClassName, className, id, rows = 3, ...props },
    ref,
  ) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const supportingId = supportingText ? `${fieldId}-supporting` : undefined;
    return (
      <div className={cn("flex min-w-0 flex-col gap-1.5", containerClassName)}>
        <label htmlFor={fieldId} className="text-xs font-semibold uppercase text-muted-2">
          {label}
        </label>
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-describedby={supportingId}
          className={cn(tutorFieldClassName, "min-h-24 resize-y py-3", className)}
          {...props}
        />
        {supportingText ? (
          <span id={supportingId} className="text-xs text-muted-2">
            {supportingText}
          </span>
        ) : null}
      </div>
    );
  },
);

export function TutorSwitchField({
  label,
  description,
  checked,
  disabled,
  onChange,
  className,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-w-0 items-center justify-between gap-4 rounded-[var(--shape-corner-lg)] border border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)] px-3 py-2.5 text-left",
        "transition-[background-color,border-color,box-shadow] hover:bg-accent/[var(--state-hover)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <span className="min-w-0">
        <span id={labelId} className="block text-sm font-semibold text-app">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-xs leading-5 text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border-2 transition-[background-color,border-color]",
          checked
            ? "border-accent bg-accent"
            : "border-[color:var(--md-sys-color-outline)] bg-[color:var(--md-sys-color-surface-container-highest)]",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-[color:var(--md-sys-color-surface-container-lowest)] shadow-[var(--md-sys-elevation-1)] transition-transform",
            checked ? "translate-x-[1.32rem]" : "translate-x-0.5",
          )}
        >
          {checked ? <CheckIcon className="h-3.5 w-3.5 text-accent" /> : null}
        </span>
      </span>
    </button>
  );
}

export function TutorSegmentedControl({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: Array<{ value: string; label: string; detail?: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-[var(--shape-corner-lg)] bg-[color:var(--md-sys-color-surface-container-high)] p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-0 rounded-[var(--shape-corner-md)] px-3 py-2 text-left transition-[background-color,color,box-shadow]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
              active
                ? "bg-[color:var(--md-sys-color-primary-container)] text-[color:var(--md-sys-color-on-primary-container)] shadow-[var(--md-sys-elevation-1)]"
                : "text-muted hover:bg-accent/[var(--state-hover)] hover:text-app",
            )}
          >
            <span className="block truncate text-sm font-semibold">{option.label}</span>
            {option.detail ? (
              <span className="mt-0.5 block truncate text-[10px] uppercase text-muted-2">
                {option.detail}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TutorIconButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-grid h-9 w-9 place-items-center rounded-[var(--shape-corner-md)] text-muted transition-[background-color,color,transform]",
        "hover:bg-accent/[var(--state-hover)] hover:text-app active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const tutorFieldClassName = cn(
  "h-11 w-full min-w-0 rounded-[var(--shape-corner-lg)] border border-border-subtle",
  "bg-[color:var(--md-sys-color-surface-container-low)] px-3.5 text-sm text-app shadow-sm",
  "transition-[background-color,border-color,box-shadow] placeholder:text-muted-2",
  "focus:border-accent focus:bg-[color:var(--md-sys-color-surface-container-lowest)] focus:outline-none focus:ring-4 focus:ring-accent/15",
  "disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-[color:var(--md-sys-color-surface-container)] disabled:text-muted",
);

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M4.2 6.1a.7.7 0 0 1 1 0L8 8.9l2.8-2.8a.7.7 0 0 1 1 1L8.5 10.4a.7.7 0 0 1-1 0L4.2 7.1a.7.7 0 0 1 0-1Z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M6.4 10.6 3.7 7.9a.8.8 0 1 1 1.1-1.1l1.6 1.6 4.7-4.7a.8.8 0 1 1 1.1 1.1l-5.3 5.8a.8.8 0 0 1-1.1 0Z"
      />
    </svg>
  );
}
