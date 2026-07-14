import type { PronunciationAssessment } from "@/modules/pronunciation";
import { MicButton } from "@/ui/screens/student/pronunciation/MicButton";
import { MicrophonePermissionNotice } from "@/ui/screens/student/pronunciation/MicrophonePermissionNotice";
import { PhonemeRail } from "@/ui/screens/student/pronunciation/PhraseRail";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const phonemes: PronunciationAssessment["phonemes"] = [
  {
    phoneme: "TH",
    expectedIndex: 0,
    startMs: 0,
    endMs: 120,
    score: 88,
    detectedPhoneme: "TH",
    issue: "ok",
  },
  {
    phoneme: "IH",
    expectedIndex: 1,
    startMs: 120,
    endMs: 240,
    score: 54,
    detectedPhoneme: "IY",
    issue: "substitution",
  },
];

describe("pronunciation practice UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps recording state and elapsed time inside the primary action", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <MicButton state="idle" durationMs={0} maxDurationMs={10_000} onClick={onClick} />,
    );

    const start = screen.getByRole("button", { name: "Start recording" });
    expect(start).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(start);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <MicButton state="recording" durationMs={1_240} maxDurationMs={10_000} onClick={onClick} />,
    );
    const stop = screen.getByRole("button", { name: "Stop and check" });
    expect(stop).toHaveAttribute("aria-pressed", "true");
    expect(stop).toHaveTextContent("1.2s");
  });

  it("does not present deterministic preview scores as a real attempt", () => {
    const { rerender } = render(<PhonemeRail phonemes={phonemes} variant="guide" />);

    expect(screen.getByText("Sound sequence")).toBeInTheDocument();
    expect(screen.queryByText("88")).toBeNull();
    expect(screen.getByLabelText("Expected sound TH")).toBeInTheDocument();

    rerender(<PhonemeRail phonemes={phonemes} />);
    expect(screen.getByText("Sound detail")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByLabelText("Expected IH, substituted, score 54")).toBeInTheDocument();
  });

  it("keeps the system microphone recovery action attached to the warning", () => {
    const openSettings = vi
      .spyOn(window.api.permissions, "openMicrophoneSettings")
      .mockResolvedValue({ opened: true });

    render(
      <MicrophonePermissionNotice
        message="Microphone access is off."
        permission={{
          platform: "darwin",
          status: "denied",
          granted: false,
          readyForCapture: false,
          canPrompt: false,
          canOpenSettings: true,
          requiresSystemSettings: true,
          requiresRestart: true,
          reason: "Microphone access is off.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access is off.");
    fireEvent.click(screen.getByRole("button", { name: "Open microphone settings" }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});
