import type { ImportFileResult } from "@/application/import";
import type { ImportRun } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Badge, type BadgeTone } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ImportModal } from "@/ui/components/ImportModal";
import { PageHeader } from "@/ui/components/PageHeader";
import { SplitView } from "@/ui/components/SplitView";
import {
  TutorSegmentedControl,
  TutorTextAreaField,
  TutorTextField,
} from "@/ui/tutor/components/Material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function TutorImports() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);
  const runsQ = useQuery({
    queryKey: queryKeys.imports.listRuns(),
    queryFn: () => api.imports.listRuns(),
    refetchInterval: 5_000,
  });
  const runs = runsQ.data ?? [];
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function refetchHistory() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.imports.listRuns() });
  }

  async function openNativeDialog() {
    setDialogBusy(true);
    setDialogMessage(null);
    try {
      const result = await api.imports.openImportDialog();
      if (!result.canceled) {
        await refetchHistory();
        setDialogMessage(formatDialogSummary(result.results.length));
      }
    } catch (err) {
      setDialogMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setDialogBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Imports"
        subtitle="Draft curriculum YAML and audit exactly what each import changed."
        actions={
          <>
            <Button variant="secondary" onClick={openNativeDialog} disabled={dialogBusy}>
              {dialogBusy ? "Importing..." : "Browse files..."}
            </Button>
            <Button onClick={() => setModalOpen(true)}>Import YAML</Button>
          </>
        }
      />
      <SplitView
        initialSize={376}
        minSize={320}
        maxSize={480}
        contentMinSize={400}
        label="Resize import history"
        storageKey="vocab.imports.history-pane"
        className="min-h-0 flex-1 border-t border-border-subtle bg-surface-0"
      >
        <div className="min-w-0 overflow-y-auto bg-surface-1 px-4 py-4">
          <header className="mb-3 px-1">
            <h2 className="text-sm font-semibold">History</h2>
            <p className="mt-1 text-xs text-muted">{runs.length} recorded runs</p>
          </header>
          {dialogMessage ? (
            <p
              role="status"
              className="mb-3 border-l-2 border-accent bg-accent/5 px-3 py-2 text-xs text-muted"
            >
              {dialogMessage}
            </p>
          ) : null}
          {runsQ.isLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : runs.length === 0 ? (
            <EmptyState
              title="No imports yet"
              body="Imported files and validation results will appear here."
            />
          ) : (
            <ul className="grouped-list divide-y divide-border-subtle">
              {runs.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  expanded={expandedId === run.id}
                  onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0 overflow-y-auto bg-surface-0 px-6 py-5">
          <AuthoringPanel onImported={refetchHistory} />
        </div>
      </SplitView>
      <ImportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onImported={refetchHistory}
      />
    </div>
  );
}

type AuthoringKind = "vocabulary" | "grammar";

function AuthoringPanel({ onImported }: { onImported: () => Promise<void> }) {
  const [kind, setKind] = useState<AuthoringKind>("vocabulary");
  const [fileName, setFileName] = useState("unit-draft-vocab.yaml");
  const [content, setContent] = useState(VOCAB_AUTHORING_TEMPLATE);

  const importDraft = useMutation({
    mutationFn: () => api.imports.uploadFile({ fileName, content }),
    onSuccess: async () => {
      await onImported();
    },
  });

  const switchKind = (next: AuthoringKind) => {
    setKind(next);
    setFileName(next === "vocabulary" ? "unit-draft-vocab.yaml" : "unit-draft-grammar.yaml");
    setContent(next === "vocabulary" ? VOCAB_AUTHORING_TEMPLATE : GRAMMAR_AUTHORING_TEMPLATE);
    importDraft.reset();
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-app">YAML authoring</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Validate a focused lesson draft before it enters the local library.
          </p>
        </div>
        <TutorSegmentedControl
          value={kind}
          options={[
            { value: "vocabulary", label: "Vocabulary" },
            { value: "grammar", label: "Grammar" },
          ]}
          onChange={(value) => switchKind(value as AuthoringKind)}
          className="w-full shrink-0 sm:w-[18rem]"
        />
      </header>

      <TutorTextField
        label="File name"
        value={fileName}
        onChange={(event) => setFileName(event.target.value)}
        className="font-mono"
      />

      <TutorTextAreaField
        label="YAML draft"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        spellCheck={false}
        className="min-h-[22rem] font-mono text-xs leading-6"
      />

      <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="status" aria-live="polite" className="text-xs text-muted">
          {importDraft.data
            ? formatAuthoringResult(importDraft.data)
            : "Imports are saved into the local content library."}
        </div>
        <Button onClick={() => importDraft.mutate()} disabled={importDraft.isPending}>
          {importDraft.isPending ? "Importing..." : "Validate & import"}
        </Button>
      </div>
      {importDraft.isError ? (
        <p role="alert" className="text-xs text-danger">
          {importDraft.error instanceof Error ? importDraft.error.message : "Import failed."}
        </p>
      ) : null}
      {importDraft.data?.errors.length ? (
        <pre className="max-h-40 overflow-auto rounded-object border border-danger/30 bg-danger/5 p-3 whitespace-pre-wrap font-mono text-[10px] text-danger">
          {importDraft.data.errors.map((err) => err.message).join("\n")}
        </pre>
      ) : null}
    </section>
  );
}

const STATUS_TONE: Record<ImportRun["status"], BadgeTone> = {
  pending: "muted",
  success: "success",
  partial: "warning",
  failed: "danger",
};

function RunRow({
  run,
  expanded,
  onToggle,
}: {
  run: ImportRun;
  expanded: boolean;
  onToggle: () => void;
}) {
  const stats = run.stats ?? {};
  const inserted = numStat(stats.inserted);
  const updated = numStat(stats.updated);
  const skipped = numStat(stats.skipped);
  const failed = numStat(stats.failed);
  const duration =
    run.finishedAt && run.startedAt
      ? Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime())
      : null;

  return (
    <li className="overflow-hidden bg-surface-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="ui-focus-ring grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-none px-3 py-3 text-left outline-offset-[-2px] transition-colors hover:bg-surface-2"
      >
        <Badge tone={STATUS_TONE[run.status]}>{run.status}</Badge>
        <p className="min-w-0 truncate text-sm font-medium text-app">
          {shortenPath(run.sourcePath)}
        </p>
        <span
          aria-hidden
          className={cn(
            "row-span-2 text-muted-2 transition-transform",
            expanded ? "rotate-90" : "rotate-0",
          )}
        >
          ▸
        </span>
        <div className="col-start-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-2">
          <span className="min-w-0 truncate tabular-nums">
            {formatTimestamp(run.startedAt)}
            {duration !== null ? ` · ${duration}ms` : null}
          </span>
          <span className="flex shrink-0 gap-x-3">
            <span>
              <span className={inserted > 0 ? "tabular-nums text-success" : "tabular-nums"}>
                {inserted}
              </span>{" "}
              new
            </span>
            <span>
              <span className={updated > 0 ? "tabular-nums text-warning" : "tabular-nums"}>
                {updated}
              </span>{" "}
              updated
            </span>
            {skipped > 0 ? <span className="tabular-nums">{skipped} skipped</span> : null}
            <span className={failed > 0 ? "text-danger" : undefined}>
              <span className="tabular-nums">{failed}</span> failed
            </span>
          </span>
        </div>
      </button>
      {expanded ? <RunItems runId={run.id} errorLog={run.errorLog} /> : null}
    </li>
  );
}

function RunItems({ runId, errorLog }: { runId: number; errorLog: string | null }) {
  const itemsQ = useQuery({
    queryKey: queryKeys.imports.listItems(runId),
    queryFn: () => api.imports.listItems({ runId }),
  });
  const items = itemsQ.data ?? [];

  return (
    <div className="border-t border-border-subtle bg-surface-0 px-3 py-3">
      {itemsQ.isLoading ? (
        <p className="text-xs text-muted">Loading items…</p>
      ) : itemsQ.isError ? (
        <p role="alert" className="text-xs text-warning">
          Import items are unavailable.
        </p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-2">No item rows recorded for this run.</p>
      ) : (
        <ul className="grouped-list divide-y divide-border-subtle text-xs">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[auto_minmax(7rem,0.8fr)_1fr] items-baseline gap-2 px-3 py-2"
            >
              <ItemActionBadge action={item.action} />
              <span className="truncate font-mono text-[11px] text-app">{item.targetTable}</span>
              <span className={item.error ? "truncate text-danger" : "truncate text-muted"}>
                {item.error ?? item.sourceId ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {errorLog ? (
        <details className="mt-3 rounded-object border border-danger/40 bg-danger/5 p-3">
          <summary className="cursor-pointer text-xs text-danger">Error log</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-danger">
            {errorLog}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

const ITEM_ACTION_TONE: Record<string, BadgeTone> = {
  inserted: "success",
  updated: "warning",
  skipped: "muted",
  failed: "danger",
  deleted: "danger",
};

function ItemActionBadge({ action }: { action: string }) {
  return <Badge tone={ITEM_ACTION_TONE[action] ?? "muted"}>{action}</Badge>;
}

function numStat(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function shortenPath(absolute: string): string {
  const idx = absolute.lastIndexOf("/content/");
  return idx >= 0 ? absolute.slice(idx + 1) : absolute;
}

function formatTimestamp(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatDialogSummary(count: number): string {
  if (count === 0) return "No files imported.";
  return `${count} file${count === 1 ? "" : "s"} imported.`;
}

function formatAuthoringResult(result: ImportFileResult): string {
  return `${result.status}: +${result.stats.inserted} ~${result.stats.updated} =${result.stats.skipped} !${result.stats.failed}`;
}

const VOCAB_AUTHORING_TEMPLATE = `book: destination-b2
book_title: Destination B2

unit:
  ordinal: 1
  code: U01
  title: Unit title
  summary_md: One-sentence topic overview for the learner.

lesson:
  ordinal: 1
  kind: vocabulary
  title: Vocabulary
  slug: vocabulary

entries:
  - id: sample-word-noun
    headword: sample word
    lemma: sample word
    pos: noun
    cefr: B2
    tags: [vocabulary]
    senses:
      - definition_en: a short definition
        definition_vi: nghia ngan gon
        register: neutral
    examples:
      - text: This is a {{sample word}} in context.
        translation: Day la mot vi du trong ngu canh.
`;

const GRAMMAR_AUTHORING_TEMPLATE = `book: destination-b2
book_title: Destination B2

unit:
  ordinal: 1
  code: U01
  title: Unit title
  summary_md: Grammar focus and why it matters.

lesson:
  ordinal: 2
  kind: grammar
  title: Grammar focus
  slug: grammar-focus

topics:
  - id: grammar-focus-basic
    slug: grammar-focus-basic
    title: Grammar focus
    summary_md: Short learner-facing overview.
    explanation_md: |
      Explain the rule in concise teacher language.
    difficulty: 2
    tags: [grammar, practice]
    patterns:
      - label: core form
        form: subject + verb + object
        use: Use this form for the target meaning.
    activities:
      - kind: fill_blank
        sentence: She {{studies}} English every evening.
        hint: Think about subject-verb agreement.
      - kind: choice
        question: He usually ___ TV after dinner.
        options:
          - text: watch
          - text: watches
            correct: true
          - text: is watching
      - kind: rewrite
        prompt: I watch TV after dinner.
        instruction: Rewrite with he.
        answer: He watches TV after dinner.
`;
