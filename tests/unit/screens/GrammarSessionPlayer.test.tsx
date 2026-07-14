import { buildGrammarDeck } from "@/modules/grammarPractice";
import { GrammarSessionPlayer } from "@/ui/screens/student/session/GrammarSessionPlayer";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GrammarTopicForPractice } from "../../../electron/db/repositories/grammar";

const epoch = new Date(0);

function topic(): GrammarTopicForPractice {
  return {
    id: 1,
    lessonId: 2,
    sourceId: "present-simple",
    slug: "present-simple",
    title: "Present simple",
    summaryMd: "Habits and routines.",
    explanationMd: "Use the base verb; add -s for he/she/it.",
    difficulty: 1,
    tags: ["tense"],
    metadata: {
      patterns: [{ form: "he/she/it + verb-s", use: "routines" }],
      common_mistakes: [{ wrong: "She go.", correct: "She goes." }],
      activities: [
        {
          kind: "fill_blank",
          sentence: "She {{goes}} to school every day.",
          explanation: "Third person singular takes -s.",
        },
      ],
    },
    contentHash: "hash",
    createdAt: epoch,
    updatedAt: epoch,
    contentItemId: 99,
  };
}

describe("GrammarSessionPlayer", () => {
  it("starts from an overview, then records grammar practice results", async () => {
    const topics = [topic()];
    const deck = buildGrammarDeck({ topics, sessionSeed: "fixed", shuffle: false }).exercises;
    const onResult = vi.fn();
    render(
      <GrammarSessionPlayer
        topics={topics}
        deck={deck}
        onExit={vi.fn()}
        onResult={onResult}
        soundEnabled={false}
      />,
    );

    expect(screen.getByText(/Grammar overview/i)).toBeInTheDocument();
    expect(screen.getByText("Present simple")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start practice/i }));
    const card = screen.getByText(/Complete the sentence/i).closest("section");
    if (!card) throw new Error("practice card not found");
    fireEvent.change(within(card).getByPlaceholderText(/missing words/i), {
      target: { value: "goes" },
    });
    fireEvent.click(within(card).getByRole("button", { name: /Check/i }));

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult.mock.calls[0]?.[0]).toMatchObject({
      contentItemId: 99,
      kind: "grammar_fill_blank",
      outcome: { correct: true },
    });
  });
});
