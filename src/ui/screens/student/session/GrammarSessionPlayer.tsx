import { cn } from "@/lib/cn";
import {
  type GrammarAnswer,
  type GrammarExercise,
  type GrammarPracticeResult,
  gradeGrammarExercise,
  grammarTopicMetadata,
  summarizeGrammarResults,
} from "@/modules/grammarPractice";
import { type AchievementDefinition, getAchievement } from "@/modules/rewards";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { useWindowBackAction } from "@/ui/components/WindowNavigation";
import { AchievementIcon, ConfettiBurst, RewardToast, useChime } from "@/ui/components/rewards";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GrammarTopicForPractice } from "../../../../../electron/db/repositories/grammar";
import type { SessionResultPersistence } from "./SessionPlayer";
import { SessionSummary } from "./SessionSummary";

export interface GrammarSessionPlayerProps {
  topics: GrammarTopicForPractice[];
  deck: GrammarExercise[];
  onExit: () => void;
  contextLabel?: string;
  onResult?: (
    result: GrammarPracticeResult,
  ) => undefined | Promise<SessionResultPersistence | undefined>;
  onEvidence?: (result: GrammarPracticeResult) => void;
  soundEnabled?: boolean;
  studentId?: number | string | null;
}

interface ToastSpec {
  key: number;
  achievementId: string;
  title: string;
  description: string;
  icon: AchievementDefinition["icon"];
}

const CONFETTI_THRESHOLDS = new Set([5, 10]);

export function GrammarSessionPlayer({
  topics,
  deck,
  onExit,
  contextLabel,
  onResult,
  onEvidence,
  soundEnabled = false,
  studentId,
}: GrammarSessionPlayerProps) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<GrammarPracticeResult[]>([]);
  const [pendingResult, setPendingResult] = useState<GrammarPracticeResult | null>(null);
  const [correctRun, setCorrectRun] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const [toasts, setToasts] = useState<ToastSpec[]>([]);

  const playChime = useChime(soundEnabled);
  const current = deck[index] ?? null;
  const done = started && current === null;
  const promptShownAt = useRef(nowMs());
  const promptExerciseId = useRef<string | null>(null);
  if (promptExerciseId.current !== (current?.id ?? null)) {
    promptExerciseId.current = current?.id ?? null;
    promptShownAt.current = nowMs();
  }

  const dismissToast = useCallback((key: number) => {
    setToasts((prev) => prev.filter((toast) => toast.key !== key));
  }, []);

  const enqueueUnlocks = useCallback(
    (unlocks: SessionResultPersistence["unlockedAchievements"]) => {
      if (unlocks.length === 0) return;
      setToasts((prev) => {
        const next = [...prev];
        for (const unlocked of unlocks) {
          const def = getAchievement(unlocked.achievementId);
          if (!def) continue;
          next.push({
            key: nextGrammarToastKey(),
            achievementId: def.id,
            title: def.title,
            description: def.description,
            icon: def.icon,
          });
        }
        return next;
      });
    },
    [],
  );

  const handleAnswer = useCallback(
    (answer: GrammarAnswer) => {
      if (!current || pendingResult) return;
      const outcome = gradeGrammarExercise(current, answer);
      const responseMs = Math.max(0, Math.round(nowMs() - promptShownAt.current));
      const newRun = outcome.correct ? correctRun + 1 : 0;
      setCorrectRun(newRun);

      if (outcome.correct && CONFETTI_THRESHOLDS.has(newRun)) {
        setConfettiKey((key) => key + 1);
        playChime();
      }

      const result: GrammarPracticeResult = {
        exerciseId: current.id,
        topicId: current.topicId,
        contentItemId: current.contentItemId,
        kind: current.kind,
        outcome,
        currentSessionRun: newRun,
        responseMs,
      };
      setPendingResult(result);
      onEvidence?.(result);

      if (onResult) {
        Promise.resolve(onResult(result))
          .then((persistence) => {
            if (persistence && persistence.unlockedAchievements.length > 0) {
              enqueueUnlocks(persistence.unlockedAchievements);
            }
          })
          .catch((err) => {
            console.error("[GrammarSessionPlayer] onResult failed", err);
          });
      }
    },
    [current, pendingResult, correctRun, playChime, onResult, onEvidence, enqueueUnlocks],
  );

  const advance = useCallback(() => {
    if (!pendingResult) return;
    setResults((prev) => [...prev, pendingResult]);
    setPendingResult(null);
    setIndex((prev) => prev + 1);
  }, [pendingResult]);

  const summary = useMemo(() => (done ? summarizeGrammarResults(results) : null), [done, results]);

  if (!started) {
    return (
      <GrammarShell contextLabel={contextLabel} onExit={onExit}>
        <GrammarOverview
          topics={topics}
          exerciseCount={deck.length}
          onStart={() => setStarted(true)}
        />
      </GrammarShell>
    );
  }

  if (deck.length === 0) {
    return (
      <GrammarShell contextLabel={contextLabel} onExit={onExit}>
        <section className="object-surface px-6 py-10 text-center">
          <h2 className="text-base font-medium">No grammar practice yet</h2>
          <p className="mt-1 text-xs text-muted">
            This lesson has no grammar questions yet. Ask your tutor to check the lesson content.
          </p>
        </section>
      </GrammarShell>
    );
  }

  if (done && summary) {
    return (
      <GrammarShell contextLabel={contextLabel} onExit={onExit}>
        <SessionSummary
          stats={summary}
          studentId={studentId}
          onRestart={() => {
            setStarted(false);
            setResults([]);
            setIndex(0);
            setCorrectRun(0);
            setPendingResult(null);
          }}
          onExit={onExit}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </GrammarShell>
    );
  }

  return (
    <GrammarShell contextLabel={contextLabel} onExit={onExit}>
      <ConfettiBurst fireKey={confettiKey} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className="flex flex-col gap-4">
        <GrammarStatus current={index} total={deck.length} correctRun={correctRun} />
        {current ? (
          <GrammarExerciseCard
            key={current.id}
            exercise={current}
            pendingResult={pendingResult}
            onAnswer={handleAnswer}
            onContinue={advance}
          />
        ) : null}
      </div>
    </GrammarShell>
  );
}

