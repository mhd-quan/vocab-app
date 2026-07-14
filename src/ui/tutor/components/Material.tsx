import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";
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
  section: "Workspace" | "Tools" | "System";
  hint?: string;
  disabled?: boolean;
}

export interface TutorNavigationRailProps {
  items: TutorNavItem[];
  footer?: ReactNode;
  collapsed?: boolean;
}

export function TutorNavigationRail({
  items,
  footer,
  collapsed = false,
}: TutorNavigationRailProps) {
  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <aside
      className={cn(
        "window-material flex h-full shrink-0 flex-col border-r border-border-subtle transition-[width] duration-base",
        collapsed ? "w-[3.25rem]" : "w-[var(--tutor-nav-width)]",
      )}
    >
      <nav className="flex flex-1 flex-col px-2 py-2.5" aria-label="Tutor navigation">
        {(["Workspace", "Tools", "System"] as const).map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section} className="mb-2.5 last:mb-0">
              {!collapsed ? (
                <p className="px-2 pb-1 text-[11px] font-medium text-muted-2">{section}</p>
              ) : null}
              <div className="flex flex-col gap-0.5">
                {sectionItems.map((item) => {
                  const active = currentPath === item.to || currentPath.startsWith(`${item.to}/`);
                  return (
                    <TutorNavigationItem
                      key={item.to}
                      item={item}
                      active={active}
                      collapsed={collapsed}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      {footer ? (
        <div className={cn("border-t border-border-subtle p-2", collapsed && "[&_span]:hidden")}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

function TutorNavigationItem({
  item,
  active,
  collapsed,
}: {
  item: TutorNavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const className = cn(
    "ui-focus-ring group relative flex h-[var(--size-row-compact)] items-center overflow-hidden rounded-control text-ui font-medium",
    "transition-[background-color,color] duration-fast before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-r-full before:transition-colors before:duration-fast",
    collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
    item.disabled
      ? "cursor-not-allowed text-muted-2"
      : active
        ? "bg-accent-fill/10 text-app before:bg-iris"
        : "text-muted hover:bg-surface-2 hover:text-app active:bg-surface-3/60",
  );

  const content = (
    <>
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center transition-colors [&_svg]:h-[18px] [&_svg]:w-[18px]",
          active ? "text-accent" : "text-muted group-hover:text-app",
        )}
      >
        {item.icon}
      </span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
      {!collapsed && item.hint ? (
        <span className="text-[10px] text-muted-2">{item.hint}</span>
      ) : null}
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
    <Link
      to={item.to}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={className}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </Link>
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
    <section className={cn("object-surface overflow-hidden p-4", className)}>
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
        "object-surface learning-trace flex min-h-20 flex-col justify-between px-4 py-3",
        metricTone(tone),
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-ui font-medium text-muted">{label}</span>
        {icon ? <span className="text-muted-2">{icon}</span> : null}
      </div>
      <div>
        <p className="tabular-figure text-2xl font-semibold leading-none text-app">{value}</p>
        {hint ? <p className="mt-2 text-xs text-muted-2">{hint}</p> : null}
      </div>
    </div>
  );
}

function metricTone(tone: "primary" | "secondary" | "tertiary" | "success" | "warning") {
  switch (tone) {
    case "secondary":
      return "[--trace-rgb:var(--color-muted)]";
    case "tertiary":
      return "[--trace-rgb:var(--color-ochre)]";
    case "success":
      return "[--trace-rgb:var(--color-moss)]";
    case "warning":
      return "[--trace-rgb:var(--color-ochre)]";
    case "primary":
      return "[--trace-rgb:var(--color-iris)]";
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
    <div className={cn("grouped-list", className)}>
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
    <div className={cn("flex min-w-0 flex-col gap-1", containerClassName)}>
      <label htmlFor={fieldId} className="text-xs font-medium text-muted">
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
        <AppGlyph
          name="chevronDown"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2"
        />
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
      <div className={cn("flex min-w-0 flex-col gap-1", containerClassName)}>
        <label htmlFor={fieldId} className="text-xs font-medium text-muted">
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
      <div className={cn("flex min-w-0 flex-col gap-1", containerClassName)}>
        <label htmlFor={fieldId} className="text-xs font-medium text-muted">
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
        "flex min-h-[var(--size-row)] min-w-0 items-center justify-between gap-4 border-b border-border-subtle bg-transparent px-0 py-2 text-left last:border-b-0",
        "ui-focus-ring transition-[background-color,border-color] duration-fast hover:bg-accent/[var(--state-hover)]",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <span className="min-w-0">
        <span id={labelId} className="block text-[13px] font-medium text-app">
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
          "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-paper ring-1 ring-inset ring-border-subtle transition-transform duration-fast",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
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
        "grid rounded-control border border-border-strong/60 bg-surface-2 p-[2px]",
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
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "ui-focus-ring h-7 min-w-0 rounded-control px-3 text-center transition-[background-color,color] duration-fast",
              active
                ? "bg-paper text-app"
                : "text-muted hover:bg-accent/[var(--state-hover)] hover:text-app",
            )}
          >
            <span className="block truncate text-xs font-medium">{option.label}</span>
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
        "ui-focus-ring inline-grid h-[var(--size-control-md)] w-[var(--size-control-md)] place-items-center rounded-control text-muted transition-[background-color,color] duration-fast",
        "hover:bg-surface-2 hover:text-app",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const tutorFieldClassName = cn(
  "ui-focus-ring h-[var(--size-control-md)] w-full min-w-0 rounded-control border border-border-strong/60",
  "bg-paper px-2.5 text-ui text-app",
  "transition-[background-color,border-color] duration-fast placeholder:text-muted-2",
  "focus-visible:border-accent focus-visible:bg-paper",
  "disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-[color:var(--md-sys-color-surface-container)] disabled:text-muted",
);
