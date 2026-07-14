import type { ImportFileResult } from "@/application/import";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ImportsIcon } from "@/ui/shell/icons";
import { type DragEvent, useId, useRef, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseFileButtonId = useId();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportFileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      validateFile(file);
      const content = await file.text();
      const next = await api.imports.uploadFile({ fileName: file.name, content });
      setResult(next);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void importFile(file);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import YAML"
      description="Add a vocabulary or grammar YAML file to the local content library."
      size="lg"
      initialFocusId={chooseFileButtonId}
      footer={
        <>
          {result ? (
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setError(null);
                inputRef.current?.click();
              }}
            >
              Import another
            </Button>
          ) : null}
          <Button onClick={onClose}>{result ? "Done" : "Close"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept=".yaml,.yml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file);
          }}
        />
        <div
          role="group"
          aria-label="YAML file drop area"
          aria-busy={busy}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-36 flex-col items-center justify-center gap-3 rounded-object border border-dashed px-5 py-6 text-center transition-colors duration-fast",
            dragging
              ? "border-accent bg-accent/10"
              : "border-border-strong bg-ground/70 hover:border-accent/70",
          )}
        >
          <span className="grid h-7 w-7 place-items-center text-muted [&_svg]:h-6 [&_svg]:w-6">
            <ImportsIcon />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Drop a .yaml or .yml file here</p>
            <p className="text-xs text-muted">Maximum file size: 5MB</p>
          </div>
          <Button
            id={chooseFileButtonId}
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Importing..." : "Choose file"}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-ui text-danger">
            {error}
          </p>
        ) : null}
        {result ? <ImportResult result={result} /> : null}
      </div>
    </Modal>
  );
}

function ImportResult({ result }: { result: ImportFileResult }) {
  const stats = result.stats;
  return (
    <section
      aria-label="Import result"
      aria-live="polite"
      className="object-surface overflow-hidden border border-border-subtle"
    >
      <header className="min-w-0 px-4 py-3">
        <p className="truncate text-ui font-semibold">{shortenPath(result.filePath)}</p>
        <p className="mt-0.5 text-caption text-muted">{formatStatus(result.status)}</p>
      </header>
      <dl className="grid grid-cols-4 divide-x divide-border-subtle border-t border-border-subtle">
        <ResultStat label="Inserted" value={stats.inserted} />
        <ResultStat label="Updated" value={stats.updated} />
        <ResultStat label="Skipped" value={stats.skipped} />
        <ResultStat label="Failed" value={stats.failed} danger={stats.failed > 0} />
      </dl>
      {result.errors.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-border-subtle px-4 py-3 text-xs text-danger">
          {result.errors.map((err) => (
            <li key={`${err.sourceId ?? "file"}-${err.message}`}>
              {err.sourceId ? <span className="font-mono">[{err.sourceId}] </span> : null}
              {err.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ResultStat({
  label,
  value,
  danger = false,
}: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="px-3 py-2">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className={cn("tabular-figure mt-0.5 text-ui font-semibold", danger && "text-danger")}>
        {value}
      </dd>
    </div>
  );
}

function formatStatus(status: string): string {
  const normalized = status.trim().replaceAll("_", " ");
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : "Complete";
}

function validateFile(file: File) {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".yaml") && !lowerName.endsWith(".yml")) {
    throw new Error("Only .yaml and .yml files can be imported.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("YAML file must be 5MB or smaller.");
  }
}

function shortenPath(filePath: string): string {
  const idx = filePath.lastIndexOf("/content/");
  return idx >= 0 ? filePath.slice(idx + 1) : filePath;
}