let grammarToastCounter = 0;
function nextGrammarToastKey(): number {
  grammarToastCounter += 1;
  return grammarToastCounter;
}

function GrammarOverview({
  topics,
  exerciseCount,
  onStart,
}: {
  topics: GrammarTopicForPractice[];
  exerciseCount: number;
  onStart: () => void;
}) {
  return (
    <section className="object-surface overflow-hidden bg-surface-1">
      <header className="px-6 pb-5 pt-6">
        <span className="learning-trace-label text-xs font-semibold text-accent">
          Grammar overview
        </span>
        <h1 className="mt-3 text-[24px] font-semibold leading-tight">
          Review the rule, then apply it.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Read the patterns and common mistakes first. The practice set then asks you to choose,
          write, reorder, and correct sentences.
        </p>
      </header>

      <ul className="divide-y divide-border-subtle border-y border-border-subtle">
        {topics.map((topic) => (
          <TopicOverviewCard key={topic.id} topic={topic} />
        ))}
      </ul>
      <footer className="flex items-center justify-between gap-4 px-6 py-4" data-content-action-bar>
        <p className="text-xs text-muted">
          {topics.length} {topics.length === 1 ? "topic" : "topics"} · {exerciseCount} questions
        </p>
        <Button size="lg" onClick={onStart} disabled={exerciseCount === 0}>
          Start practice
        </Button>
      </footer>
    </section>
  );
}

