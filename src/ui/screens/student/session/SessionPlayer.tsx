import { cn } from "@/lib/cn";
import { type Answer, type Exercise, type GradeOutcome, gradeExercise } from "@/modules/exercises";
import { type AchievementDefinition, getAchievement } from "@/modules/rewards";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { AchievementIcon, ConfettiBurst, RewardToast, useChime } from "@/ui/components/rewards";
import { useCallback, useMemo, useState } from "react";
import { FlashcardCard } from "./FlashcardCard";
import { MultipleChoiceCard } from "./MultipleChoiceCard";
import { SessionSummary, type SessionSummaryStats } from "./SessionSummary";

export interface SessionResult {
  exerciseId: string;
  entryId: number;
  kind: Exercise["kind"];
  outcome: GradeOutcome;
  /** In-session correct streak ending at this answer (0 if wrong). */
  currentSessionRun: number;
}

/** Persistence result returned by `onResult` so the player can show unlock toasts. */
export interface SessionResultPersistence {
  unlockedAchievements: Array<{ achievementId: string }>;
}

export interface SessionPlayerProps {
  /** Pre-built deck — keep this stable across renders to avoid index resets. */
  deck: Exercise[];
  onExit: () => void;
  /** Visible label, e.g. "Family & Friends · 12 entries". */
  contextLabel?: string;
  /**
   * Pause after auto-graded exercises so the student sees the right
   * answer highlighted. Tests pass `0` to advance instantly.
   */
  autoAdvanceDelayMs?: number;
  /**
   * Side-effect hook called once per answered exercise, fired before the
   * card advances. The route screen uses it to persist a learning_event
   * + update item_progress; pure tests pass a spy.
   *
   * Errors are caught + logged so a flaky write never blocks the deck.
   */
  onResult?: (result: SessionResult) => undefined | Promise<SessionResultPersistence | undefined>;
  /** Whether to play a chime on milestone bursts. Off by default. */
  soundEnabled?: boolean;
}

const DEFAULT_AUTO_ADVANCE_MS = 1_200;
/** In-session correct runs that fire confetti + a chime. */
const CONFETTI_THRESHOLDS = new Set([5, 10]);

interface ToastSpec {
  /** Stable instance key — used for React reconciliation. */
  key: number;
  achievementId: string;
  title: string;
  description: string;
  icon: AchievementDefinition["icon"];
}

/**
 * The actual play loop. Three states: `playing` → optional `feedback` →
 * `done`. The deck and per-result history are owned here in React state;
 * the `onResult` callback is the seam where the route screen plugs in
 * `progress.recordAnswer` so persistence stays out of the player.
 *
 * Reward feedback layers on top:
 *   - `correctRunCount` ticks up per correct answer; hitting 5 or 10
 *     triggers confetti + (optional) chime.
 *   - When `onResult` resolves with `unlockedAchievements`, each becomes
 *     a slide-in toast that auto-dismisses after a few seconds.
 *
 * Multiple-choice exercises lock the option set on first click and pause
 * for ~1.2s on the wrong-answer path so the student sees the correct
 * one highlighted before the deck advances.
 */
