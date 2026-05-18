import { cn } from "@/lib/cn";
import type { GradeOutcome, MultipleChoiceExercise } from "@/modules/exercises";
import { Badge } from "@/ui/components/Badge";
import { VocabularyPronunciation } from "@/ui/components/VocabularyPronunciation";
import { useEffect, useState } from "react";

export interface MultipleChoiceCardProps {
  exercise: MultipleChoiceExercise;
  onAnswer: (selectedIndex: number) => void;
  /** When provided, options render their post-grade state. */
  outcome: GradeOutcome | null;
  autoplay?: boolean;
  preferredAccent?: "uk" | "us" | "any";
}

const KEY_DIGIT = /^[1-9]$/;

/**
 * Reset semantics: callers re-mount via React `key` to clear the picked
 * state between exercises (see SessionPlayer).
 */
export function MultipleChoiceCard({
  exercise,
  onAnswer,
  outcome,
  autoplay = true,
  preferredAccent = "uk",
}: MultipleChoiceCardProps) {
  const [picked, setPicked] = useState<number | null>(null);

  // 1-9 keyboard shortcut for picking options. Disabled once an answer is locked.
  useEffect(() => {
    if (picked !== null) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      if (!KEY_DIGIT.test(e.key)) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < exercise.payload.options.length) {
        e.preventDefault();
        setPicked(idx);
        onAnswer(idx);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, exercise.payload.options.length, onAnswer]);

  const locked = outcome !== null;
  const correctOption = exercise.payload.options.find((option) => option.correct) ?? null;

  return (
    <article
      data-exercise-kind="multiple_choice"
      className="flex flex-col gap-7 rounded-bento border border-border-subtle bg-surface-1 p-8 shadow-card dark:shadow-card-dark"
    >
      <header className="flex items-center justify-between">
        <Badge tone="rare" uppercase>
          Multiple choice
        </Badge>
        <span className="text-xs font-semibold uppercase text-muted-2">
          {locked ? (outcome.correct ? "Correct" : "Review") : "Pick the headword"}
        </span>
      </header>

      <p className="text-balance text-2xl font-semibold leading-relaxed text-app">
        {exercise.payload.prompt}
      </p>
      {correctOption ? (
        <VocabularyPronunciation
          headword={correctOption.text}
          fallbackRefs={correctOption.audioRefs ?? []}
          autoPlayKey={autoplay ? exercise.id : null}
          preferredAccent={preferredAccent}
          size="sm"
          className="-mt-4 justify-start"
        />
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {exercise.payload.options.map((option, idx) => {
          const isPicked = picked === idx;
          const tone = optionTone({ option, locked, isPicked });
          return (
            <li key={`${idx}-${option.text}`}>
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  if (locked) return;
                  setPicked(idx);
                  onAnswer(idx);
                }}
                aria-pressed={isPicked}
                aria-label={`Option ${idx + 1}: ${option.text}`}
                className={cn(
                  // Duolingo-style answer chip: 2px border, large radius
                  // from student tokens, press-bounce shadow stack
                  // collapses on tap. Disabled when answer locked.
                  "flex min-h-16 w-full items-center gap-3 rounded-button border-2 px-5 py-4 text-left text-base transition-[background-color,border-color,color,box-shadow,transform]",
                  !locked && "press-bounce hover:translate-y-0 active:translate-y-[3px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1",
                  tone,
                )}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border-subtle font-mono text-xs text-muted-2">
                  {idx + 1}
                </span>
                <span className="flex-1 font-medium">{option.text}</span>
                {locked && option.correct ? (
                  <span aria-hidden className="text-lg text-success">
                    ✓
                  </span>
                ) : null}
                {locked && isPicked && !option.correct ? (
                  <span aria-hidden className="text-lg text-danger">
                    ✗
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function optionTone({
  option,
  locked,
  isPicked,
}: {
  option: { correct: boolean };
  locked: boolean;
  isPicked: boolean;
}): string {
  if (!locked) {
    return isPicked
      ? "border-accent bg-accent/10 text-app shadow-[0_0_0_4px_rgb(var(--color-accent)/0.12)]"
      : "border-border-subtle bg-surface-0/50 text-app hover:border-border-strong hover:bg-surface-2";
  }
  if (option.correct) return "answer-correct border-success/60 bg-success/10 text-success";
  if (isPicked) return "answer-wrong border-danger/60 bg-danger/10 text-danger";
  return "border-border-subtle bg-surface-0/30 text-muted";
}
