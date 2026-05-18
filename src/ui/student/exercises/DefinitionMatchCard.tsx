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
import type { DefinitionMatchExercise } from "@/modules/exercises";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { useMemo, useState } from "react";

export interface DefinitionMatchCardProps {
  exercise: DefinitionMatchExercise;
  onAnswer: (assignments: Array<{ definitionPairId: string; headword: string }>) => void;
}

export function DefinitionMatchCard({ exercise, onAnswer }: DefinitionMatchCardProps) {
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

  const assignedHeadwords = useMemo(
    () => new Set(Object.values(assignments).filter((h): h is string => !!h)),
    [assignments],
  );

  function selectHeadword(headword: string) {
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
    const filled = items
      .map((it) => ({ definitionPairId: it.pairId, headword: assignments[it.pairId] ?? "" }))
      .filter((a) => a.headword.length > 0);
    if (filled.length !== items.length) return;
    onAnswer(filled);
  }

  const allFilled = items.every((it) => assignments[it.pairId]);

  return (
    <section className="motion-enter mx-auto flex max-w-2xl flex-col gap-5 rounded-bento border border-border-subtle bg-surface-1 p-6 shadow-card">
      <header className="flex flex-col items-center gap-3 text-center">
        <Badge tone="accent" uppercase>
          Match definitions
        </Badge>
        <p className="text-sm text-muted">
          Tap a word, then tap the matching definition. Match all four to submit.
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
              className={cn(
                "press-bounce rounded-chip px-4 py-2 text-base font-semibold transition",
                isSelected
                  ? "border-2 border-accent bg-accent text-accent-fg shadow-press-active"
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

      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const assigned = assignments[item.pairId];
          return (
            <button
              key={item.pairId}
              type="button"
              onClick={() => dropOnSlot(item.pairId)}
              className={cn(
                "flex w-full flex-col items-start gap-1 rounded-bento border-2 border-dashed bg-surface-2 px-4 py-3 text-left transition",
                assigned ? "border-accent" : "border-border-strong",
                !selectedHeadword && !assigned && "opacity-90",
              )}
            >
              <span className="text-xs uppercase tracking-wide text-muted">Definition</span>
              <span className="text-sm">{item.definition}</span>
              <span
                className={cn(
                  "mt-1 text-base font-semibold",
                  assigned ? "text-accent" : "text-muted-2",
                )}
              >
                {assigned ?? "(tap a word above)"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <Button type="button" onClick={submit} disabled={!allFilled} variant="primary" size="lg">
          Check
        </Button>
      </div>
    </section>
  );
}
