import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { DialogSurface } from "@/ui/components/DialogSurface";
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useMemo, useState } from "react";

export function WindowIconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "ui-focus-ring inline-grid h-[var(--size-control-md)] w-[var(--size-control-md)] shrink-0 place-items-center rounded-control text-muted",
        "transition-[background-color,color,box-shadow] duration-100 hover:bg-surface-2 hover:text-app active:bg-surface-3 active:shadow-[inset_0_0_0_1px_rgb(var(--color-border-subtle))]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function WindowBackButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Back to ${label}`}
      title={`Back to ${label}`}
      className={cn(
        "ui-focus-ring inline-flex h-[var(--size-control-md)] max-w-40 items-center gap-1 rounded-control px-1.5 text-[13px] font-medium text-muted",
        "transition-[background-color,color,box-shadow] duration-100 hover:bg-surface-2 hover:text-app active:shadow-[inset_0_0_0_1px_rgb(var(--color-border-subtle))]",
        "[-webkit-app-region:no-drag]",
        className,
      )}
    >
      <AppGlyph name="back" className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function CommandTrigger({
  onClick,
  shortcut = "⌘K",
  className,
}: { onClick: () => void; shortcut?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ui-focus-ring inline-flex h-[var(--size-control-md)] min-w-40 items-center gap-2 rounded-control border border-border-strong/60",
        "bg-surface-1/74 px-2.5 text-xs text-muted transition-colors hover:bg-surface-1 hover:text-app",
        "[-webkit-app-region:no-drag]",
        className,
      )}
    >
      <AppGlyph name="search" className="h-4 w-4" />
      <span className="min-w-0 flex-1 truncate text-left">Search or jump to…</span>
      <kbd className="rounded-[4px] bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-2">
        {shortcut}
      </kbd>
    </button>
  );
}

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  shortcut?: string;
  keywords?: string;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      `${item.label} ${item.group} ${item.keywords ?? ""}`.toLocaleLowerCase().includes(needle),
    );
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
  }, [open]);

  function choose(item: CommandItem | undefined) {
    if (!item) return;
    onClose();
    item.onSelect();
  }

  return (
    <DialogSurface
      open={open}
      onClose={onClose}
      closeLabel="Close command palette"
      ariaLabel="Command palette"
      initialFocusSelector="[data-command-input]"
      viewportClassName="items-start px-5 pt-[12vh]"
      zIndexClassName="z-[70]"
      className="flex max-h-[min(34rem,72vh)] w-full max-w-xl flex-col"
    >
      <label className="flex h-11 shrink-0 items-center gap-3 border-b border-border-subtle px-4 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-2 focus-within:ring-inset focus-within:ring-focus/30">
        <AppGlyph name="search" className="h-[18px] w-[18px] text-muted" />
        <input
          data-command-input
          role="combobox"
          aria-label="Search commands and destinations"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="command-palette-listbox"
          aria-activedescendant={
            filtered.length > 0 ? `command-palette-option-${active}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (filtered.length > 0) {
                setActive((value) => Math.min(value + 1, filtered.length - 1));
              }
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(value - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              choose(filtered[active]);
            }
          }}
          placeholder="Type a command or destination"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-app outline-none placeholder:text-muted-2"
        />
        <kbd className="font-mono text-[10px] text-muted-2">ESC</kbd>
      </label>
      <div
        id="command-palette-listbox"
        className="overflow-y-auto p-2"
        role="listbox"
        aria-label="Commands"
        tabIndex={-1}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted">No matching command</p>
        ) : (
          filtered.map((item, index) => {
            const firstInGroup = index === 0 || filtered[index - 1]?.group !== item.group;
            return (
              <div key={item.id}>
                {firstInGroup ? (
                  <p className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-2">
                    {item.group}
                  </p>
                ) : null}
                <button
                  id={`command-palette-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={cn(
                    "ui-focus-ring flex min-h-[var(--size-row-compact)] w-full items-center gap-2.5 rounded-control px-2.5 text-left text-[13px]",
                    index === active ? "bg-surface-2 text-app" : "text-muted hover:text-app",
                  )}
                >
                  <span className="grid h-5 w-5 place-items-center text-muted">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.shortcut ? (
                    <kbd className="font-mono text-[10px] text-muted-2">{item.shortcut}</kbd>
                  ) : null}
                </button>
              </div>
            );
          })
        )}
      </div>
      <footer className="flex shrink-0 items-center gap-4 border-t border-border-subtle px-4 py-2 font-mono text-[10px] text-muted-2">
        <span>↑↓ Navigate</span>
        <span>↵ Open</span>
      </footer>
    </DialogSurface>
  );
}
