import { api } from "@/lib/api";
import { Badge } from "@/ui/components/Badge";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

type StudentHistoryImportResult = Awaited<ReturnType<typeof api.evidence.importStudentData>>;
type ImportedStudentHistoryResult = StudentHistoryImportResult & {
  imported: true;
  studentId: number;
  stats: NonNullable<StudentHistoryImportResult["stats"]>;
};

interface StudentHistoryImportButtonProps {
  buttonLabel?: string;
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  className?: string;
  onImported?: (result: ImportedStudentHistoryResult) => void;
}

export function StudentHistoryImportButton({
  buttonLabel = "Import data",
  buttonVariant = "secondary",
  buttonSize = "md",
  className,
  onImported,
}: StudentHistoryImportButtonProps) {
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const passphraseId = useId();
  const queryClient = useQueryClient();

  const importHistory = useMutation({
    mutationFn: () =>
      api.evidence.importStudentData({ passphrase: passphrase.trim() || undefined }),
    onSuccess: async (result) => {
      if (!result.imported || !result.studentId || !result.stats) return;
      await invalidateStudentHistory(queryClient);
      onImported?.({
        ...result,
        imported: true,
        studentId: result.studentId,
        stats: result.stats,
      });
    },
  });

  function close() {
    if (importHistory.isPending) return;
    setOpen(false);
  }

  function submit() {
    importHistory.reset();
    importHistory.mutate();
  }

  const stats = importHistory.data?.stats ?? null;

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        className={className}
        onClick={() => {
          importHistory.reset();
          setOpen(true);
        }}
      >
        {buttonLabel}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Import learner data"
        description="Import a portable Vocab bundle; the file identifies which learner is created or updated."
        initialFocusId={passphraseId}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={importHistory.isPending}
            >
              Close
            </Button>
            <Button type="button" onClick={submit} disabled={importHistory.isPending}>
              {importHistory.isPending ? "Importing..." : "Choose JSON and import"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={passphraseId}>
            <span className="font-semibold text-muted-2">Passphrase</span>
            <input
              id={passphraseId}
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.currentTarget.value)}
              placeholder="Only needed for encrypted exports"
              className="ui-focus-ring h-10 rounded-control border border-border-subtle bg-paper px-3 text-sm text-app focus:border-accent"
            />
          </label>

          {importHistory.data?.canceled ? (
            <p
              role="status"
              className="border-l-2 border-border-strong bg-surface-2 px-3 py-2 text-xs text-muted"
            >
              No file selected.
            </p>
          ) : null}

          {stats ? (
            <div className="overflow-hidden border-y border-border-subtle bg-success/5">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm font-semibold text-success">Learner data imported.</p>
                <Badge tone="success">#{stats.studentId}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-px border-t border-border-subtle bg-border-subtle text-xs sm:grid-cols-3">
                <ImportStat
                  label="Sessions"
                  value={stats.sessionsInserted + stats.sessionsUpdated}
                />
                <ImportStat label="Answers" value={stats.learningEventsInserted} />
                <ImportStat label="Evidence" value={stats.evidenceEventsInserted} />
                <ImportStat label="Progress" value={stats.progressUpserted} />
                <ImportStat label="Achievements" value={stats.achievementsUpserted} />
                <ImportStat label="Dictionary" value={stats.dictionaryItemsUpserted} />
              </dl>
            </div>
          ) : null}

          {importHistory.isError ? (
            <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-xs text-danger">
              {importHistory.error instanceof Error
                ? importHistory.error.message
                : "Could not import learner data."}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function ImportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper px-3 py-2">
      <dt className="text-[10px] font-semibold text-muted-2">{label}</dt>
      <dd className="tabular-figure mt-1 text-base text-app">{value}</dd>
    </div>
  );
}

async function invalidateStudentHistory(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["students"] }),
    queryClient.invalidateQueries({ queryKey: ["progress"] }),
    queryClient.invalidateQueries({ queryKey: ["evidence"] }),
    queryClient.invalidateQueries({ queryKey: ["dictionaryLearning"] }),
    queryClient.invalidateQueries({ queryKey: ["rewards"] }),
  ]);
}
