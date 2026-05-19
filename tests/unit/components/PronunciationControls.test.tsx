import { PronunciationControls } from "@/ui/components/PronunciationControls";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const playMock = vi.fn().mockResolvedValue(undefined);
const pauseMock = vi.fn();

class AudioMock {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string;

  constructor(src: string) {
    this.src = src;
  }

  play = playMock;
  pause = pauseMock;
}

function renderControls() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PronunciationControls
        audioRefs={[
          { ref: "word__gb_1.mp3", label: "UK 1", accent: "uk" },
          { ref: "word__gb_2.mp3", label: "UK 2", accent: "uk" },
          { ref: "word__us_1.mp3", label: "US 1", accent: "us" },
        ]}
        preferredAccent="uk"
        hotkeys={{ uk: "k", us: "u" }}
      />
    </QueryClientProvider>,
  );
}

describe("PronunciationControls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    playMock.mockClear();
    pauseMock.mockClear();
  });

  it("renders one visible button per UK/US accent and plays the hotkey accent", async () => {
    vi.spyOn(window.api.dictionary, "audio").mockImplementation(async ({ ref }) => ({
      dataUrl: `data:audio/mpeg;base64,${ref}`,
      mime: "audio/mpeg",
    }));
    vi.stubGlobal("Audio", AudioMock);

    renderControls();

    expect(await screen.findByRole("button", { name: /UK K/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /US U/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);

    fireEvent.keyDown(window, { key: "u" });

    await waitFor(() =>
      expect(playMock.mock.contexts.at(-1)).toMatchObject({
        src: "data:audio/mpeg;base64,word__us_1.mp3",
      }),
    );
  });
});
