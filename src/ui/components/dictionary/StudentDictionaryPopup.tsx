import { Button } from "@/ui/components/Button";
import { useEffect } from "react";
import { createPortal } from "react-dom";
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
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/80 px-5 py-8 backdrop-blur-sm">
      <div className="flex w-full max-w-5xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-2">Dictionary</p>
            <h2 className="text-2xl font-semibold">Search word</h2>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <DictionaryLookupPanel density="popup" studentId={studentId} />
      </div>
    </div>,
    document.body,
  );
}
