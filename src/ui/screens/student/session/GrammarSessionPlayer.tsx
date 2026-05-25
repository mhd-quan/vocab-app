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
import { BentoCard } from "@/ui/components/BentoCard";
import { Button } from "@/ui/components/Button";
import { StreakFlame } from "@/ui/components/LearningIcons";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { AchievementIcon, ConfettiBurst, RewardToast, useChime } from "@/ui/components/rewards";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
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
          onExit={onExit}
        />
      </GrammarShell>
    );
  }

  if (deck.length === 0) {
    return (
      <GrammarShell contextLabel={contextLabel} onExit={onExit}>
        <BentoCard className="border-dashed px-6 py-10 text-center">
          <h2 className="text-base font-medium">No grammar practice yet</h2>
          <p className="mt-1 text-xs text-muted">
            Add an activities block to this grammar YAML topic, then re-run import.
          </p>
        </BentoCard>
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
  onExit,
}: {
  topics: GrammarTopicForPractice[];
  exerciseCount: number;
  onStart: () => void;
  onExit: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <BentoCard tone="focus" className="grid gap-5 p-6 lg:grid-cols-[1.25fr_auto] lg:items-center">
        <div>
          <Badge tone="focus" uppercase>
            Grammar overview
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            Review the rule, then apply it.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Start with the core patterns and common mistakes, then complete a mixed practice set
            that asks you to choose, write, reorder, and correct sentences.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <Button size="lg" onClick={onStart} disabled={exerciseCount === 0}>
            Start {exerciseCount} questions
          </Button>
          <Button variant="secondary" size="lg" onClick={onExit}>
            Back to lessons
          </Button>
        </div>
      </BentoCard>

      <ul className="grid gap-4 lg:grid-cols-2">
        {topics.map((topic) => (
          <TopicOverviewCard key={topic.id} topic={topic} />
        ))}
      </ul>
    </div>
  );
}

function TopicOverviewCard({ topic }: { topic: GrammarTopicForPractice }) {
  const metadata = grammarTopicMetadata(topic.metadata);
  const patterns = metadata.patterns ?? [];
  const mistakes = metadata.common_mistakes ?? [];

  return (
    <BentoCard as="li" interactive className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="rare" uppercase>
          Topic
        </Badge>
        {topic.difficulty ? (
          <Badge tone="muted" uppercase>
            Level {topic.difficulty}
          </Badge>
        ) : null}
      </div>
      <div>
        <h2 className="text-lg font-semibold">{topic.title}</h2>
        {topic.summaryMd ? (
          <p className="mt-1 text-sm leading-6 text-muted">{topic.summaryMd}</p>
        ) : null}
      </div>
      {patterns.length > 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-2/70 p-3">
          <h3 className="text-xs font-semibold uppercase text-muted-2">Patterns</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {patterns.slice(0, 3).map((pattern, index) => (
              <li key={`${pattern.form}-${index}`} className="text-sm">
                <span className="font-medium text-app">{pattern.form}</span>
                {pattern.use ? <span className="text-muted"> - {pattern.use}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {mistakes.length > 0 ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3">
          <h3 className="text-xs font-semibold uppercase text-warning">Watch for</h3>
          <p className="mt-2 text-sm text-app">{mistakes[0]?.wrong}</p>
          <p className="mt-1 text-sm text-success">{mistakes[0]?.correct}</p>
        </div>
      ) : null}
    </BentoCard>
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
    <BentoCard as="section" className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase text-muted-2">Grammar practice</span>
          <span className="font-mono text-xs text-muted">
            {current} / {total}
          </span>
        </div>
        <ProgressMeter value={current} max={total} label="Grammar practice progress" tone="rare" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2">
        <StreakFlame streak={correctRun} className="h-5 w-5" />
        <span className="font-mono text-sm text-app">{correctRun}</span>
        <span className="text-xs text-muted">streak</span>
      </div>
      <Badge
        tone={correctRun >= 5 ? "mastery" : "focus"}
        uppercase
        className="h-9 justify-center px-3"
      >
        {correctRun >= 5 ? "Pattern lock" : "Rule drill"}
      </Badge>
    </BentoCard>
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

  return (
    <BentoCard className="flex flex-col gap-5 p-6" tone={outcome?.correct ? "success" : "neutral"}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="focus" uppercase>
            {formatExerciseKind(exercise.kind)}
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold leading-snug">{exercise.prompt}</h2>
          {exercise.instruction ? (
            <p className="mt-1 text-sm leading-6 text-muted">{exercise.instruction}</p>
          ) : null}
        </div>
        <Badge tone="muted" uppercase>
          {exercise.topicTitle}
        </Badge>
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
        <p className="rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-sm text-sky">
          {exercise.hint}
        </p>
      ) : null}
      {outcome ? (
        <FeedbackPanel
          outcome={outcome}
          explanation={exercise.explanation}
          onContinue={onContinue}
        />
      ) : null}
    </BentoCard>
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
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onAnswer({ kind: "grammar_fill_blank", text: value });
      }}
    >
      <p className="rounded-2xl border border-border-subtle bg-surface-2 px-4 py-4 text-xl leading-8">
        {exercise.payload.sentence}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="min-h-12 flex-1 rounded-2xl border border-border-strong bg-surface-0 px-4 text-base text-app outline-none transition focus:border-accent"
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
        return (
          <button
            key={`${option.text}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer({ kind: "grammar_choice", selectedIndex: index })}
            className={cn(
              "rounded-2xl border border-border-subtle bg-surface-2 px-4 py-4 text-left text-base font-medium text-app transition",
              "hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-1 disabled:hover:translate-y-0",
              selected && "border-danger/50 bg-danger/10 text-danger",
              revealCorrect && "border-success/50 bg-success/10 text-success",
            )}
          >
            {option.text}
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
    })),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = new Set(selectedIds);
  const selectedItems = selectedIds
    .map((id) => tokenItems.find((item) => item.id === id))
    .filter((item): item is { id: string; token: string } => Boolean(item));
  const selectedTokens = selectedItems.map((item) => item.token);

  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-16 rounded-2xl border border-border-strong bg-surface-0 p-3">
        <div className="flex flex-wrap gap-2">
          {selectedIds.length === 0 ? (
            <span className="px-2 py-2 text-sm text-muted">Build your sentence here.</span>
          ) : null}
          {selectedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== item.id))}
              className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent"
            >
              {item.token}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tokenItems.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled || selectedSet.has(item.id)}
            onClick={() => setSelectedIds((prev) => [...prev, item.id])}
            className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-sm font-medium text-app transition hover:-translate-y-0.5 hover:border-focus/40 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {item.token}
          </button>
        ))}
      </div>
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
      <p className="rounded-2xl border border-border-subtle bg-surface-2 px-4 py-4 text-lg leading-8">
        {source}
      </p>
      <textarea
        className="min-h-28 rounded-2xl border border-border-strong bg-surface-0 px-4 py-3 text-base leading-7 text-app outline-none transition focus:border-accent"
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
      className={cn(
        "rounded-2xl border px-4 py-4",
        outcome.correct ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone={outcome.correct ? "success" : "warning"} uppercase>
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
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Badge tone="focus" uppercase>
            Grammar
          </Badge>
          {contextLabel ? (
            <span className="truncate text-sm text-muted">{contextLabel}</span>
          ) : null}
        </div>
        <Button variant="ghost" size="md" onClick={onExit} className="text-muted">
          End session
        </Button>
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
