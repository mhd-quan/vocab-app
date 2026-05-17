/**
 * Audio recall card — "hear the word, type the spelling".
 *
 * UX:
 *   - On mount the audio button shows + autoplays (handled by
 *     `<PronunciationControls autoPlayKey={…}>`).
 *   - Student types into the input. Enter submits.
 *   - Hint (POS + Vietnamese gloss) is one-tap-revealable below the
 *     input — younger learners often know the word in their L1 but
 *     can't yet spell the English form.
 *
 * Reset semantics: caller passes `key={exercise.id}` so internal state
 * resets per card without an explicit effect.
 */
import type { DictionaryAudioRef } from "@/data/dictionary";
import { cn } from "@/lib/cn";
import type { AudioRecallExercise } from "@/modules/exercises";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { PronunciationControls } from "@/ui/components/PronunciationControls";
import { type FormEvent, useState } from "react";

export interface AudioRecallCardProps {
  exercise: AudioRecallExercise;
  onAnswer: (spelling: string) => void;
  /** Disable input + autoplay (used by tests). */
  autoplay?: boolean;
}

export function AudioRecallCard({ exercise, onAnswer, autoplay = true }: AudioRecallCardProps) {
  const [spelling, setSpelling] = useState("");
  const [hintRevealed, setHintRevealed] = useState(false);

  const audioRefs: DictionaryAudioRef[] = [
    { ref: exercise.payload.audioRef, label: exercise.payload.audioLabel, accent: "other" },
  ];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!spelling.trim()) return;
    onAnswer(spelling);
  }

  const hint = exercise.payload.hint;

  return (
    <form
      onSubmit={handleSubmit}
      className="motion-enter mx-auto flex max-w-xl flex-col gap-5 rounded-bento border border-border-subtle bg-surface-1 p-6 shadow-card"
    >
      <header className="flex flex-col items-center gap-3 text-center">
        <Badge tone="accent" uppercase>
          Audio recall
        </Badge>
        <p className="text-sm text-muted">Listen to the word, then type the spelling.</p>
        <PronunciationControls
          audioRefs={audioRefs}
          autoPlayKey={autoplay ? exercise.id : null}
          size="md"
          className="justify-center"
        />
      </header>

      <input
        type="text"
        // biome-ignore lint/a11y/noAutofocus: focus is the kid-friendly affordance for a recall card
        autoFocus
        value={spelling}
        onChange={(e) => setSpelling(e.target.value)}
        placeholder="Type the word…"
        className={cn(
          "w-full rounded-button border border-border-strong bg-surface-0 px-4 py-3 text-center text-2xl font-semibold tracking-wide outline-none",
          "focus:border-accent",
        )}
      />

      <div className="flex flex-col items-center gap-2">
        {hint && (hint.gloss || hint.pos) ? (
          hintRevealed ? (
            <div className="text-sm text-muted">
              <span className="font-medium">{hint.pos}</span>
              {hint.gloss ? ` · ${hint.gloss}` : ""}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setHintRevealed(true)}
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              Need a hint?
            </button>
          )
        ) : null}
        <Button type="submit" variant="primary" size="lg" disabled={!spelling.trim()}>
          Check
        </Button>
      </div>
    </form>
  );
}
