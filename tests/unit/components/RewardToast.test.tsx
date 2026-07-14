import { RewardToast } from "@/ui/components/rewards";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("RewardToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the title and description", () => {
    render(
      <RewardToast
        id="t1"
        title="On a roll"
        description="Five in a row"
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByText("On a roll")).toBeInTheDocument();
    expect(screen.getByText("Five in a row")).toBeInTheDocument();
  });

  it("calls onDismiss after the duration elapses", () => {
    const onDismiss = vi.fn();
    render(<RewardToast id="t1" title="Hi" durationMs={1000} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    // 1000ms duration + 220ms slide-out → onDismiss called.
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does NOT auto-dismiss when durationMs is Infinity", () => {
    const onDismiss = vi.fn();
    render(
      <RewardToast
        id="t1"
        title="Sticky"
        durationMs={Number.POSITIVE_INFINITY}
        onDismiss={onDismiss}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("stamps a stable test id from the toast id", () => {
    render(<RewardToast id="streak_5" title="Five" onDismiss={() => undefined} />);
    expect(screen.getByTestId("reward-toast-streak_5")).toBeInTheDocument();
  });

  it("has aria-live=polite for screen readers", () => {
    render(<RewardToast id="x" title="Hi" onDismiss={() => undefined} />);
    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(toast).toHaveClass("motion-reduce:translate-y-0", "motion-reduce:transition-none");
  });
});
