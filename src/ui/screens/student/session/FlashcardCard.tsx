import { cn } from "@/lib/cn";
import { type FlashcardExercise, type SelfGrade, selfGrades } from "@/modules/exercises";
import { Button } from "@/ui/components/Button";
import { ClozeText } from "@/ui/components/ClozeText";
import { VocabularyPronunciation } from "@/ui/components/VocabularyPronunciation";
import { PressButton } from "@/ui/student/components/PressButton";
import { useEffect, useState } from "react";

const GRADE_LABELS: Record<
  SelfGrade,
  { label: string; tone: "danger" | "warning" | "success" | "accent"; hint: string }
> = {
  again: { label: "Again", tone: "danger", hint: "1" },
  hard: { label: "Hard", tone: "warning", hint: "2" },
  good: { label: "Good", tone: "success", hint: "3" },
  easy: { label: "Easy", tone: "accent", hint: "4" },
};

const GRADE_KEY_MAP: Record<string, SelfGrade> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

export interface FlashcardCardProps {
  exercise: FlashcardExercise;
  onAnswer: (grade: SelfGrade) => void;
  /** Auto-play the headword pronunciation on mount. Defaults to true. */
  autoplay?: boolean;
  preferredAccent?: "uk" | "us" | "any";
}

/**
 * Reset semantics: callers that need internal state to reset between
 * exercises should remount this component with a unique React `key` (e.g.
 * `key={exercise.id}`). That keeps the component stateful and side-effect
 * free at the same time.
 */
export function FlashcardCard({
  exercise,
  onAnswer,
  autoplay = true,
  preferredAccent = "uk",
}: FlashcardCardProps) {
  const [revealed, setRevealed] = useState(false);

  // Keyboard: Space/Enter to flip; 1-4 to grade once revealed.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      if (!revealed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      const grade = GRADE_KEY_MAP[e.key];
      if (grade) {
        e.preventDefault();
        onAnswer(grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, onAnswer]);

  const { front, back } = exercise.payload;

  return (
    <article
      data-exercise-kind="flashcard"
      data-revealed={revealed}
      className="object-surface motion-enter flex min-h-[22rem] flex-col gap-6 bg-surface-1 p-6 sm:p-8"
    >
      <header className="flex items-center justify-between">
        <span className="learning-trace-label text-xs font-semibold text-accent">Flashcard</span>
        <span className="text-xs font-medium text-muted-2">
          {revealed ? "Rate your recall" : "Tap to reveal"}
        </span>
      </header>

      <div className="flex min-h-52 flex-1 flex-col items-center justify-center gap-3 text-center">
        {revealed ? (
          <div>
            <h2 className="ui-lexical max-w-full break-words text-5xl font-semibold leading-none sm:text-6xl">
              {front.headword}
            </h2>
            <div className="mt-3 flex items-baseline justify-center gap-3 text-muted">
              <span className="font-mono text-base">{front.pos}</span>
              {front.ipa ? <span className="font-mono text-base">{front.ipa}</span> : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            aria-label="Reveal flashcard"
            className="ui-focus-ring rounded-control px-8 py-6 transition-colors hover:bg-surface-2/60 active:bg-surface-3/60"
          >
            <h2 className="ui-lexical max-w-full break-words text-5xl font-semibold leading-none sm:text-6xl">
              {front.headword}
            </h2>
            <div className="mt-3 flex items-baseline justify-center gap-3 text-muted">
              <span className="font-mono text-base">{front.pos}</span>
              {front.ipa ? <span className="font-mono text-base">{front.ipa}</span> : null}
            </div>
          </button>
        )}
        <VocabularyPronunciation
          headword={front.headword}
          fallbackRefs={front.audioRefs}
          // autoPlayKey gates autoplay: the same exercise.id only fires
          // once, and we suppress entirely when the tutor turned the
          // pronunciation_autoplay setting off.
          autoPlayKey={autoplay ? exercise.id : null}
          preferredAccent={preferredAccent}
          size="sm"
          hotkeys={{ uk: "k", us: "u" }}
          className="justify-center"
        />
        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-2">
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono">K</span>
          <span>UK audio</span>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono">U</span>
          <span>US audio</span>
        </div>
      </div>

      {!revealed ? (
        <div className="flex justify-center">
          <PressButton
            size="lg"
            onClick={() => setRevealed(true)}
            aria-label="Reveal answer"
            className="h-11 min-w-44"
          >
            Reveal &nbsp; <span className="font-mono text-[10px] text-accent-fg/70">space</span>
          </PressButton>
        </div>
      ) : (
        <FlashcardBack back={back} onAnswer={onAnswer} />
      )}
    </article>
  );
}

function FlashcardBack({
  back,
  onAnswer,
}: {
  back: FlashcardExercise["payload"]["back"];
  onAnswer: (grade: SelfGrade) => void;
}) {
  const englishBlock =
    back.definitionsEn.length > 0 ? (
      <ol className="flex flex-col gap-2 text-base leading-relaxed text-muted">
        {back.definitionsEn.map((def, i) => (
          <li key={`${i}-${def}`} className="flex gap-2">
            <span className="tabular-figure text-sm text-muted-2">{i + 1}.</span>
            <span className="ui-lexical">{def}</span>
          </li>
        ))}
      </ol>
    ) : null;
  const vietnameseBlock = back.definitionVi ? (
    <p className="ui-lexical text-xl font-semibold leading-relaxed text-app">{back.definitionVi}</p>
  ) : null;
  return (
    <div className="motion-enter flex flex-col gap-5">
      <section className="flex flex-col gap-2 border-t border-border-subtle pt-5">
        {back.definitionPriority === "vi_first" ? (
          <>
            {vietnameseBlock}
            {englishBlock}
          </>
        ) : (
          <>
            {englishBlock}
            {vietnameseBlock}
          </>
        )}
      </section>

      {back.exampleText ? (
        <section className="rounded-md bg-surface-2 px-5 py-4">
          <p className="mb-1.5 text-xs font-semibold text-muted-2">Example</p>
          <ClozeText text={back.exampleText} className="text-base" />
        </section>
      ) : null}

      <div
        role="group"
        aria-label="Rate your recall"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {selfGrades.map((grade) => {
          const meta = GRADE_LABELS[grade];
          return (
            <Button
              key={grade}
              variant="secondary"
              onClick={() => onAnswer(grade)}
              className={cn(
                "min-h-11 border border-transparent py-2.5 text-sm font-semibold",
                meta.tone === "danger" &&
                  "border-danger bg-danger/5 text-danger hover:bg-danger/15",
                meta.tone === "warning" &&
                  "border-warning bg-warning/5 text-warning hover:bg-warning/15",
                meta.tone === "success" &&
                  "border-success bg-success/5 text-success hover:bg-success/15",
                meta.tone === "accent" &&
                  "border-accent bg-accent/5 text-accent hover:bg-accent/15",
              )}
            >
              {meta.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
