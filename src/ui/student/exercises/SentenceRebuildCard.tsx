/**
 * Sentence rebuild card — tap chips from the scrambled tray to
 * place them into the ordered sentence row.
 *
 * Why click-to-place (not drag-drop):
 *   - Works identically on touch + keyboard + mouse without any dep.
 *   - dnd-kit can be layered in later for a more delightful animation,
 *     but the contract here (an ordered `tokens` array submit) doesn't
 *     change.
 *
 * UX:
 *   - Tap a chip in the tray → moves to the answer row (rightmost).
 *   - Tap a chip in the answer row → returns to the tray (preserving
 *     original tray order via a `originIndex` field).
 *   - Submit fires `onAnswer({ tokens })` only when the answer row has
 *     the full token count.
 */
import { cn } from "@/lib/cn";
import type { GradeOutcome, SentenceRebuildExercise } from "@/modules/exercises";
import { Button } from "@/ui/components/Button";
import { useMemo, useState } from "react";

export interface SentenceRebuildCardProps {
  exercise: SentenceRebuildExercise;
  onAnswer: (tokens: string[]) => void;
  outcome: GradeOutcome | null;
}

interface Chip {
  token: string;
  originIndex: number;
}

export function SentenceRebuildCard({ exercise, onAnswer, outcome }: SentenceRebuildCardProps) {
  const initialTray = useMemo<Chip[]>(
    () => exercise.payload.scrambled.map((token, originIndex) => ({ token, originIndex })),
    [exercise.payload.scrambled],
  );
  const [tray, setTray] = useState<Chip[]>(initialTray);
  const [answer, setAnswer] = useState<Chip[]>([]);

  const targetLength = exercise.payload.correctOrder.length;
  const submitDisabled = answer.length !== targetLength;
  const locked = outcome !== null;
  const answerTokens = answer.map((chip) => chip.token);
  const correctOrder = exercise.payload.correctOrder;
  const correctTokenChips = useMemo(() => {
    const seen = new Map<string, number>();
    return correctOrder.map((token) => {
      const count = (seen.get(token) ?? 0) + 1;
      seen.set(token, count);
      return { token, key: `${token}-${count}` };
    });
  }, [correctOrder]);

  function placeChip(chip: Chip) {
    if (locked) return;
    setTray((prev) => prev.filter((c) => c.originIndex !== chip.originIndex));
    setAnswer((prev) => [...prev, chip]);
    focusMovedChip(chip.originIndex, "answer");
  }

  function unplaceChip(chip: Chip) {
    if (locked) return;
    setAnswer((prev) => prev.filter((c) => c.originIndex !== chip.originIndex));
    setTray((prev) => [...prev, chip].sort((a, b) => a.originIndex - b.originIndex));
    focusMovedChip(chip.originIndex, "tray");
  }

  function submit() {
    if (submitDisabled || locked) return;
    onAnswer(answerTokens);
  }

  return (
    <section className="object-surface motion-enter mx-auto flex max-w-2xl flex-col gap-5 bg-surface-1 p-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="text-xs font-semibold text-accent">Build the sentence</span>
        <p className="text-sm text-muted">
          {locked
            ? outcome.correct
              ? "That sentence is in the right order."
              : "Compare your sentence with the correct order below."
            : "Tap the words in the right order. Headword: "}
          {!locked ? (
            <span className="font-semibold text-app">{exercise.payload.headword}</span>
          ) : null}
        </p>
      </header>

      <div
        role="group"
        className={cn(
          "min-h-16 rounded-control border border-border-strong bg-surface-2 p-3 transition-colors",
          !locked && answer.length === targetLength && "border-accent",
          locked && outcome.correct && "answer-correct border-success/70 bg-success/10",
          locked && !outcome.correct && "answer-wrong border-danger/70 bg-danger/10",
        )}
        aria-label="Your sentence"
      >
        {answer.length === 0 ? (
          <p className="text-center text-sm text-muted">Tap chips below to start your sentence.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {answer.map((chip) => (
              <button
                key={chip.originIndex}
                type="button"
                data-chip-index={chip.originIndex}
                data-chip-zone="answer"
                onClick={() => unplaceChip(chip)}
                disabled={locked}
                className={cn(
                  "ui-focus-ring rounded-control border px-3 py-1.5 text-sm font-medium disabled:cursor-default",
                  locked && outcome.correct
                    ? "border-success bg-success/15 text-success"
                    : locked
                      ? "border-danger bg-danger/15 text-danger"
                      : "border-accent bg-accent text-accent-fg",
                )}
              >
                {chip.token}
              </button>
            ))}
          </div>
        )}
      </div>

      <div role="group" className="flex flex-wrap gap-2" aria-label="Word tray">
        {tray.map((chip) => (
          <button
            key={chip.originIndex}
            type="button"
            data-chip-index={chip.originIndex}
            data-chip-zone="tray"
            onClick={() => placeChip(chip)}
            disabled={locked}
            className="ui-focus-ring rounded-control border border-border-strong bg-surface-1 px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent hover:bg-surface-2 disabled:cursor-default disabled:opacity-50"
          >
            {chip.token}
          </button>
        ))}
        {tray.length === 0 && (
          <p className="text-sm text-muted">All words placed — submit when you're ready.</p>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        Current sentence: {answerTokens.length > 0 ? answerTokens.join(" ") : "empty"}
      </p>

      {locked && !outcome.correct ? (
        <div className="rounded-md bg-success/10 p-4">
          <p className="text-xs font-semibold text-success">Correct sentence</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {correctTokenChips.map(({ token, key }, index) => (
              <span
                key={key}
                className={cn(
                  "rounded-chip border px-3 py-1.5 text-sm font-semibold",
                  answerTokens[index] === token
                    ? "border-success/45 bg-success/10 text-success"
                    : "border-border-subtle bg-surface-1 text-app",
                )}
              >
                {token}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex justify-center">
        <Button
          type="button"
          onClick={submit}
          disabled={submitDisabled || locked}
          variant="primary"
          size="lg"
        >
          {locked ? (outcome.correct ? "Correct" : "Reviewing") : "Check"}
        </Button>
      </div>
    </section>
  );
}

function focusMovedChip(index: number, zone: "answer" | "tray") {
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLButtonElement>(`[data-chip-index="${index}"][data-chip-zone="${zone}"]`)
      ?.focus();
  });
}
