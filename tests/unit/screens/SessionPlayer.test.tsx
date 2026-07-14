import { buildDeck } from "@/modules/exercises";
import {
  SessionPlayer,
  type SessionResult,
  type SessionResultPersistence,
} from "@/ui/screens/student/session/SessionPlayer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { makeEntries } from "../exercises/fixtures";

/**
 * SessionPlayer pulls in `useAudioPrefetch`, which calls `useQueryClient`.
 * Wrap every render in a fresh QueryClient so the player doesn't crash on
 * mount in the jsdom test harness — production gets the renderer-wide
 * client via App.tsx.
 */
function withQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderPlayer(
  opts: {
    kinds?: ("flashcard" | "multiple_choice")[];
    autoAdvanceDelayMs?: number;
    onResult?: (result: SessionResult) => undefined | Promise<SessionResultPersistence | undefined>;
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
      withQueryClient(
        <SessionPlayer
          deck={deck}
          onExit={onExit}
          autoAdvanceDelayMs={opts.autoAdvanceDelayMs ?? 0}
          onResult={opts.onResult}
        />,
      ),
    ),
  };
}

describe("SessionPlayer — empty deck", () => {
  it("shows an empty-deck panel and an End session button", () => {
    const onExit = vi.fn();
    render(withQueryClient(<SessionPlayer deck={[]} onExit={onExit} autoAdvanceDelayMs={0} />));
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

describe("SessionPlayer — onResult callback", () => {
  it("fires onResult with entryId + outcome on each answered exercise", async () => {
    const onResult = vi.fn();
    const { deck } = renderPlayer({ kinds: ["flashcard"], onResult });
    expect(deck.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^good/i }));

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    const arg = onResult.mock.calls[0]?.[0] as
      | { kind: string; entryId: number; outcome: { correct: boolean } }
      | undefined;
    expect(arg?.kind).toBe("flashcard");
    expect(typeof arg?.entryId).toBe("number");
    expect(arg?.outcome.correct).toBe(true);
  });

  it("a throwing onResult does not block the deck (caught + logged)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onResult = vi.fn().mockRejectedValue(new Error("network down"));
    renderPlayer({ kinds: ["flashcard"], onResult });
    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^good/i }));

    await waitFor(() => {
      expect(screen.getByText(/tap to reveal/i)).toBeInTheDocument();
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("SessionPlayer — reward feedback", () => {
  it("annotates results with the in-session correct streak", async () => {
    const onResult = vi.fn();
    const { deck } = renderPlayer({ kinds: ["flashcard"], onResult });
    expect(deck.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^good/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult.mock.calls[0]?.[0].currentSessionRun).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^good/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(onResult.mock.calls[1]?.[0].currentSessionRun).toBe(2);
  });

  it("a wrong answer resets the in-session streak to 0", async () => {
    const onResult = vi.fn();
    const { deck } = renderPlayer({ kinds: ["flashcard"], onResult });
    expect(deck.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^good/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^again/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(onResult.mock.calls[1]?.[0].currentSessionRun).toBe(0);
  });

  it("renders a toast when onResult resolves with an unlocked achievement", async () => {
    const onResult = vi
      .fn()
      .mockResolvedValueOnce({ unlockedAchievements: [{ achievementId: "first_answer" }] });
    renderPlayer({ kinds: ["flashcard"], onResult });
    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^good/i }));

    await waitFor(() => {
      expect(screen.getByTestId("reward-toast-first_answer")).toBeInTheDocument();
    });
    expect(screen.getByText(/spark rookie/i)).toBeInTheDocument();
  });

  it("ignores unknown achievement ids gracefully", async () => {
    const onResult = vi
      .fn()
      .mockResolvedValueOnce({ unlockedAchievements: [{ achievementId: "does_not_exist" }] });
    renderPlayer({ kinds: ["flashcard"], onResult });
    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^good/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    // No toast for unknown id; the second card is back on screen.
    expect(screen.queryByTestId(/reward-toast-/)).toBeNull();
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
    const exerciseStage = screen.getByTestId("session-exercise-stage");
    const exerciseActions = screen.getByTestId("session-exercise-actions");
    expect(exerciseStage).toContainElement(exerciseActions);
    expect(exerciseActions).toHaveClass("mt-2");
    expect(exerciseActions).toContainElement(screen.getByRole("button", { name: "Next" }));
  });

  it("keeps graded feedback visible by default until the learner continues", () => {
    const onExit = vi.fn();
    const deck = buildDeck({
      entries: makeEntries(5),
      kinds: ["multiple_choice"],
      sessionSeed: "manual-advance",
    }).exercises;
    render(withQueryClient(<SessionPlayer deck={deck} onExit={onExit} />));
    fireEvent.click(screen.getByRole("button", { name: /^Option 1:/ }));
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Option 2:/ })).toBeDisabled();
  });
});
