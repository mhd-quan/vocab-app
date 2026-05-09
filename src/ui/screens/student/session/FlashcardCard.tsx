import { cn } from "@/lib/cn";
import { type FlashcardExercise, type SelfGrade, selfGrades } from "@/modules/exercises";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { ClozeText } from "@/ui/components/ClozeText";
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
}

/**
 * Reset semantics: callers that need internal state to reset between
 * exercises should remount this component with a unique React `key` (e.g.
 * `key={exercise.id}`). That keeps the component stateful and side-effect
 * free at the same time.
 */
export function FlashcardCard({ exercise, onAnswer }: FlashcardCardProps) {
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
      className="flex flex-col gap-6 rounded-2xl border border-border-subtle bg-surface-1 p-8 shadow-lg"
    >
      <header className="flex items-center justify-between">
        <Badge tone="accent" uppercase>
          Flashcard
        </Badge>
        <span className="text-[10px] uppercase tracking-widest text-muted-2">
          {revealed ? "Rate your recall" : "Tap to reveal"}
        </span>
      </header>

      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-4xl font-semibold tracking-tight">{front.headword}</h2>
        <div className="flex items-baseline gap-3 text-muted">
          <span className="font-mono text-sm">{front.pos}</span>
          {front.ipa ? <span className="font-mono text-sm">{front.ipa}</span> : null}
        </div>
      </div>

      {!revealed ? (
        <div className="flex justify-center">
          <Button size="lg" onClick={() => setRevealed(true)} aria-label="Reveal answer">
            Reveal &nbsp; <span className="font-mono text-[10px] text-accent-fg/70">space</span>
          </Button>
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
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 border-t border-border-subtle pt-5">
        {back.definitionsEn.length > 0 ? (
          <ol className="flex flex-col gap-1.5 text-base text-app">
            {back.definitionsEn.map((def, i) => (
              <li key={`${i}-${def}`} className="flex gap-2">
                <span className="font-mono text-xs text-muted-2">{i + 1}.</span>
                <span>{def}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {back.definitionVi ? <p className="text-sm text-muted">{back.definitionVi}</p> : null}
      </section>

      {back.exampleText ? (
        <section className="rounded-md border border-border-subtle bg-surface-0/50 px-4 py-3">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-2">Example</p>
          <ClozeText text={back.exampleText} className="text-sm" />
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
              variant={meta.tone === "danger" ? "danger" : "secondary"}
              onClick={() => onAnswer(grade)}
              className={cn(
                "flex-col py-3",
                meta.tone === "warning" && "border-warning/40 text-warning hover:bg-warning/10",
                meta.tone === "success" && "border-success/40 text-success hover:bg-success/10",
                meta.tone === "accent" && "border-accent/40 text-accent hover:bg-accent/10",
              )}
            >
              <span>{meta.label}</span>
              <span className="font-mono text-[10px] text-muted-2">{meta.hint}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
