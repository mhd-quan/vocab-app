import type { DictionaryLearningItemView } from "@/data/dictionaryLearning";
import type { DictionaryLearningStage } from "@/data/schema";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { normalizeAnswer } from "@/modules/grammarPractice";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAX_SESSION_ATTEMPTS = 24;

interface ReviewResult {
  itemId: number;
  headword: string;
  stage: DictionaryLearningStage;
  correct: boolean;
  promoted: "short_term" | "long_term" | null;
  reset: boolean;
}

interface ReviewAnswer {
  correct: boolean;
  answer: string | null;
  expected: string | null;
}

export function StudentPersonalVocabularySession() {
  const { studentId } = useParams({
    from: "/student/profile/$studentId/personal-vocabulary/session",
  });
  const studentIdNum = Number(studentId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<DictionaryLearningItemView[]>([]);
  const [queueSeeded, setQueueSeeded] = useState(false);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [lastResult, setLastResult] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState(false);

  const queueQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.practiceQueue(studentIdNum, 12),
    queryFn: () => api.dictionaryLearning.practiceQueue({ studentId: studentIdNum, limit: 12 }),
    enabled: Number.isFinite(studentIdNum) && studentIdNum > 0,
  });

  const itemsQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.items(studentIdNum),
    queryFn: () => api.dictionaryLearning.listItems({ studentId: studentIdNum }),
    enabled: Number.isFinite(studentIdNum) && studentIdNum > 0,
  });

  const sessionStart = useMutation({
    mutationFn: (input: { studentId: number }) =>
      api.progress.startSession({ studentId: input.studentId, mode: "review" }),
  });

  const openedFor = useRef<string | null>(null);
  const sessionId = sessionStart.data?.id ?? null;
  const current = queue[0] ?? null;
  const allItems = itemsQ.data ?? queueQ.data ?? queue;

  useEffect(() => {
    if (queueSeeded || !queueQ.data) return;
    setQueue(queueQ.data);
    setQueueSeeded(true);
  }, [queueQ.data, queueSeeded]);

  useEffect(() => {
    if (!queueSeeded || !Number.isFinite(studentIdNum) || studentIdNum <= 0) return;
    const key = `${studentIdNum}:personal-vocabulary`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    sessionStart.mutate({ studentId: studentIdNum });
  }, [queueSeeded, sessionStart.mutate, studentIdNum]);

  const exit = useCallback(() => {
    if (sessionId !== null) {
      void api.progress
        .endSession({
          sessionId,
          summary: summarizeResults(results),
        })
        .catch((error) => console.error("[PersonalVocabularySession] endSession failed", error))
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: ["dictionaryLearning"] });
          queryClient.invalidateQueries({ queryKey: ["progress"] });
        });
    }
    void navigate({
      to: "/student/profile/$studentId/personal-vocabulary",
      params: { studentId: String(studentIdNum) },
    });
  }, [navigate, queryClient, results, sessionId, studentIdNum]);

  const submitAnswer = useCallback(
    async (answer: ReviewAnswer) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        const response = await api.dictionaryLearning.recordReview({
          studentId: studentIdNum,
          itemId: current.id,
          stage: current.stage,
          correct: answer.correct,
          answer: answer.answer,
          expected: answer.expected,
          sessionId,
        });
        const result: ReviewResult = {
          itemId: current.id,
          headword: current.headword,
          stage: current.stage,
          correct: answer.correct,
          promoted: response.promoted,
          reset: response.reset,
        };
        const attemptCount = results.length + 1;
        setResults((prev) => [...prev, result]);
        setLastResult(result);
        setQueue((prev) => {
          const rest = prev.slice(1);
          if (shouldRequeue(response.item, attemptCount)) rest.push(response.item);
          return rest;
        });
        queryClient.setQueryData(
          queryKeys.dictionaryLearning.items(studentIdNum),
          (old: DictionaryLearningItemView[] | undefined) =>
            old?.map((item) => (item.id === response.item.id ? response.item : item)),
        );
        void queryClient.invalidateQueries({ queryKey: ["dictionaryLearning"] });
      } catch (error) {
        console.error("[PersonalVocabularySession] recordReview failed", error);
      } finally {
        setBusy(false);
      }
    },
    [busy, current, queryClient, results.length, sessionId, studentIdNum],
  );

  if (!Number.isFinite(studentIdNum) || studentIdNum <= 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-center">
        <p className="text-sm text-danger">Invalid student.</p>
      </div>
    );
  }

  if (!queueSeeded || queueQ.isLoading) {
    return <p className="px-6 py-10 text-sm text-muted">Loading personal review...</p>;
  }

  if (!current && results.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-10">
        <Button variant="ghost" className="self-start text-muted" onClick={exit}>
          Back
        </Button>
        <EmptyState
          title="No personal words due"
          body="Search dictionary entries from the student header to add new personal flashcards."
        />
      </div>
    );
  }

  if (!current) {
    return (
      <PersonalSessionShell
        studentId={studentIdNum}
        results={results}
        lastResult={lastResult}
        queueCount={0}
        onExit={exit}
      >
        <SessionDone results={results} onExit={exit} />
      </PersonalSessionShell>
    );
  }

  return (
    <PersonalSessionShell
      studentId={studentIdNum}
      results={results}
      lastResult={lastResult}
      queueCount={queue.length}
      onExit={exit}
    >
      <PracticeCard item={current} allItems={allItems} busy={busy} onSubmit={submitAnswer} />
    </PersonalSessionShell>
  );
}

