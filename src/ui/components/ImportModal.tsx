import type { ImportFileResult } from "@/application/import";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ImportsIcon } from "@/ui/shell/icons";
import { type DragEvent, useRef, useState } from "react";
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
      description="Add a vocabulary YAML file to the local content library."
      size="lg"
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
            "flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
            dragging
              ? "border-accent bg-accent/10"
              : "border-border-strong bg-surface-0 hover:border-accent/70",
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-1 text-muted">
            <ImportsIcon />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Drop a .yaml or .yml file here</p>
            <p className="text-xs text-muted">Maximum file size: 5MB</p>
          </div>
          <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Importing..." : "Choose file"}
          </Button>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
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
    <section className="rounded-lg border border-border-subtle bg-surface-0 p-4">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{shortenPath(result.filePath)}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {result.status}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 font-mono text-xs">
          <ResultStat label="+" value={stats.inserted} />
          <ResultStat label="~" value={stats.updated} />
          <ResultStat label="=" value={stats.skipped} />
          <ResultStat label="!" value={stats.failed} />
        </div>
      </header>
      {result.errors.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-danger">
          {result.errors.map((err) => (
            <li key={`${err.sourceId ?? "file"}-${err.message}`}>
              {err.sourceId ? `[${err.sourceId}] ` : null}
              {err.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex min-w-12 items-center justify-center rounded-md border border-border-subtle bg-surface-1 px-2 py-1">
      <span className="mr-1 text-muted-2">{label}</span>
      <span>{value}</span>
    </span>
  );
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
