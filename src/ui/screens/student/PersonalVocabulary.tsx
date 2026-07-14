import type {
  DictionaryLearningItemView,
  DictionarySearchHistoryItem,
} from "@/data/dictionaryLearning";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Badge, type BadgeTone } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

export function StudentPersonalVocabulary() {
  const { studentId } = useParams({ from: "/student/profile/$studentId/personal-vocabulary" });
  const id = Number(studentId);

  const summaryQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.summary(id),
    queryFn: () => api.dictionaryLearning.summary({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const itemsQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.items(id),
    queryFn: () => api.dictionaryLearning.listItems({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const historyQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.recentSearches(id, 10),
    queryFn: () => api.dictionaryLearning.recentSearches({ studentId: id, limit: 10 }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const summary = summaryQ.data;
  const items = itemsQ.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
      <header>
        <h1 className="text-title font-semibold">Personal vocabulary</h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted">
          Words saved from dictionary searches, organised by the next recall step.
        </p>
      </header>

      <section className="grouped-list" aria-labelledby="vocabulary-summary-title">
        {summaryQ.isLoading ? (
          <p id="vocabulary-summary-title" role="status" className="px-5 py-6 text-sm text-muted">
            Loading vocabulary progress…
          </p>
        ) : summaryQ.isError || !summary ? (
          <div role="alert" className="px-5 py-5">
            <h2 id="vocabulary-summary-title" className="text-base font-semibold">
              Vocabulary progress is unavailable
            </h2>
            <p className="mt-1 text-sm text-muted">Your saved words are unchanged.</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => summaryQ.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="vocabulary-summary-title" className="text-base font-semibold">
                  {summary.due > 0
                    ? `${summary.due} ${summary.due === 1 ? "word is" : "words are"} ready to review`
                    : "You are caught up"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Mastery is built across meaning, recall, typing, and later retention checks.
                </p>
              </div>
              {summary.due > 0 ? (
                <Link
                  to="/student/profile/$studentId/personal-vocabulary/session"
                  params={{ studentId: String(id) }}
                  className="ui-focus-ring inline-flex h-[var(--size-control-lg)] shrink-0 items-center justify-center gap-1.5 rounded-control bg-accent px-4 text-[13px] font-medium text-accent-fg transition-colors duration-fast hover:bg-accent/90 active:bg-accent/80"
                >
                  Review {summary.due} {summary.due === 1 ? "word" : "words"}
                  <AppGlyph name="arrowRight" size="sm" />
                </Link>
              ) : (
                <span
                  className="inline-flex h-[var(--size-control-lg)] shrink-0 items-center justify-center gap-1.5 rounded-control bg-surface-2 px-4 text-[13px] font-medium text-muted"
                  aria-label="No words are due for review"
                >
                  <AppGlyph name="check" size="sm" />
                  All caught up
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-px border-t border-border-subtle bg-border-subtle sm:grid-cols-3 lg:grid-cols-6">
              <SummaryMetric label="Words" value={summary.total} />
              <SummaryMetric
                label="Due"
                value={summary.due}
                emphasis={summary.due > 0 ? "warning" : undefined}
              />
              <SummaryMetric label="Learning" value={summary.learning} />
              <SummaryMetric label="Short-term" value={summary.shortTerm} />
              <SummaryMetric label="Long-term" value={summary.longTerm} emphasis="success" />
              <SummaryMetric label="Mastery" value={`${summary.averageScore}%`} />
            </dl>
          </>
        )}
      </section>

      <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="grouped-list" aria-labelledby="learning-items-title">
          <header className="flex min-h-12 items-center justify-between gap-4 border-b border-border-subtle px-4">
            <div>
              <h2 id="learning-items-title" className="font-semibold">
                Learning items
              </h2>
            </div>
            <span className="tabular-figure text-xs text-muted">
              {itemsQ.isLoading || itemsQ.isError
                ? itemsQ.isLoading
                  ? "Loading…"
                  : "Unavailable"
                : `${items.length} ${items.length === 1 ? "word" : "words"}`}
            </span>
          </header>
          {itemsQ.isLoading ? (
            <p className="px-4 py-8 text-sm text-muted">Loading words...</p>
          ) : itemsQ.isError ? (
            <p role="alert" className="px-4 py-8 text-sm text-warning">
              Saved words are temporarily unavailable.
            </p>
          ) : items.length === 0 ? (
            <EmptyState
              title="No personal words yet"
              body="Use Search word in the toolbar to save a dictionary lookup here."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((item) => (
                <LearningItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>

        <section className="grouped-list self-start" aria-labelledby="recent-searches-title">
          <header className="flex min-h-12 items-center border-b border-border-subtle px-4">
            <h2 id="recent-searches-title" className="font-semibold">
              Recent searches
            </h2>
          </header>
          <SearchHistoryList
            loading={historyQ.isLoading}
            unavailable={historyQ.isError}
            items={historyQ.data ?? []}
          />
        </section>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number | string;
  emphasis?: "success" | "warning";
}) {
  return (
    <div className="bg-paper px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`tabular-figure mt-0.5 text-lg font-semibold ${
          emphasis === "success"
            ? "text-success"
            : emphasis === "warning"
              ? "text-warning"
              : "text-app"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function LearningItemRow({ item }: { item: DictionaryLearningItemView }) {
  const mastery = masteryPercent(item.stability);

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="ui-lexical truncate text-lg font-semibold">{item.headword}</h3>
            {item.cefrLevel ? <span className="text-xs text-muted">{item.cefrLevel}</span> : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted">
            {item.definitionVi ?? item.definitionEn}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:w-[15rem] sm:justify-end">
          <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
          <span className="text-xs text-muted">{stageLabel(item.stage)}</span>
          <span className="tabular-figure ml-auto w-9 text-right text-xs text-muted">
            {mastery}%
          </span>
        </div>
      </div>
      <ProgressMeter
        value={mastery}
        max={100}
        label={`${item.headword} mastery`}
        tone={mastery >= 80 ? "success" : "accent"}
        className="mt-3"
      />
    </li>
  );
}

function SearchHistoryList({
  loading,
  unavailable,
  items,
}: {
  loading: boolean;
  unavailable: boolean;
  items: DictionarySearchHistoryItem[];
}) {
  if (loading) return <p className="px-4 py-6 text-sm text-muted">Loading searches...</p>;
  if (unavailable) {
    return (
      <p role="alert" className="px-4 py-6 text-sm text-warning">
        Search history is unavailable.
      </p>
    );
  }
  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm leading-5 text-muted">No searches recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((item) => (
        <li key={item.id} className="px-4 py-3">
          <p className="truncate text-sm font-medium">{item.headword ?? item.query}</p>
          <p className="tabular-figure mt-0.5 text-xs text-muted-2">{formatDate(item.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Mastery percent surfaced to students — derived from FSRS stability.
 * 0 days → 0%; ≥ 21 days (the long-term threshold) → 100%.
 */
function masteryPercent(stability: number): number {
  if (!Number.isFinite(stability) || stability <= 0) return 0;
  const ratio = stability / 21;
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

function statusLabel(status: DictionaryLearningItemView["status"]): string {
  if (status === "short_term") return "Short-term";
  if (status === "long_term") return "Long-term";
  return "Learning";
}

function statusTone(status: DictionaryLearningItemView["status"]): BadgeTone {
  if (status === "long_term") return "success";
  if (status === "short_term") return "muted";
  return "focus";
}

function stageLabel(stage: DictionaryLearningItemView["stage"]): string {
  switch (stage) {
    case "meaning_choice":
      return "Meaning";
    case "reverse_choice":
      return "Reverse";
    case "cloze":
      return "Cloze";
    case "typing":
      return "Typing";
    case "retention":
      return "Retention";
    case "flashcard":
      return "Flashcard";
  }
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
