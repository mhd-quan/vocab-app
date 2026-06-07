import { useAudioPrefetch, usePronunciationLookupPrefetch } from "@/lib/audioPrefetch";
import {
  type Answer,
  type Exercise,
  type ExerciseSourceRef,
  type GradeOutcome,
  type LazyDeck,
  gradeExercise,
} from "@/modules/exercises";
import { type AchievementDefinition, getAchievement } from "@/modules/rewards";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { StreakFlame } from "@/ui/components/LearningIcons";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { AchievementIcon } from "@/ui/components/rewards";
import {
  CelebrationOverlay,
  type CelebrationToast,
} from "@/ui/student/components/CelebrationOverlay";
import { PressButton } from "@/ui/student/components/PressButton";
import { ProgressBubble } from "@/ui/student/components/ProgressBubble";
import { AudioRecallCard } from "@/ui/student/exercises/AudioRecallCard";
import { DefinitionMatchCard } from "@/ui/student/exercises/DefinitionMatchCard";
import { PronunciationCard } from "@/ui/student/exercises/PronunciationCard";
import { SentenceRebuildCard } from "@/ui/student/exercises/SentenceRebuildCard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlashcardCard } from "./FlashcardCard";
import { MultipleChoiceCard } from "./MultipleChoiceCard";
import { SessionSummary, type SessionSummaryStats } from "./SessionSummary";

export interface SessionResult {
  exerciseId: string;
  entryId: number;
  source: ExerciseSourceRef;
  kind: Exercise["kind"];
  outcome: GradeOutcome;
  /** In-session correct streak ending at this answer (0 if wrong). */
  currentSessionRun: number;
  /** Milliseconds from card render to submitted/self-graded answer. */
  responseMs: number;
}

/** Persistence result returned by `onResult` so the player can show unlock toasts. */
export interface SessionResultPersistence {
  unlockedAchievements: Array<{ achievementId: string }>;
}

export interface SessionPlayerProps {
  /** Keep this stable across renders to avoid index resets. */
  deck: SessionDeck;
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
  /** Best-effort evidence hook; failures are isolated from academic progress. */
  onEvidence?: (result: SessionResult) => void;
  /** Whether to play a chime on milestone bursts. Off by default. */
  soundEnabled?: boolean;
  /**
   * Auto-play pronunciation audio on each new card. Threaded from the
   * `pronunciation_autoplay` app setting via DisplayPreferencesProvider.
   * Defaults to true so tests + tutor "demo" paths still autoplay.
   */
  autoplay?: boolean;
  preferredAccent?: "uk" | "us" | "any";
  studentId?: number | string | null;
  /**
   * Active practice session row id — threaded down so pronunciation
   * exercises can attribute the assess IPC. Null until the session
   * mutation resolves; the pronunciation card stays disabled while null.
   */
  sessionId?: number | null;
}

export type SessionDeck = Exercise[] | LazyDeck;

interface SessionDeckSlot {
  index: number;
  exercise: Exercise;
}

const DEFAULT_AUTO_ADVANCE_MS = 4_000;
/** In-session correct runs that fire confetti + a chime. */
const CONFETTI_THRESHOLDS = new Set([5, 10]);

/**
 * Local toast spec mirrors the CelebrationOverlay's `CelebrationToast`
 * but keeps the original `achievementId` for telemetry / tests. The
 * mapping to the overlay's shape happens at render time below.
 */
interface ToastSpec {
  /** Stable instance key — used for React reconciliation. */
  key: number;
  achievementId: string;
  title: string;
  description: string;
  icon: AchievementDefinition["icon"];
}