function PersonalSessionShell({
  children,
  studentId,
  results,
  lastResult,
  queueCount,
  onExit,
}: {
  children: React.ReactNode;
  studentId: number;
  results: ReviewResult[];
  lastResult: ReviewResult | null;
  queueCount: number;
  onExit: () => void;
}) {
  const answered = results.length;
  const total = Math.max(answered + queueCount, 1);
  const correct = results.filter((result) => result.correct).length;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="focus" uppercase>
            Personal review
          </Badge>
          <span className="text-sm text-muted">Student #{studentId}</span>
        </div>
        <Button variant="ghost" size="md" onClick={onExit} className="text-muted">
          End session
        </Button>
      </header>

      <BentoCard className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase text-muted-2">Review progress</span>
            <span className="font-mono text-xs text-muted">
              {answered} / {total}
            </span>
          </div>
          <ProgressMeter
            value={answered}
            max={total}
            label="Personal review progress"
            tone="accent"
          />
        </div>
        <div className="rounded-2xl border border-success/30 bg-success/10 px-3 py-2">
          <span className="font-mono text-sm text-app">{correct}</span>
          <span className="ml-2 text-xs text-muted">correct</span>
        </div>
        <LastResultBadge result={lastResult} />
      </BentoCard>

      {children}
    </div>
  );
}

function PracticeCard({
  item,
  allItems,
  busy,
  onSubmit,
}: {
  item: DictionaryLearningItemView;
  allItems: DictionaryLearningItemView[];
  busy: boolean;
  onSubmit: (answer: ReviewAnswer) => void | Promise<void>;
}) {
  const stage = item.stage;
  if (stage === "flashcard") {
    return <FlashcardPractice item={item} busy={busy} onSubmit={onSubmit} />;
  }
  if (stage === "meaning_choice" || stage === "reverse_choice") {
    const mode = stage === "meaning_choice" ? "headword" : "definition";
    const options = makeChoiceOptions(item, allItems, mode);
    if (options.length >= 2) {
      return (
        <ChoicePractice item={item} mode={mode} options={options} busy={busy} onSubmit={onSubmit} />
      );
    }
  }
  return <TextPractice item={item} cloze={stage === "cloze"} busy={busy} onSubmit={onSubmit} />;
}

