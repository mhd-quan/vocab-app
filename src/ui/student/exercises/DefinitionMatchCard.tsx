/**
 * Definition matching card — pair 4 headwords with 4 definitions.
 *
 * Why click-to-pair (not drag-drop):
 *   - Works on touch + keyboard + mouse with no dependency.
 *   - dnd-kit/sortable will likely layer in for a polish pass; the
 *     output shape (`assignments: { definitionPairId, headword }[]`)
 *     does not change.
 *
 * UX:
 *   - Tap a headword chip → it becomes "selected".
 *   - Tap a definition slot → assigns the selected headword to that
 *     slot (replacing any previous assignment for either side).
 *   - Tap an assigned slot → clears just that slot's assignment.
 *   - Tap an already-assigned headword chip → returns it to the pool.
 *   - Submit enabled once all four slots have a headword.
 */
import { cn } from "@/lib/cn";
import type { DefinitionMatchExercise, GradeOutcome } from "@/modules/exercises";
import { Button } from "@/ui/components/Button";
import { useMemo, useState } from "react";

export interface DefinitionMatchCardProps {
  exercise: DefinitionMatchExercise;
  onAnswer: (assignments: Array<{ definitionPairId: string; headword: string }>) => void;
  outcome: GradeOutcome | null;
}

export function DefinitionMatchCard({ exercise, onAnswer, outcome }: DefinitionMatchCardProps) {
  const items = exercise.payload.items;
  const headwords = useMemo(
    () =>
      exercise.payload.headwords?.length
        ? exercise.payload.headwords
        : items.map((it) => it.headword),
    [exercise.payload.headwords, items],
  );
  const [selectedHeadword, setSelectedHeadword] = useState<string | null>(null);
  /** pairId → assigned headword (or null/missing if empty). */
  const [assignments, setAssignments] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(items.map((it) => [it.pairId, null])),
  );
  const locked = outcome !== null;
  const correctByPair = useMemo(
    () => new Map(items.map((item) => [item.pairId, item.headword])),
    [items],
  );

  const assignedHeadwords = useMemo(
    () => new Set(Object.values(assignments).filter((h): h is string => !!h)),
    [assignments],
  );

  function selectHeadword(headword: string) {
    if (locked) return;
    // Tapping an assigned chip frees it back to the pool.
    if (assignedHeadwords.has(headword)) {
      setAssignments((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k] === headword) next[k] = null;
        }
        return next;
      });
      if (selectedHeadword === headword) setSelectedHeadword(null);
      return;
    }
    setSelectedHeadword((cur) => (cur === headword ? null : headword));
  }

  function dropOnSlot(pairId: string) {
    if (locked) return;
    if (!selectedHeadword) {
      // Tap on an already-assigned slot clears it.
      if (assignments[pairId]) {
        setAssignments((prev) => ({ ...prev, [pairId]: null }));
      }
      return;
    }
    setAssignments((prev) => {
      const next = { ...prev };
      // Detach the selected headword from any other slot first.
      for (const k of Object.keys(next)) {
        if (next[k] === selectedHeadword) next[k] = null;
      }
      next[pairId] = selectedHeadword;
      return next;
    });
    setSelectedHeadword(null);
  }

  function submit() {
    if (locked) return;
    const filled = items
      .map((it) => ({ definitionPairId: it.pairId, headword: assignments[it.pairId] ?? "" }))
      .filter((a) => a.headword.length > 0);
    if (filled.length !== items.length) return;
    onAnswer(filled);
  }

  const allFilled = items.every((it) => assignments[it.pairId]);

  return (
    <section className="object-surface motion-enter mx-auto flex max-w-4xl flex-col gap-5 bg-surface-1 p-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="text-xs font-semibold text-accent">Match definitions</span>
        <p className="text-sm text-muted">
          {locked
            ? outcome.correct
              ? "All matches are correct."
              : "Review the red cards, then look at the correct word shown underneath."
            : "Tap a word, then tap the matching definition. Match all four to submit."}
        </p>
      </header>

      <div className="flex flex-wrap justify-center gap-2" aria-label="Headwords">
        {headwords.map((headword) => {
          const inUse = assignedHeadwords.has(headword);
          const isSelected = selectedHeadword === headword;
          return (
            <button
              key={headword}
              type="button"
              onClick={() => selectHeadword(headword)}
              disabled={locked}
              aria-pressed={isSelected}
              className={cn(
                "rounded-chip border px-4 py-2 text-base font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-focus/40 disabled:cursor-default",
                isSelected
                  ? "border-accent bg-accent text-accent-fg"
                  : inUse
                    ? "border border-border-subtle bg-surface-2 text-muted line-through"
                    : "border border-border-strong bg-surface-1 hover:border-accent",
              )}
            >
              {headword}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const assigned = assignments[item.pairId];
          const correctHeadword = correctByPair.get(item.pairId) ?? item.headword;
          const isCorrect = locked && assigned?.toLowerCase() === correctHeadword.toLowerCase();
          const isWrong = locked && assigned !== null && !isCorrect;
          return (
            <button
              key={item.pairId}
              type="button"
              onClick={() => dropOnSlot(item.pairId)}
              disabled={locked}
              className={cn(
                "ui-focus-ring flex min-h-36 w-full flex-col items-start gap-2 rounded-control border bg-surface-2 px-4 py-3 text-left transition-colors disabled:cursor-default",
                !locked && assigned ? "border-accent" : "border-border-strong",
                !selectedHeadword && !assigned && "opacity-90",
                isCorrect && "answer-correct border-success/70 bg-success/10",
                isWrong && "answer-wrong border-danger/70 bg-danger/10",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2 text-xs text-muted">
                <span>Definition</span>
                {isCorrect ? <span className="text-success">Correct</span> : null}
                {isWrong ? <span className="text-danger">Review</span> : null}
              </span>
              <span className="ui-lexical text-sm leading-6">{item.definition}</span>
              <span
                className={cn(
                  "mt-1 text-base font-semibold",
                  assigned && !locked ? "text-accent" : "text-muted-2",
                  isCorrect && "text-success",
                  isWrong && "text-danger line-through",
                )}
              >
                {assigned ?? "(tap a word above)"}
              </span>
              {isWrong ? (
                <span className="text-sm font-semibold text-success">
                  Correct: {correctHeadword}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          onClick={submit}
          disabled={!allFilled || locked}
          variant="primary"
          size="lg"
        >
          {locked ? (outcome.correct ? "Correct" : "Reviewing") : "Check"}
        </Button>
      </div>
    </section>
  );
}