function toCelebrationToast(spec: ToastSpec): CelebrationToast {
  return {
    key: spec.key,
    id: spec.achievementId,
    title: spec.title,
    description: spec.description,
    icon: <AchievementIcon icon={spec.icon} className="h-5 w-5" />,
  };
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
  onEvidence,
  soundEnabled = false,
  autoplay = true,
  preferredAccent = "uk",
  studentId,
  sessionId = null,
}: SessionPlayerProps) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SessionResult[]>([]);
  /** Set when an auto-graded exercise is locked but not yet advanced. */
  const [pendingOutcome, setPendingOutcome] = useState<GradeOutcome | null>(null);
  const [pendingResult, setPendingResult] = useState<SessionResult | null>(null);
  const [correctRun, setCorrectRun] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const [toasts, setToasts] = useState<ToastSpec[]>([]);
  /**
   * Per-exercise retry counter — bumped when the engine reports
   * `needsRetry`, then folded into the card's React `key` so the card
   * resets and a fresh attempt is possible without an explicit reset.
   */
  const [retryAttempt, setRetryAttempt] = useState(0);
  const advancedExerciseIds = useRef(new Set<string>());

  const total = deckSize(deck);
  const currentSlot = useMemo(() => findNextDeckSlot(deck, index), [deck, index]);
  const current = currentSlot?.exercise ?? null;
  const currentSlotIndex = currentSlot?.index ?? index;
  const done = current === null;
  const noExercises = total === 0 || (done && results.length === 0);
  const currentSlotIndexRef = useRef(currentSlotIndex);
  currentSlotIndexRef.current = currentSlotIndex;
  const promptShownAt = useRef(nowMs());
  const promptExerciseId = useRef<string | null>(null);
  if (promptExerciseId.current !== (current?.id ?? null)) {
    promptExerciseId.current = current?.id ?? null;
    promptShownAt.current = nowMs();
  }

  // Audio prefetch: warm the next 3 cards' dictionary lookups and audio
  // blobs so autoplay on advance starts instantly.
  useEffect(() => {
    if (done) return;
    prefetchDeck(deck, currentSlotIndex + 3);
  }, [currentSlotIndex, deck, done]);

  const upcomingAudioRefs = useMemo(() => {
    const out: string[] = [];
    for (let i = currentSlotIndex; i < Math.min(total, currentSlotIndex + 4); i++) {
      const ex = peekDeck(deck, i);
      if (!ex) continue;
      if (ex.kind === "flashcard") {
        out.push(...ex.payload.front.audioRefs.map((audio) => audio.ref));
      }
      if (ex.kind === "multiple_choice") {
        for (const option of ex.payload.options) {
          if (option.correct) out.push(...(option.audioRefs ?? []).map((audio) => audio.ref));
        }
      }
      if (ex.kind === "audio_recall") {
        out.push(ex.payload.audioRef);
      }
      if (ex.kind === "pronunciation") {
        out.push(...ex.payload.referenceAudio.map((audio) => audio.ref));
      }
    }
    return out;
  }, [currentSlotIndex, deck, total]);
  const upcomingPronunciationTerms = useMemo(() => {
    const out: string[] = [];
    for (let i = currentSlotIndex; i < Math.min(total, currentSlotIndex + 4); i++) {
      const ex = peekDeck(deck, i);
      if (!ex) continue;
      if (ex.kind === "flashcard") out.push(ex.payload.front.headword);
      if (ex.kind === "multiple_choice") {
        const correct = ex.payload.options.find((option) => option.correct);
        if (correct) out.push(correct.text);
      }
      if (ex.kind === "audio_recall") out.push(ex.payload.displayHeadword);
      if (ex.kind === "pronunciation") out.push(ex.payload.headword);
    }
    return out;
  }, [currentSlotIndex, deck, total]);
  useAudioPrefetch(upcomingAudioRefs);
  usePronunciationLookupPrefetch(upcomingPronunciationTerms, preferredAccent);

  const advance = useCallback((result: SessionResult) => {
    if (advancedExerciseIds.current.has(result.exerciseId)) return;
    advancedExerciseIds.current.add(result.exerciseId);
    setResults((prev) => [...prev, result]);
    setPendingOutcome(null);
    setPendingResult(null);
    setIndex(currentSlotIndexRef.current + 1);
  }, []);

  const advancePending = useCallback(() => {
    if (pendingResult) advance(pendingResult);
  }, [advance, pendingResult]);

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
      const responseMs = Math.max(0, Math.round(nowMs() - promptShownAt.current));
      const newRun = outcome.correct ? correctRun + 1 : 0;
      setCorrectRun(newRun);

      if (outcome.correct && CONFETTI_THRESHOLDS.has(newRun)) {
        // CelebrationOverlay listens to burstKey and fires both confetti
        // and the chime in one place, so we just bump the counter here.
        setConfettiKey((k) => k + 1);
      }

      const result: SessionResult = {
        exerciseId: current.id,
        entryId: current.entryId,
        source: current.source,
        kind: current.kind,
        outcome,
        currentSessionRun: newRun,
        responseMs,
      };

      onEvidence?.(result);

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

      // Cards that ask for a retry (e.g. pronunciation under threshold)
      // stay on screen. Persistence already fired above — FSRS counts
      // the lapse — but the deck does not advance. The card re-mounts
      // via the bumped retry key so a fresh attempt is possible.
      if (outcome.needsRetry) {
        setRetryAttempt((n) => n + 1);
        setPendingOutcome(outcome);
        setPendingResult(null);
        return;
      }

      // Auto-graded: hold on the result so the student sees the green/red
      // marks, then advance after a short pause. `autoAdvanceDelayMs=0`
      // (used in tests) collapses this into the next tick.
      setPendingOutcome(outcome);
      setPendingResult(result);
      if (autoAdvanceDelayMs <= 0) {
        advance(result);
      } else {
        window.setTimeout(() => advance(result), autoAdvanceDelayMs);
      }
    },
    [current, advance, autoAdvanceDelayMs, onResult, onEvidence, correctRun, enqueueUnlocks],
  );

  const summary = useMemo<SessionSummaryStats | null>(() => {
    if (!done) return null;
    return summarize(results);
  }, [done, results]);

  if (noExercises) {
    return (
      <PlayerShell contextLabel={contextLabel} onExit={onExit}>
        <BentoCard className="border-dashed px-6 py-10 text-center">
          <h2 className="text-base font-medium">No exercises in this deck</h2>
          <p className="mt-1 text-xs text-muted">
            This lesson needs vocabulary entries with at least one definition. New words start as
            flashcards first; multiple-choice review appears when there are enough peer headwords
            for answer options. Re-run `npm run import` after editing the YAML.
          </p>
        </BentoCard>
      </PlayerShell>
    );
  }

  if (done && summary) {
    return (
      <PlayerShell contextLabel={contextLabel} onExit={onExit}>
        <SessionSummary
          stats={summary}
          studentId={studentId}
          onRestart={() => {
            setResults([]);
            setIndex(0);
            setCorrectRun(0);
            setPendingOutcome(null);
            setPendingResult(null);
            setRetryAttempt(0);
            advancedExerciseIds.current.clear();
          }}
          onExit={onExit}
        />
        <CelebrationOverlay
          burstKey={confettiKey}
          chimeEnabled={soundEnabled}
          toasts={toasts.map(toCelebrationToast)}
          onDismiss={dismissToast}
        />
      </PlayerShell>
    );
  }

  if (!current) return null;

  return (
    <PlayerShell contextLabel={contextLabel} onExit={onExit}>
      <CelebrationOverlay
        burstKey={confettiKey}
        chimeEnabled={soundEnabled}
        toasts={toasts.map(toCelebrationToast)}
        onDismiss={dismissToast}
      />
      <div className="flex flex-col gap-4">
        <SessionStatus
          current={results.length}
          total={total}
          correctRun={correctRun}
          tier={cardTier(current, correctRun)}
        />
        <ExerciseCard
          exercise={current}
          onAnswer={handleAnswer}
          outcome={pendingOutcome}
          autoplay={autoplay}
          preferredAccent={preferredAccent}
          studentId={studentId}
          sessionId={sessionId}
          retryAttempt={retryAttempt}
        />
        {pendingResult ? (
          <div className="flex justify-end">
            <PressButton onClick={advancePending} variant="primary" size="md">
              Next
            </PressButton>
          </div>
        ) : null}
      </div>
    </PlayerShell>
  );
}