export function SessionPlayer({
  deck,
  onExit,
  contextLabel,
  autoAdvanceDelayMs = DEFAULT_AUTO_ADVANCE_MS,
  onResult,
  soundEnabled = false,
}: SessionPlayerProps) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SessionResult[]>([]);
  /** Set when an auto-graded exercise is locked but not yet advanced. */
  const [pendingOutcome, setPendingOutcome] = useState<GradeOutcome | null>(null);
  const [correctRun, setCorrectRun] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const [toasts, setToasts] = useState<ToastSpec[]>([]);

  const playChime = useChime(soundEnabled);

  const total = deck.length;
  const current = deck[index] ?? null;
  const done = current === null;

  const advance = useCallback((result: SessionResult) => {
    setResults((prev) => [...prev, result]);
    setPendingOutcome(null);
    setIndex((prev) => prev + 1);
  }, []);

  const dismissToast = useCallback((key: number) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const enqueueUnlocks = useCallback(
    (unlocks: SessionResultPersistence["unlockedAchievements"]) => {
      if (unlocks.length === 0) return;
      setToasts((prev) => {
        const next = [...prev];
        for (const u of unlocks) {
          const def = getAchievement(u.achievementId);
          if (!def) continue;
          next.push({
            key: nextToastKey(),
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
    (answer: Answer) => {
      if (!current) return;
      const outcome = gradeExercise(current, answer);
      const newRun = outcome.correct ? correctRun + 1 : 0;
      setCorrectRun(newRun);

      if (outcome.correct && CONFETTI_THRESHOLDS.has(newRun)) {
        setConfettiKey((k) => k + 1);
        playChime();
      }

      const result: SessionResult = {
        exerciseId: current.id,
        entryId: current.entryId,
        kind: current.kind,
        outcome,
        currentSessionRun: newRun,
      };

      if (onResult) {
        // Fire-and-forget for the deck loop, but capture unlocks asynchronously
        // so they show up as toasts once persistence resolves.
        Promise.resolve(onResult(result))
          .then((persistence) => {
            if (persistence && persistence.unlockedAchievements.length > 0) {
              enqueueUnlocks(persistence.unlockedAchievements);
            }
          })
          .catch((err) => {
            console.error("[SessionPlayer] onResult failed", err);
          });
      }

      if (current.kind === "flashcard") {
        // Self-graded: advance immediately. The reveal+grade UX already
        // gave the student time to look at the back.
        advance(result);
        return;
      }

      // Auto-graded: hold on the result so the student sees the green/red
      // marks, then advance after a short pause. `autoAdvanceDelayMs=0`
      // (used in tests) collapses this into the next tick.
      setPendingOutcome(outcome);
      if (autoAdvanceDelayMs <= 0) {
        advance(result);
      } else {
        window.setTimeout(() => advance(result), autoAdvanceDelayMs);
      }
    },
    [current, advance, autoAdvanceDelayMs, onResult, correctRun, playChime, enqueueUnlocks],
  );

  const summary = useMemo<SessionSummaryStats | null>(() => {
    if (!done) return null;
    return summarize(results);
  }, [done, results]);

  if (deck.length === 0) {
    return (
      <PlayerShell contextLabel={contextLabel} onExit={onExit}>
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-1 px-6 py-10 text-center">
          <h2 className="text-base font-medium">No exercises in this deck</h2>
          <p className="mt-1 text-xs text-muted">
            The lesson needs vocab entries with at least one definition + a few peers for
            distractors. Re-run `npm run import` after editing the YAML.
          </p>
        </div>
      </PlayerShell>
    );
  }

  if (done && summary) {
    return (
      <PlayerShell contextLabel={contextLabel} onExit={onExit}>
        <SessionSummary
          stats={summary}
          onRestart={() => {
            setResults([]);
            setIndex(0);
            setCorrectRun(0);
          }}
          onExit={onExit}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </PlayerShell>
    );
  }

  return (
    <PlayerShell contextLabel={contextLabel} onExit={onExit}>
      <ConfettiBurst fireKey={confettiKey} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className="flex flex-col gap-4">
        <ProgressBar current={index} total={total} />
        <ExerciseCard
          exercise={current as Exercise}
          onAnswer={handleAnswer}
          outcome={pendingOutcome}
        />
      </div>
    </PlayerShell>
  );
}

let _toastKeyCounter = 0;
function nextToastKey(): number {
  _toastKeyCounter += 1;
  return _toastKeyCounter;
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastSpec[];
  onDismiss: (key: number) => void;
}) {
  // Show at most one toast at a time; queueing is implicit because each
  // toast unmounts itself via onDismiss before the next slides in.
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

function ExerciseCard({
  exercise,
  onAnswer,
  outcome,
}: {
  exercise: Exercise;
  onAnswer: (answer: Answer) => void;
  outcome: GradeOutcome | null;
}) {
  // `key={exercise.id}` re-mounts the per-kind component on each new
  // exercise so internal state (revealed flag, picked option) resets
  // without an explicit reset effect.
  switch (exercise.kind) {
    case "flashcard":
      return (
        <FlashcardCard
          key={exercise.id}
          exercise={exercise}
          onAnswer={(grade) => onAnswer({ kind: "flashcard", grade })}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoiceCard
          key={exercise.id}
          exercise={exercise}
          outcome={outcome}
          onAnswer={(selectedIndex) => onAnswer({ kind: "multiple_choice", selectedIndex })}
        />
      );
  }
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((current / total) * 100));
  // Visually a custom bar; semantically expose the same value via a hidden
  // <progress>. This sidesteps a11y lint rules around role=progressbar on a
  // non-focusable div and gives screen readers the right announcement.
  return (
    <div className="flex items-center gap-3">
      <progress className="sr-only" value={current} max={total} aria-label="Session progress" />
      <div aria-hidden className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted">
        {current} / {total}
      </span>
    </div>
  );
}

function PlayerShell({
  children,
  contextLabel,
  onExit,
}: {
  children: React.ReactNode;
  contextLabel?: string;
  onExit: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge tone="accent" uppercase>
            Practice
          </Badge>
          {contextLabel ? <span className="text-sm text-muted">{contextLabel}</span> : null}
        </div>
        <Button variant="ghost" size="md" onClick={onExit} className="text-muted">
          End session
        </Button>
      </header>
      <div className={cn("flex flex-col gap-5")}>{children}</div>
    </div>
  );
}

function summarize(results: SessionResult[]): SessionSummaryStats {
  const total = results.length;
  const correct = results.filter((r) => r.outcome.correct).length;
  const byKind: Record<string, { total: number; correct: number }> = {};
  for (const r of results) {
    const bucket = byKind[r.kind] ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (r.outcome.correct) bucket.correct += 1;
    byKind[r.kind] = bucket;
  }
  return { total, correct, byKind };
}
