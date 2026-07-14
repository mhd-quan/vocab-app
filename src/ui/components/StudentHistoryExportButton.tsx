import { api } from "@/lib/api";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";

interface StudentHistoryExportButtonProps {
  studentId: number;
  buttonLabel?: string;
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  className?: string;
}

export function StudentHistoryExportButton({
  studentId,
  buttonLabel = "Export data",
  buttonVariant = "secondary",
  buttonSize = "md",
  className,
}: StudentHistoryExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const passphraseId = useId();
  const exportHistory = useMutation({
    mutationFn: () =>
      api.evidence.exportStudentReport({
        studentId,
        includeSnapshots,
        passphrase: passphrase.trim() || undefined,
      }),
  });

  const trimmedPassphrase = passphrase.trim();
  const passphraseTooShort = trimmedPassphrase.length > 0 && trimmedPassphrase.length < 8;
  const exported = exportHistory.data;

  function close() {
    if (exportHistory.isPending) return;
    setOpen(false);
    setPassphrase("");
  }

  function submit() {
    if (passphraseTooShort) return;
    exportHistory.reset();
    exportHistory.mutate();
  }

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        className={className}
        onClick={() => {
          exportHistory.reset();
          setOpen(true);
        }}
      >
        {buttonLabel}
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Export learner data"
        description="Save one portable bundle containing this learner’s complete Vocab history."
        initialFocusId={passphraseId}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={exportHistory.isPending}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={exportHistory.isPending || passphraseTooShort}
            >
              {exportHistory.isPending ? "Exporting…" : "Choose location and export"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs leading-5 text-muted">
            Includes the profile, assignments, every practice session, answer and evidence logs,
            learning progress, achievements, and dictionary activity. The resulting JSON bundle can
            be imported into another Vocab workspace.
          </p>

          <label className="flex min-h-9 items-center gap-2 text-xs text-app">
            <input
              type="checkbox"
              checked={includeSnapshots}
              onChange={(event) => setIncludeSnapshots(event.currentTarget.checked)}
              className="h-4 w-4 accent-[rgb(var(--color-accent))]"
            />
            Include camera snapshots
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={passphraseId}>
            <span className="font-semibold text-muted-2">Encryption passphrase</span>
            <input
              id={passphraseId}
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.currentTarget.value)}
              placeholder="Optional; at least 8 characters"
              aria-invalid={passphraseTooShort || undefined}
              className="ui-focus-ring h-10 rounded-control border border-border-subtle bg-paper px-3 text-sm text-app focus:border-accent"
            />
            {passphraseTooShort ? (
              <span className="text-danger">Use at least 8 characters or leave this blank.</span>
            ) : (
              <span className="text-muted-2">Leave blank for an unencrypted export.</span>
            )}
          </label>

          {exported?.canceled ? (
            <p
              role="status"
              className="border-l-2 border-border-strong px-3 py-2 text-xs text-muted"
            >
              No export location selected.
            </p>
          ) : null}

          {exported && !exported.canceled ? (
            <p
              role="status"
              className="border-l-2 border-success bg-success/5 px-3 py-2 text-xs text-success"
            >
              Exported {exported.sessionCount} sessions, {exported.learningEventCount} learning
              logs, and {exported.evidenceEventCount} evidence logs
              {exported.encrypted ? " in an encrypted bundle" : ""}.
            </p>
          ) : null}

          {exportHistory.isError ? (
            <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-xs text-danger">
              {exportHistory.error instanceof Error
                ? exportHistory.error.message
                : "Could not export learner data."}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
