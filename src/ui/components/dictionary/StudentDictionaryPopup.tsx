import { AppGlyph } from "@/ui/components/AppGlyph";
import { DialogSurface } from "@/ui/components/DialogSurface";
import { useId } from "react";
import { DictionaryLookupPanel } from "./DictionaryLookupPanel";

export function StudentDictionaryPopup({
  open,
  onClose,
  studentId = null,
}: {
  open: boolean;
  onClose: () => void;
  studentId?: number | null;
}) {
  const titleId = useId();
  return (
    <DialogSurface
      open={open}
      onClose={onClose}
      closeLabel="Close dictionary"
      ariaLabelledBy={titleId}
      initialFocusSelector="[data-dictionary-search]"
      viewportClassName="items-center py-8"
      className="flex h-[min(40rem,calc(100vh-5rem))] min-h-0 w-full max-w-[58rem] flex-col"
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
        <AppGlyph name="dictionary" className="h-[18px] w-[18px] text-accent" />
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          Dictionary
        </h2>
        <span className="hidden text-xs text-muted md:inline">Search, listen, and save words</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dictionary"
          className="ui-focus-ring grid h-7 w-7 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-app"
        >
          <AppGlyph name="x" className="h-4 w-4" />
        </button>
      </header>
      <DictionaryLookupPanel density="popup" studentId={studentId} className="flex-1" />
    </DialogSurface>
  );
}
