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
import type { SentenceRebuildExercise } from "@/modules/exercises";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { useMemo, useState } from "react";

export interface SentenceRebuildCardProps {
  exercise: SentenceRebuildExercise;
  onAnswer: (tokens: string[]) => void;
}

interface Chip {
  token: string;
  originIndex: number;
}

export function SentenceRebuildCard({ exercise, onAnswer }: SentenceRebuildCardProps) {
  const initialTray = useMemo<Chip[]>(
    () => exercise.payload.scrambled.map((token, originIndex) => ({ token, originIndex })),
    [exercise.payload.scrambled],
  );
  const [tray, setTray] = useState<Chip[]>(initialTray);
  const [answer, setAnswer] = useState<Chip[]>([]);

  const targetLength = exercise.payload.correctOrder.length;
  const submitDisabled = answer.length !== targetLength;

  function placeChip(chip: Chip) {
    setTray((prev) => prev.filter((c) => c.originIndex !== chip.originIndex));
    setAnswer((prev) => [...prev, chip]);
  }

  function unplaceChip(chip: Chip) {
    setAnswer((prev) => prev.filter((c) => c.originIndex !== chip.originIndex));
    setTray((prev) => [...prev, chip].sort((a, b) => a.originIndex - b.originIndex));
  }

  function submit() {
    if (submitDisabled) return;
    onAnswer(answer.map((c) => c.token));
  }

  return (
    <section className="motion-enter mx-auto flex max-w-2xl flex-col gap-5 rounded-bento border border-border-subtle bg-surface-1 p-6 shadow-card">
      <header className="flex flex-col items-center gap-3 text-center">
        <Badge tone="accent" uppercase>
          Build the sentence
        </Badge>
        <p className="text-sm text-muted">
          Tap the words in the right order. Headword:{" "}
          <span className="font-semibold text-app">{exercise.payload.headword}</span>
        </p>
      </header>

      <div
        className={cn(
          "min-h-16 rounded-bento border-2 border-dashed border-border-strong bg-surface-2 p-3",
          answer.length === targetLength && "border-accent",
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
                onClick={() => unplaceChip(chip)}
                className="rounded-chip border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg shadow-press-active"
              >
                {chip.token}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Word tray">
        {tray.map((chip) => (
          <button
            key={chip.originIndex}
            type="button"
            onClick={() => placeChip(chip)}
            className="press-bounce rounded-chip border border-border-strong bg-surface-1 px-3 py-1.5 text-sm font-medium hover:border-accent"
          >
            {chip.token}
          </button>
        ))}
        {tray.length === 0 && (
          <p className="text-sm text-muted">All words placed — submit when you're ready.</p>
        )}
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          onClick={submit}
          disabled={submitDisabled}
          variant="primary"
          size="lg"
        >
          Check
        </Button>
      </div>
    </section>
  );
}
