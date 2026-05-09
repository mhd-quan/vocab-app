import { AppModeProvider, useAppMode } from "@/providers/AppModeProvider";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppModeProvider>{children}</AppModeProvider>
);

describe("AppModeProvider", () => {
  beforeEach(() => {
    vi.spyOn(window.api.auth, "hasPin").mockResolvedValue(false);
    vi.spyOn(window.api.auth, "verifyPin").mockResolvedValue({ ok: true });
    vi.spyOn(window.api.auth, "setupPin").mockResolvedValue({ ok: true });
    vi.spyOn(window.api.auth, "changePin").mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in `loading` and resolves to `locked` once hasPin probe finishes", async () => {
    const { result } = renderHook(() => useAppMode(), { wrapper });
    expect(result.current.mode).toBe("loading");
    expect(result.current.pinReady).toBe(false);
    await waitFor(() => expect(result.current.mode).toBe("locked"));
    expect(result.current.pinReady).toBe(true);
    expect(result.current.hasPin).toBe(false);
  });

  it("setupPin transitions mode → tutor and flips hasPin", async () => {
    const { result } = renderHook(() => useAppMode(), { wrapper });
    await waitFor(() => expect(result.current.mode).toBe("locked"));
    await act(async () => {
      await result.current.setupPin("1234");
    });
    expect(result.current.mode).toBe("tutor");
    expect(result.current.hasPin).toBe(true);
  });

  it("unlockTutor success transitions to tutor mode", async () => {
    vi.spyOn(window.api.auth, "hasPin").mockResolvedValue(true);
    const { result } = renderHook(() => useAppMode(), { wrapper });
    await waitFor(() => expect(result.current.mode).toBe("locked"));
    await act(async () => {
      const r = await result.current.unlockTutor("1234");
      expect(r.ok).toBe(true);
    });
    expect(result.current.mode).toBe("tutor");
  });

  it("unlockTutor failure leaves mode as locked", async () => {
    vi.spyOn(window.api.auth, "hasPin").mockResolvedValue(true);
    vi.spyOn(window.api.auth, "verifyPin").mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    const { result } = renderHook(() => useAppMode(), { wrapper });
    await waitFor(() => expect(result.current.mode).toBe("locked"));
    await act(async () => {
      const r = await result.current.unlockTutor("9999");
      expect(r.ok).toBe(false);
    });
    expect(result.current.mode).toBe("locked");
  });

  it("enterStudent + lock + switchToStudent control mode transitions", async () => {
    const { result } = renderHook(() => useAppMode(), { wrapper });
    await waitFor(() => expect(result.current.mode).toBe("locked"));

    act(() => result.current.enterStudent());
    expect(result.current.mode).toBe("student");

    act(() => result.current.lock());
    expect(result.current.mode).toBe("locked");

    await act(async () => {
      await result.current.setupPin("1234");
    });
    expect(result.current.mode).toBe("tutor");

    act(() => result.current.switchToStudent());
    expect(result.current.mode).toBe("student");
  });

  it("throws if useAppMode is called outside the provider", () => {
    const original = console.error;
    console.error = () => undefined; // hide React's error boundary noise
    try {
      expect(() =>
        render(<UseAppModeProbe />, {
          wrapper: ({ children }) => <>{children}</>,
        }),
      ).toThrow(/AppModeProvider/);
    } finally {
      console.error = original;
    }
  });
});

function UseAppModeProbe() {
  const { mode } = useAppMode();
  return <span>{mode}</span>;
}

// Silence unused-import from `screen` while keeping it ergonomic if the test
// suite expands.
void screen;
