import type {
  DictionaryLearningItemView,
  DictionarySearchHistoryItem,
} from "@/data/dictionaryLearning";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Badge, type BadgeTone } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
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

  const summary =
    summaryQ.data ??
    ({
      total: 0,
      due: 0,
      learning: 0,
      shortTerm: 0,
      longTerm: 0,
      averageScore: 0,
    } as const);
  const items = itemsQ.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-10">
      <Link
        to="/student/profile/$studentId"
        params={{ studentId: String(id) }}
        className="self-start text-xs font-medium text-muted hover:text-app"
      >
        Back to units
      </Link>

      <BentoCard tone={summary.due > 0 ? "focus" : "neutral"} className="p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="focus" uppercase>
                Personal vocabulary
              </Badge>
              {summary.due > 0 ? (
                <Badge tone="warning" uppercase>
                  {summary.due} due
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">Dictionary learning track</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Looked-up words stay here until they pass the full recall cycle and later retention
              checks.
            </p>
          </div>
          <Link
            to="/student/profile/$studentId/personal-vocabulary/session"
            params={{ studentId: String(id) }}
            className={cn(
              "inline-flex h-12 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg shadow-sm shadow-accent/20 transition hover:-translate-y-0.5 hover:bg-accent/90",
              summary.due === 0 && "pointer-events-none opacity-45",
            )}
          >
            Start review
          </Link>
        </div>
      </BentoCard>

      <section className="grid gap-3 md:grid-cols-5">
        <MetricCard label="Words" value={summary.total} tone="sky" />
        <MetricCard label="Due" value={summary.due} tone={summary.due > 0 ? "warning" : "lime"} />
        <MetricCard label="Learning" value={summary.learning} tone="focus" />
        <MetricCard label="Short-term" value={summary.shortTerm} tone="xp" />
        <MetricCard label="Long-term" value={summary.longTerm} tone="success" />
      </section>

      <BentoCard className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Mastery score</h2>
            <p className="mt-1 text-xs text-muted">Average score across personal vocabulary.</p>
          </div>
          <span className="font-mono text-2xl text-app">{summary.averageScore}%</span>
        </div>
        <ProgressMeter
          value={summary.averageScore}
          max={100}
          label="Personal vocabulary mastery"
          tone={summary.averageScore >= 80 ? "success" : "accent"}
          className="mt-4"
        />
      </BentoCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <BentoCard className="p-5">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Learning items</h2>
            <span className="font-mono text-xs text-muted-2">{items.length} words</span>
          </header>
          {itemsQ.isLoading ? (
            <p className="text-sm text-muted">Loading words...</p>
          ) : items.length === 0 ? (
            <EmptyState
              title="No personal words yet"
              body="Use Search word from the student header to add dictionary lookups here."
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => (
                <LearningItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </BentoCard>

        <BentoCard className="p-5">
          <h2 className="text-lg font-semibold">Recent searches</h2>
          <SearchHistoryList loading={historyQ.isLoading} items={historyQ.data ?? []} />
        </BentoCard>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sky" | "warning" | "lime" | "focus" | "xp" | "success";
}) {
  return (
    <BentoCard tone={tone} className="p-4" interactive>
      <p className="text-xs font-semibold uppercase text-muted-2">{label}</p>
      <p className="mt-2 font-mono text-3xl text-app">{value}</p>
    </BentoCard>
  );
}

function LearningItemRow({ item }: { item: DictionaryLearningItemView }) {
  return (
    <li className="rounded-bento border border-border-subtle bg-surface-0/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(item.status)} uppercase>
          {statusLabel(item.status)}
        </Badge>
        <Badge tone="muted" uppercase>
          {stageLabel(item.stage)}
        </Badge>
        {item.cefrLevel ? (
          <Badge tone="xp" uppercase>
            {item.cefrLevel}
          </Badge>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-xl font-semibold">{item.headword}</h3>
        {/* Mastery is derived from FSRS stability — 21-day stability ≈ 100%. */}
        <span className="font-mono text-sm text-muted">{masteryPercent(item.stability)}%</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
        {item.definitionVi ?? item.definitionEn}
      </p>
      <ProgressMeter
        value={masteryPercent(item.stability)}
        max={100}
        label={`${item.headword} mastery`}
        tone={masteryPercent(item.stability) >= 80 ? "success" : "accent"}
        className="mt-3"
      />
    </li>
  );
}

function SearchHistoryList({
  loading,
  items,
}: {
  loading: boolean;
  items: DictionarySearchHistoryItem[];
}) {
  if (loading) return <p className="mt-4 text-sm text-muted">Loading searches...</p>;
  if (items.length === 0) {
    return <p className="mt-4 text-sm leading-6 text-muted">No searches recorded yet.</p>;
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-border-subtle bg-surface-0/60 px-3 py-2"
        >
          <p className="truncate text-sm font-medium">{item.headword ?? item.query}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-2">{formatDate(item.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Mastery percent surfaced to students — derived from FSRS stability.
 * 0 days → 0%; ≥ 21 days (the long-term threshold) → 100%. Linear in
 * between. Read-only convenience for the LearningItemRow + dashboard
 * gauges; never feeds the scheduler.
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
  if (status === "short_term") return "xp";
  if (status === "long_term") return "success";
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