function FlashcardPractice({
  item,
  busy,
  onSubmit,
}: {
  item: DictionaryLearningItemView;
  busy: boolean;
  onSubmit: (answer: ReviewAnswer) => void | Promise<void>;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <BentoCard className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="focus" uppercase>
          Flashcard
        </Badge>
        <Badge tone="muted" uppercase>
          Reps {item.reps}
        </Badge>
      </div>
      <h1 className="mt-5 break-words text-5xl font-semibold leading-tight">{item.headword}</h1>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-muted">
        {item.ipa ? <span>{item.ipa}</span> : null}
        {item.cefrLevel ? <span>{item.cefrLevel}</span> : null}
      </div>
      {revealed ? (
        <div className="mt-6 rounded-bento border border-border-subtle bg-surface-0/65 p-4">
          <p className="text-sm leading-6 text-app">{item.definitionVi ?? item.definitionEn}</p>
          {item.definitionVi ? (
            <p className="mt-2 text-sm leading-6 text-muted">{item.definitionEn}</p>
          ) : null}
          {item.exampleText ? (
            <p className="mt-4 text-sm leading-6 text-muted">{item.exampleText}</p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {!revealed ? (
          <Button size="lg" onClick={() => setRevealed(true)}>
            Reveal
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => onSubmit({ correct: false, answer: "again", expected: item.headword })}
            >
              Again
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => onSubmit({ correct: false, answer: "hard", expected: item.headword })}
            >
              Hard
            </Button>
            <Button
              disabled={busy}
              onClick={() => onSubmit({ correct: true, answer: "good", expected: item.headword })}
            >
              Good
            </Button>
            <Button
              disabled={busy}
              onClick={() => onSubmit({ correct: true, answer: "easy", expected: item.headword })}
            >
              Easy
            </Button>
          </>
        )}
      </div>
    </BentoCard>
  );
}

function ChoicePractice({
  item,
  mode,
  options,
  busy,
  onSubmit,
}: {
  item: DictionaryLearningItemView;
  mode: "headword" | "definition";
  options: ChoiceOption[];
  busy: boolean;
  onSubmit: (answer: ReviewAnswer) => void | Promise<void>;
}) {
  const prompt = mode === "headword" ? definitionFor(item) : item.headword;
  const expected = mode === "headword" ? item.headword : definitionFor(item);
  return (
    <BentoCard className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="rare" uppercase>
          Choice
        </Badge>
        <Badge tone="muted" uppercase>
          Reps {item.reps}
        </Badge>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase text-muted-2">
        {mode === "headword" ? "Choose the word" : "Choose the meaning"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{prompt}</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {options.map((option, index) => (
          <button
            key={`${option.text}:${index}`}
            type="button"
            disabled={busy}
            onClick={() =>
              onSubmit({
                correct: option.correct,
                answer: option.text,
                expected,
              })
            }
            className="rounded-bento border border-border-subtle bg-surface-0/75 px-4 py-4 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {option.text}
          </button>
        ))}
      </div>
    </BentoCard>
  );
}

function TextPractice({
  item,
  cloze,
  busy,
  onSubmit,
}: {
  item: DictionaryLearningItemView;
  cloze: boolean;
  busy: boolean;
  onSubmit: (answer: ReviewAnswer) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const prompt = useMemo(() => (cloze ? clozePrompt(item) : definitionFor(item)), [cloze, item]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = value.trim();
    if (!answer) return;
    onSubmit({
      correct: normalizeAnswer(answer) === normalizeAnswer(item.headword),
      answer,
      expected: item.headword,
    });
  }

  return (
    <BentoCard className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={cloze ? "epic" : "mastery"} uppercase>
          {cloze ? "Cloze" : "Typing"}
        </Badge>
        <Badge tone="muted" uppercase>
          Reps {item.reps}
        </Badge>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase text-muted-2">
        {cloze ? "Complete the sentence" : "Write the word"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{prompt}</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          spellCheck={false}
          className="h-12 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface-1 px-4 text-base text-app outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <Button type="submit" size="lg" disabled={busy || value.trim().length === 0}>
          Check
        </Button>
      </form>
    </BentoCard>
  );
}

function SessionDone({ results, onExit }: { results: ReviewResult[]; onExit: () => void }) {
  const summary = summarizeResults(results);
  return (
    <BentoCard tone="success" className="p-6 text-center">
      <Badge tone="success" uppercase>
        Complete
      </Badge>
      <h1 className="mt-3 text-3xl font-semibold">Personal review finished</h1>
      <dl className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Attempts" value={summary.total} />
        <SummaryStat label="Correct" value={summary.correct} />
        <SummaryStat label="Promoted" value={summary.promoted} />
        <SummaryStat label="Reset" value={summary.reset} />
      </dl>
      <Button className="mt-6" onClick={onExit}>
        Back to personal vocabulary
      </Button>
    </BentoCard>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/65 px-3 py-3">
      <dt className="text-[10px] font-semibold uppercase text-muted-2">{label}</dt>
      <dd className="mt-1 font-mono text-2xl text-app">{value}</dd>
    </div>
  );
}

function LastResultBadge({ result }: { result: ReviewResult | null }) {
  if (!result) {
    return (
      <Badge tone="muted" uppercase className="h-9 justify-center px-3">
        Ready
      </Badge>
    );
  }
  if (result.reset) {
    return (
      <Badge tone="danger" uppercase className="h-9 justify-center px-3">
        Reset
      </Badge>
    );
  }
  if (result.promoted === "long_term") {
    return (
      <Badge tone="success" uppercase className="h-9 justify-center px-3">
        Long-term
      </Badge>
    );
  }
  if (result.promoted === "short_term") {
    return (
      <Badge tone="xp" uppercase className="h-9 justify-center px-3">
        Short-term
      </Badge>
    );
  }
  return (
    <Badge
      tone={result.correct ? "success" : "danger"}
      uppercase
      className="h-9 justify-center px-3"
    >
      {result.correct ? "Correct" : "Wrong"}
    </Badge>
  );
}

interface ChoiceOption {
  text: string;
  correct: boolean;
}

function makeChoiceOptions(
  item: DictionaryLearningItemView,
  allItems: DictionaryLearningItemView[],
  mode: "headword" | "definition",
): ChoiceOption[] {
  const target = mode === "headword" ? item.headword : definitionFor(item);
  const distractors = allItems
    .filter((candidate) => candidate.id !== item.id)
    .map((candidate) => (mode === "headword" ? candidate.headword : definitionFor(candidate)))
    .filter((text) => normalizeAnswer(text) !== normalizeAnswer(target));
  const unique = [...new Set(distractors)].slice(0, 3);
  return [
    { text: target, correct: true },
    ...unique.map((text) => ({ text, correct: false })),
  ].sort((a, b) => stableSortKey(`${item.id}:${a.text}`) - stableSortKey(`${item.id}:${b.text}`));
}

function definitionFor(item: DictionaryLearningItemView): string {
  return item.definitionVi ?? item.definitionEn;
}

function clozePrompt(item: DictionaryLearningItemView): string {
  const source = item.exampleText ?? item.definitionEn;
  const lower = source.toLocaleLowerCase();
  const target = item.headword.toLocaleLowerCase();
  const index = lower.indexOf(target);
  if (index < 0) return `${source} ___`;
  return `${source.slice(0, index)}___${source.slice(index + item.headword.length)}`;
}

function shouldRequeue(item: DictionaryLearningItemView, attemptCount: number): boolean {
  if (attemptCount >= MAX_SESSION_ATTEMPTS) return false;
  if (item.status === "long_term") return false;
  return item.status === "learning" || isDue(item.nextDueAt);
}

function isDue(value: Date | null): boolean {
  if (!value) return true;
  return new Date(value).getTime() <= Date.now();
}

function summarizeResults(results: ReviewResult[]) {
  return {
    total: results.length,
    correct: results.filter((result) => result.correct).length,
    promoted: results.filter((result) => result.promoted !== null).length,
    reset: results.filter((result) => result.reset).length,
  };
}

function stableSortKey(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
