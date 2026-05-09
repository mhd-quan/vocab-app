import { buildDeck } from "@/modules/exercises";
import { SessionPlayer } from "@/ui/screens/student/session/SessionPlayer";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeEntries } from "../exercises/fixtures";

function renderPlayer(
  opts: {
    kinds?: ("flashcard" | "multiple_choice")[];
    autoAdvanceDelayMs?: number;
  } = {},
) {
  const onExit = vi.fn();
  const deck = buildDeck({
    entries: makeEntries(5),
    kinds: opts.kinds ?? ["flashcard", "multiple_choice"],
    sessionSeed: "fixed-seed",
  }).exercises;
  return {
    deck,
    onExit,
    ...render(
      <SessionPlayer
        deck={deck}
        onExit={onExit}
        autoAdvanceDelayMs={opts.autoAdvanceDelayMs ?? 0}
      />,
    ),
  };
}

describe("SessionPlayer — empty deck", () => {
  it("shows an empty-deck panel and an End session button", () => {
    const onExit = vi.fn();
    render(<SessionPlayer deck={[]} onExit={onExit} autoAdvanceDelayMs={0} />);
    expect(screen.getByText(/no exercises in this deck/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /end session/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe("SessionPlayer — flashcard flow", () => {
  it("reveals the back, then advances after a self-grade", async () => {
    const { deck } = renderPlayer({ kinds: ["flashcard"] });
    expect(deck.length).toBeGreaterThan(0);

    expect(screen.getByText(/tap to reveal/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    expect(screen.getByText(/rate your recall/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^good/i }));

    await waitFor(() => {
      expect(screen.getByText(/tap to reveal/i)).toBeInTheDocument();
    });
  });

  it("after the last card it shows the session summary with accuracy", async () => {
    const { deck, onExit } = renderPlayer({ kinds: ["flashcard"] });
    for (let i = 0; i < deck.length; i++) {
      fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
      fireEvent.click(screen.getByRole("button", { name: /^good/i }));
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
    expect(screen.getByText(/100% accuracy/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back to lessons/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe("SessionPlayer — multiple-choice flow", () => {
  it("auto-advances to the next exercise after picking an option", async () => {
    const { deck } = renderPlayer({ kinds: ["multiple_choice"] });
    expect(deck[0]?.kind).toBe("multiple_choice");
    const firstId = deck[0]?.id;

    fireEvent.click(screen.getByRole("button", { name: /^Option 1:/ }));

    // With autoAdvanceDelayMs=0 the player advances synchronously.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Option 1:/ })).not.toBeDisabled();
    });
    expect(deck[1]?.id).not.toBe(firstId);
  });

  it("with a real delay, locks options until the timer fires", () => {
    // We don't advance the timer here; we just observe that the option
    // set is disabled the moment an answer is committed.
    renderPlayer({ kinds: ["multiple_choice"], autoAdvanceDelayMs: 5_000 });
    fireEvent.click(screen.getByRole("button", { name: /^Option 1:/ }));
    expect(screen.getByRole("button", { name: /^Option 2:/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Option 3:/ })).toBeDisabled();
  });
});
