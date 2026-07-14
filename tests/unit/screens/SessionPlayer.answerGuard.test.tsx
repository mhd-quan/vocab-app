import type { AudioRecallExercise, PronunciationExercise } from "@/modules/exercises";
import { SessionPlayer, type SessionResult } from "@/ui/screens/student/session/SessionPlayer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recorderMock = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@/ui/screens/student/pronunciation/usePronunciationRecorder", () => ({
  usePronunciationRecorder: () => ({
    state: "recording" as const,
    durationMs: 600,
    recording: null,
    error: null,
    permission: null,
    maxDurationMs: 10_000,
    start: recorderMock.start,
    stop: recorderMock.stop,
    reset: recorderMock.reset,
  }),
}));

const source = {
  track: "curated" as const,
  sourceKey: "entry:1",
  entryId: 1,
};

const audioRecallExercise: AudioRecallExercise = {
  id: "audio-recall:entry:1:guard-test",
  kind: "audio_recall",
  entryId: 1,
  source,
  payload: {
    audioRef: "audio/relative.mp3",
    audioLabel: "Listen",
    expectedSpelling: "relative",
    displayHeadword: "relative",
    hint: { pos: "noun", gloss: "người thân" },
  },
};

const pronunciationExercise: PronunciationExercise = {
  id: "pronunciation:entry:1:guard-test",
  kind: "pronunciation",
  entryId: 1,
  source,
  payload: {
    headword: "relative",
    ipa: "/ˈrelətɪv/",
    referenceAudio: [],
    passingScore: 70,
  },
};

const pronunciationStatus = {
  available: true,
  backend: "deterministic" as const,
  executionProvider: "cpu" as const,
  modelFamily: "hubert" as const,
  modelId: "guard-test",
  platform: "test" as const,
  arch: "test",
  modelPath: "/tmp/guard-test.onnx",
  modelPresent: true,
  localOnly: true,
  reason: null,
};

function withQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderPlayer(
  deck: AudioRecallExercise[] | PronunciationExercise[],
  onResult: (result: SessionResult) => undefined,
) {
  return render(
    withQueryClient(
      <SessionPlayer
        deck={deck}
        onExit={vi.fn()}
        onResult={onResult}
        autoplay={false}
        studentId={1}
        sessionId={7}
      />,
    ),
  );
}

beforeEach(() => {
  recorderMock.start.mockReset().mockResolvedValue(true);
  recorderMock.stop.mockReset().mockResolvedValue({
    audioPcm: new Float32Array([0.1, -0.1]),
    sampleRate: 16_000,
    durationMs: 600,
  });
  recorderMock.reset.mockReset().mockResolvedValue(undefined);
});

describe("SessionPlayer answer guard", () => {
  it("persists one audio-recall answer when two submits arrive in the same render", async () => {
    const onResult = vi.fn();
    renderPlayer([audioRecallExercise], onResult);

    const input = screen.getByRole("textbox", { name: "Spelling" });
    fireEvent.change(input, { target: { value: "relative" } });
    const form = input.closest("form");
    expect(form).not.toBeNull();

    act(() => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("opens a fresh pronunciation attempt after needsRetry, then locks a passing attempt", async () => {
    const assessSpy = vi
      .spyOn(window.api.pronunciation, "assess")
      .mockResolvedValueOnce(pronunciationResult(48, true))
      .mockResolvedValueOnce(pronunciationResult(91, false));
    const onResult = vi.fn();
    renderPlayer([pronunciationExercise], onResult);

    fireEvent.click(screen.getByRole("button", { name: "Stop and check" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult.mock.calls[0]?.[0].outcome.needsRetry).toBe(true);
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop and check" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Stop and check" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(onResult.mock.calls[1]?.[0].outcome.correct).toBe(true);
    expect(screen.getByRole("button", { name: "Stop and check" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(assessSpy).toHaveBeenCalledTimes(2);

    assessSpy.mockRestore();
  });
});

function pronunciationResult(overallScore: number, retryRequired: boolean) {
  return {
    ok: true as const,
    status: pronunciationStatus,
    assessment: {
      target: {
        text: "relative",
        phonemes: ["R"],
        stressPattern: [1 as const],
        source: "heuristic" as const,
      },
      backend: "deterministic" as const,
      executionProvider: "cpu" as const,
      modelUsed: false,
      durationMs: 600,
      overallScore,
      phonemeScore: overallScore,
      stressScore: overallScore,
      passingScore: 70,
      errorRate: Math.max(0, 1 - overallScore / 100),
      retryRequired,
      guardrails: [],
      audioQuality: null,
      phonemes: [],
      stress: {
        expectedStress: [1 as const],
        observedStress: [1 as const],
        score: overallScore,
        issue: "ok" as const,
      },
      feedback: [],
    },
  };
}