let _toastKeyCounter = 0;
function nextToastKey(): number {
  _toastKeyCounter += 1;
  return _toastKeyCounter;
}

function ExerciseCard({
  exercise,
  onAnswer,
  outcome,
  autoplay,
  preferredAccent,
  studentId,
  sessionId,
  retryAttempt,
}: {
  exercise: Exercise;
  onAnswer: (answer: Answer) => void;
  outcome: GradeOutcome | null;
  autoplay: boolean;
  preferredAccent: "uk" | "us" | "any";
  studentId?: number | string | null;
  sessionId: number | null;
  retryAttempt: number;
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
          autoplay={autoplay}
          preferredAccent={preferredAccent}
          onAnswer={(grade) => onAnswer({ kind: "flashcard", grade })}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoiceCard
          key={exercise.id}
          exercise={exercise}
          outcome={outcome}
          autoplay={autoplay}
          preferredAccent={preferredAccent}
          onAnswer={(selectedIndex) => onAnswer({ kind: "multiple_choice", selectedIndex })}
        />
      );
    case "audio_recall":
      return (
        <AudioRecallCard
          key={exercise.id}
          exercise={exercise}
          autoplay={autoplay}
          preferredAccent={preferredAccent}
          onAnswer={(spelling) => onAnswer({ kind: "audio_recall", spelling })}
        />
      );
    case "definition_match":
      return (
        <DefinitionMatchCard
          key={exercise.id}
          exercise={exercise}
          outcome={outcome}
          onAnswer={(assignments) => onAnswer({ kind: "definition_match", assignments })}
        />
      );
    case "sentence_rebuild":
      return (
        <SentenceRebuildCard
          key={exercise.id}
          exercise={exercise}
          outcome={outcome}
          onAnswer={(tokens) => onAnswer({ kind: "sentence_rebuild", tokens })}
        />
      );
    case "pronunciation": {
      const numericStudentId = typeof studentId === "number" ? studentId : Number(studentId);
      if (!Number.isFinite(numericStudentId) || numericStudentId <= 0) {
        return (
          <p className="px-6 py-10 text-center text-sm text-muted">
            Pronunciation needs an active student.
          </p>
        );
      }
      return (
        <PronunciationCard
          key={`${exercise.id}:${retryAttempt}`}
          exercise={exercise}
          outcome={outcome}
          studentId={numericStudentId}
          sessionId={sessionId}
          preferredAccent={preferredAccent}
          onAnswer={(attempt) => onAnswer({ kind: "pronunciation", attempt })}
        />
      );
    }
  }
}

