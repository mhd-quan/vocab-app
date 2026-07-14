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
import { Button } from "@/ui/components/Button";
import { PronunciationControls } from "@/ui/components/PronunciationControls";
import { type FormEvent, useState } from "react";

export interface AudioRecallCardProps {
  exercise: AudioRecallExercise;
  onAnswer: (spelling: string) => void;
  /** Disable input + autoplay (used by tests). */
  autoplay?: boolean;
  preferredAccent?: "uk" | "us" | "any";
  /** The submitted answer is being reviewed and must not be sent again. */
  locked?: boolean;
}

export function AudioRecallCard({
  exercise,
  onAnswer,
  autoplay = true,
  preferredAccent = "uk",
  locked = false,
}: AudioRecallCardProps) {
  const [spelling, setSpelling] = useState("");
  const [hintRevealed, setHintRevealed] = useState(false);

  const audioRefs: DictionaryAudioRef[] = [
    { ref: exercise.payload.audioRef, label: exercise.payload.audioLabel, accent: "other" },
  ];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked || !spelling.trim()) return;
    onAnswer(spelling);
  }

  const hint = exercise.payload.hint;
  const inputId = `audio-recall-${exercise.id}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="object-surface motion-enter mx-auto flex max-w-xl flex-col gap-5 bg-surface-1 p-6"
    >
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="learning-trace-label text-xs font-semibold text-accent">Audio recall</span>
        <p className="text-sm text-muted">Listen to the word, then type the spelling.</p>
        <PronunciationControls
          audioRefs={audioRefs}
          autoPlayKey={autoplay ? exercise.id : null}
          preferredAccent={preferredAccent}
          size="md"
          className="justify-center"
        />
      </header>

      <label htmlFor={inputId} className="sr-only">
        Spelling
      </label>
      <input
        id={inputId}
        type="text"
        // biome-ignore lint/a11y/noAutofocus: focus is the kid-friendly affordance for a recall card
        autoFocus
        value={spelling}
        onChange={(e) => setSpelling(e.target.value)}
        disabled={locked}
        placeholder="Type the word…"
        className={cn(
          "ui-focus-ring w-full rounded-control border border-border-strong bg-surface-0 px-4 py-3 text-center text-2xl font-semibold",
          "focus:border-accent",
          "disabled:cursor-not-allowed disabled:opacity-60",
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
        <Button type="submit" variant="primary" size="lg" disabled={locked || !spelling.trim()}>
          Check
        </Button>
      </div>
    </form>
  );
}