function TopicOverviewCard({ topic }: { topic: GrammarTopicForPractice }) {
  const metadata = grammarTopicMetadata(topic.metadata);
  const patterns = metadata.patterns ?? [];
  const mistakes = metadata.common_mistakes ?? [];

  return (
    <li className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(12rem,0.75fr)_minmax(0,1.25fr)]">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{topic.title}</h2>
        {topic.summaryMd ? (
          <p className="mt-1 text-sm leading-6 text-muted">{topic.summaryMd}</p>
        ) : null}
        {topic.difficulty ? (
          <p className="mt-2 text-xs text-muted-2">Level {topic.difficulty}</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {patterns.length > 0 ? (
          <div className="rounded-md bg-surface-2 p-3">
            <h3 className="text-xs font-semibold text-muted-2">Patterns</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {patterns.slice(0, 3).map((pattern, index) => (
                <li key={`${pattern.form}-${index}`} className="text-sm">
                  <span className="font-medium text-app">{pattern.form}</span>
                  {pattern.use ? <span className="text-muted"> — {pattern.use}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {mistakes.length > 0 ? (
          <div className="rounded-md bg-warning/10 p-3">
            <h3 className="text-xs font-semibold text-warning">Watch for</h3>
            <p className="mt-2 text-sm text-app">{mistakes[0]?.wrong}</p>
            <p className="mt-1 text-sm text-success">{mistakes[0]?.correct}</p>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function GrammarStatus({
  current,
  total,
  correctRun,
}: {
  current: number;
  total: number;
  correctRun: number;
}) {
  return (
    <section className="grid gap-2 border-b border-border-subtle pb-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="min-w-0">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span data-tabular className="text-[13px] font-medium text-app">
            Question {Math.min(current + 1, total)} of {total}
          </span>
          <span className="text-xs text-muted">Grammar practice</span>
        </div>
        <ProgressMeter
          value={current}
          max={total}
          label="Grammar practice progress"
          tone="accent"
        />
      </div>
      <div className="flex items-baseline justify-end gap-1.5 text-xs text-muted">
        <span data-tabular className="font-semibold text-app">
          {correctRun}
        </span>
        <span>{correctRun === 1 ? "correct answer in a row" : "correct answers in a row"}</span>
      </div>
    </section>
  );
}

function GrammarExerciseCard({
  exercise,
  pendingResult,
  onAnswer,
  onContinue,
}: {
  exercise: GrammarExercise;
  pendingResult: GrammarPracticeResult | null;
  onAnswer: (answer: GrammarAnswer) => void;
  onContinue: () => void;
}) {
  const outcome = pendingResult?.outcome ?? null;
  const disabled = Boolean(outcome);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      role="group"
      aria-labelledby={`grammar-prompt-${exercise.id}`}
      className="object-surface flex flex-col gap-5 bg-surface-1 p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="learning-trace-label text-xs font-semibold text-accent">
            {formatExerciseKind(exercise.kind)}
          </span>
          <h2
            ref={headingRef}
            id={`grammar-prompt-${exercise.id}`}
            tabIndex={-1}
            className="mt-3 text-2xl font-semibold leading-snug outline-none"
          >
            {exercise.prompt}
          </h2>
          {exercise.instruction ? (
            <p className="mt-1 text-sm leading-6 text-muted">{exercise.instruction}</p>
          ) : null}
        </div>
        <span className="text-xs text-muted">{exercise.topicTitle}</span>
      </header>

      {exercise.kind === "grammar_fill_blank" ? (
        <FillBlankCard exercise={exercise} disabled={disabled} onAnswer={onAnswer} />
      ) : null}
      {exercise.kind === "grammar_choice" ? (
        <ChoiceCard exercise={exercise} disabled={disabled} outcome={outcome} onAnswer={onAnswer} />
      ) : null}
      {exercise.kind === "grammar_order" ? (
        <OrderCard exercise={exercise} disabled={disabled} onAnswer={onAnswer} />
      ) : null}
      {exercise.kind === "grammar_rewrite" ||
      exercise.kind === "grammar_prompted_sentence" ||
      exercise.kind === "grammar_error_correction" ? (
        <TextAnswerCard exercise={exercise} disabled={disabled} onAnswer={onAnswer} />
      ) : null}

      {exercise.hint && !outcome ? (
        <p className="rounded-md bg-accent/8 px-4 py-3 text-sm text-accent">{exercise.hint}</p>
      ) : null}
      {outcome ? (
        <FeedbackPanel
          outcome={outcome}
          explanation={exercise.explanation}
          onContinue={onContinue}
        />
      ) : null}
    </section>
  );
}

function FillBlankCard({
  exercise,
  disabled,
  onAnswer,
}: {
  exercise: Extract<GrammarExercise, { kind: "grammar_fill_blank" }>;
  disabled: boolean;
  onAnswer: (answer: GrammarAnswer) => void;
}) {
  const [value, setValue] = useState("");
  const inputId = `grammar-fill-${exercise.id}`;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onAnswer({ kind: "grammar_fill_blank", text: value });
      }}
    >
      <p className="rounded-md bg-surface-2 px-4 py-4 text-xl leading-8">
        {exercise.payload.sentence}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Missing words
        </label>
        <input
          id={inputId}
          className="ui-focus-ring min-h-12 flex-1 rounded-control border border-border-strong bg-surface-0 px-4 text-base text-app transition focus:border-accent"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          placeholder="Type the missing words"
        />
        <Button type="submit" disabled={disabled || value.trim().length === 0}>
          Check
        </Button>
      </div>
    </form>
  );
}

function ChoiceCard({
  exercise,
  disabled,
  outcome,
  onAnswer,
}: {
  exercise: Extract<GrammarExercise, { kind: "grammar_choice" }>;
  disabled: boolean;
  outcome: { selectedIndex: number | null; correct: boolean } | null;
  onAnswer: (answer: GrammarAnswer) => void;
}) {
  return (
    <div className="grid gap-3">
      {exercise.payload.options.map((option, index) => {
        const selected = outcome?.selectedIndex === index;
        const revealCorrect = Boolean(outcome) && option.correct;
        const answerState = revealCorrect
          ? "Correct answer"
          : selected && outcome
            ? "Your answer, incorrect"
            : null;
        return (
          <button
            key={`${option.text}-${index}`}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={`${option.text}${answerState ? `. ${answerState}` : ""}`}
            onClick={() => onAnswer({ kind: "grammar_choice", selectedIndex: index })}
            className={cn(
              "ui-focus-ring rounded-control border border-border-subtle bg-surface-2 px-4 py-4 text-left text-base font-medium text-app transition-colors",
              "hover:border-accent/40 hover:bg-surface-1",
              selected && "border-danger/50 bg-danger/10 text-danger",
              revealCorrect && "border-success/50 bg-success/10 text-success",
            )}
          >
            {option.text}
            {answerState ? <span className="sr-only">. {answerState}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function OrderCard({
  exercise,
  disabled,
  onAnswer,
}: {
  exercise: Extract<GrammarExercise, { kind: "grammar_order" }>;
  disabled: boolean;
  onAnswer: (answer: GrammarAnswer) => void;
}) {
  const [tokenItems] = useState(() =>
    exercise.payload.tokens.map((token, position) => ({
      id: `${exercise.id}-token-${position}-${token}`,
      token,
      position,
    })),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = new Set(selectedIds);
  const selectedItems = selectedIds
    .map((id) => tokenItems.find((item) => item.id === id))
    .filter((item): item is { id: string; token: string; position: number } => Boolean(item));
  const selectedTokens = selectedItems.map((item) => item.token);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Your sentence"
        className="min-h-16 rounded-control border border-border-strong bg-surface-0 p-3"
      >
        <div className="flex flex-wrap gap-2">
          {selectedIds.length === 0 ? (
            <span className="px-2 py-2 text-sm text-muted">Build your sentence here.</span>
          ) : null}
          {selectedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              data-grammar-token={item.position}
              data-grammar-zone="answer"
              disabled={disabled}
              onClick={() => {
                setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                focusGrammarToken(item.position, "tray");
              }}
              className="ui-focus-ring rounded-control border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent"
            >
              {item.token}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label="Word tray" className="flex flex-wrap gap-2">
        {tokenItems.map((item) => (
          <button
            key={item.id}
            type="button"
            data-grammar-token={item.position}
            data-grammar-zone="tray"
            disabled={disabled || selectedSet.has(item.id)}
            onClick={() => {
              setSelectedIds((prev) => [...prev, item.id]);
              focusGrammarToken(item.position, "answer");
            }}
            className="ui-focus-ring rounded-control border border-border-subtle bg-surface-2 px-3 py-2 text-sm font-medium text-app transition hover:border-focus/40 disabled:opacity-40"
          >
            {item.token}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Current sentence: {selectedTokens.length > 0 ? selectedTokens.join(" ") : "empty"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onAnswer({ kind: "grammar_order", tokens: selectedTokens })}
          disabled={disabled || selectedTokens.length === 0}
        >
          Check
        </Button>
        <Button variant="secondary" onClick={() => setSelectedIds([])} disabled={disabled}>
          Reset
        </Button>
      </div>
    </div>
  );
}

function focusGrammarToken(position: number, zone: "answer" | "tray") {
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLButtonElement>(
        `[data-grammar-token="${position}"][data-grammar-zone="${zone}"]`,
      )
      ?.focus();
  });
}

function TextAnswerCard({
  exercise,
  disabled,
  onAnswer,
}: {
  exercise: Extract<
    GrammarExercise,
    { kind: "grammar_rewrite" | "grammar_prompted_sentence" | "grammar_error_correction" }
  >;
  disabled: boolean;
  onAnswer: (answer: GrammarAnswer) => void;
}) {
  const [value, setValue] = useState("");
  const answerId = `grammar-answer-${exercise.id}`;
  const source =
    exercise.kind === "grammar_rewrite"
      ? exercise.payload.sourceSentence
      : exercise.kind === "grammar_error_correction"
        ? exercise.payload.incorrectSentence
        : exercise.payload.words.join(" / ");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onAnswer({ kind: exercise.kind, text: value } as GrammarAnswer);
      }}
    >
      <p className="rounded-md bg-surface-2 px-4 py-4 text-lg leading-8">{source}</p>
      <label htmlFor={answerId} className="sr-only">
        Written answer
      </label>
      <textarea
        id={answerId}
        className="ui-focus-ring min-h-28 rounded-control border border-border-strong bg-surface-0 px-4 py-3 text-base leading-7 text-app transition focus:border-accent"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        placeholder="Write your answer"
      />
      <Button type="submit" className="self-start" disabled={disabled || value.trim().length === 0}>
        Check
      </Button>
    </form>
  );
}

function FeedbackPanel({
  outcome,
  explanation,
  onContinue,
}: {
  outcome: { correct: boolean; feedback: string };
  explanation: string | null;
  onContinue: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-md px-4 py-4", outcome.correct ? "bg-success/10" : "bg-warning/10")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone={outcome.correct ? "success" : "warning"}>
            {outcome.correct ? "Correct" : "Review"}
          </Badge>
          <p className="mt-2 text-sm leading-6 text-app">{outcome.feedback}</p>
          {explanation ? <p className="mt-1 text-sm leading-6 text-muted">{explanation}</p> : null}
        </div>
        <Button onClick={onContinue}>{outcome.correct ? "Next" : "Got it"}</Button>
      </div>
    </div>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastSpec[];
  onDismiss: (key: number) => void;
}) {
  const head = toasts[0];
  if (!head) return null;
  return (
    <RewardToast
      id={head.achievementId}
      title={head.title}
      description={head.description}
      icon={<AchievementIcon icon={head.icon} className="h-5 w-5" />}
      onDismiss={() => onDismiss(head.key)}
    />
  );
}

function GrammarShell({
  children,
  contextLabel,
  onExit,
}: {
  children: ReactNode;
  contextLabel?: string;
  onExit: () => void;
}) {
  const hasWindowBack = useWindowBackAction("Lessons", onExit);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 px-6 py-5">
      <header className="flex min-h-8 min-w-0 flex-wrap items-center justify-between gap-4">
        {contextLabel ? (
          <span className="truncate text-[13px] font-medium text-muted">{contextLabel}</span>
        ) : null}
        {!hasWindowBack ? (
          <Button variant="ghost" size="md" onClick={onExit} className="text-muted">
            End session
          </Button>
        ) : null}
      </header>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </div>
  );
}

function formatExerciseKind(kind: GrammarExercise["kind"]): string {
  switch (kind) {
    case "grammar_fill_blank":
      return "Fill blank";
    case "grammar_choice":
      return "Choose form";
    case "grammar_order":
      return "Word order";
    case "grammar_rewrite":
      return "Rewrite";
    case "grammar_prompted_sentence":
      return "Prompted sentence";
    case "grammar_error_correction":
      return "Correction";
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