type CardTier = { label: string; tone: "rare" | "epic" | "mastery" | "accent" };

function SessionStatus({
  current,
  total,
  correctRun,
  tier,
}: {
  current: number;
  total: number;
  correctRun: number;
  tier: CardTier;
}) {
  return (
    <BentoCard
      as="section"
      className="grid gap-4 border-accent/20 bg-accent/5 p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
    >
      <ProgressBubble current={current} total={total} label="Session progress" />
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase text-muted-2">Session progress</span>
          <span className="font-mono text-xs text-muted">
            {current} / {total}
          </span>
        </div>
        <ProgressMeter value={current} max={total} label="Session progress" tone="accent" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2">
        <StreakFlame streak={correctRun} className="h-5 w-5" />
        <span className="font-mono text-sm text-app">{correctRun}</span>
        <span className="text-xs text-muted">streak</span>
      </div>
      <Badge tone={tier.tone} uppercase className="h-9 justify-center px-3">
        {tier.label}
      </Badge>
    </BentoCard>
  );
}

function cardTier(exercise: Exercise, correctRun: number): CardTier {
  if (correctRun >= 10) return { label: "Mastery card", tone: "mastery" };
  if (correctRun >= 5) return { label: "Epic card", tone: "epic" };
  if (exercise.kind === "multiple_choice") return { label: "Rare card", tone: "rare" };
  return { label: "Core card", tone: "accent" };
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Badge tone="accent" uppercase>
            Practice
          </Badge>
          {contextLabel ? (
            <span className="truncate text-sm text-muted">{contextLabel}</span>
          ) : null}
        </div>
        <PressButton variant="secondary" size="sm" onClick={onExit} className="text-muted">
          End session
        </PressButton>
      </header>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
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

function deckSize(deck: SessionDeck): number {
  return Array.isArray(deck) ? deck.length : deck.size;
}

function peekDeck(deck: SessionDeck, index: number): Exercise | null {
  if (index < 0) return null;
  return Array.isArray(deck) ? (deck[index] ?? null) : deck.peek(index);
}

function prefetchDeck(deck: SessionDeck, upToIndex: number): void {
  if (!Array.isArray(deck)) deck.prefetch(upToIndex);
}

function findNextDeckSlot(deck: SessionDeck, startIndex: number): SessionDeckSlot | null {
  const total = deckSize(deck);
  for (let index = Math.max(0, startIndex); index < total; index += 1) {
    const exercise = peekDeck(deck, index);
    if (exercise) return { index, exercise };
  }
  return null;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
