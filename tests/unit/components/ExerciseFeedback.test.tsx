import type { DefinitionMatchExercise, SentenceRebuildExercise } from "@/modules/exercises";
import { DefinitionMatchCard } from "@/ui/student/exercises/DefinitionMatchCard";
import { SentenceRebuildCard } from "@/ui/student/exercises/SentenceRebuildCard";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const matchExercise: DefinitionMatchExercise = {
  id: "match:test",
  kind: "definition_match",
  entryId: 1,
  source: { track: "curated", sourceKey: "word1", entryId: 1 },
  payload: {
    headwords: ["word1", "word2", "word3", "word4"],
    items: [
      { pairId: "p1", headword: "word1", definition: "definition one" },
      { pairId: "p2", headword: "word2", definition: "definition two" },
      { pairId: "p3", headword: "word3", definition: "definition three" },
      { pairId: "p4", headword: "word4", definition: "definition four" },
    ],
  },
};

const sentenceExercise: SentenceRebuildExercise = {
  id: "sentence:test",
  kind: "sentence_rebuild",
  entryId: 1,
  source: { track: "curated", sourceKey: "word1", entryId: 1 },
  payload: {
    headword: "word1",
    scrambled: ["today.", "word1", "learn", "I"],
    correctOrder: ["I", "learn", "word1", "today."],
  },
};

describe("exercise feedback polish", () => {
  it("definition matching shows the correct answer after a wrong submit", () => {
    const { rerender } = render(
      <DefinitionMatchCard exercise={matchExercise} outcome={null} onAnswer={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "word2" }));
    fireEvent.click(screen.getByRole("button", { name: /definition one/i }));

    rerender(
      <DefinitionMatchCard
        exercise={matchExercise}
        outcome={{ correct: false, feedback: "Try again", selfGrade: null, selectedIndex: null }}
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getByText(/Correct: word1/i)).toBeInTheDocument();
  });

  it("sentence rebuild shows the canonical sentence after a wrong submit", () => {
    const { rerender } = render(
      <SentenceRebuildCard exercise={sentenceExercise} outcome={null} onAnswer={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "today." }));
    fireEvent.click(screen.getByRole("button", { name: "word1" }));
    fireEvent.click(screen.getByRole("button", { name: "learn" }));
    fireEvent.click(screen.getByRole("button", { name: "I" }));

    rerender(
      <SentenceRebuildCard
        exercise={sentenceExercise}
        outcome={{ correct: false, feedback: "Not quite", selfGrade: null, selectedIndex: null }}
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getByText(/Correct sentence/i)).toBeInTheDocument();
    expect(screen.getAllByText("I").length).toBeGreaterThanOrEqual(1);
  });
});
