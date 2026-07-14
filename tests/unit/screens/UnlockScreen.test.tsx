import { AppModeProvider, useAppMode } from "@/providers/AppModeProvider";
import { UnlockScreen } from "@/ui/screens/UnlockScreen";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function ModeProbe() {
  const { mode } = useAppMode();
  return <span data-testid="mode">{mode}</span>;
}

function renderWithProvider(options?: { initialMode?: "locked"; initialHasPin?: boolean }) {
  return render(
    <AppModeProvider initialMode={options?.initialMode} initialHasPin={options?.initialHasPin}>
      <UnlockScreen />
      <ModeProbe />
    </AppModeProvider>,
  );
}

describe("UnlockScreen", () => {
  beforeEach(() => {
    vi.spyOn(window.api.auth, "hasPin").mockResolvedValue(false);
    vi.spyOn(window.api.auth, "setupPin").mockResolvedValue({ ok: true });
    vi.spyOn(window.api.auth, "verifyPin").mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("on first run shows the setup form and rejects mismatched confirmations", async () => {
    renderWithProvider();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /set your tutor pin/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/^new pin$/i), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText(/^confirm pin$/i), { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: /set pin/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/do not match/i));
    expect(screen.getByLabelText(/^new pin$/i)).toHaveAccessibleDescription(/do not match/i);
    expect(screen.getByLabelText(/^confirm pin$/i)).toHaveAttribute("aria-invalid", "true");
    expect(window.api.auth.setupPin).not.toHaveBeenCalled();
  });

  it("calls setupPin when both PINs match", async () => {
    renderWithProvider();
    await waitFor(() => screen.getByRole("heading", { name: /set your tutor pin/i }));
    fireEvent.change(screen.getByLabelText(/^new pin$/i), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText(/^confirm pin$/i), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /set pin/i }));
    await waitFor(() => expect(window.api.auth.setupPin).toHaveBeenCalledWith({ pin: "1234" }));
  });

  it("when a PIN exists, shows the verify form and surfaces invalid attempts", async () => {
    vi.spyOn(window.api.auth, "hasPin").mockResolvedValue(true);
    vi.spyOn(window.api.auth, "verifyPin").mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: /welcome back/i })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/tutor pin/i), { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock tutor mode/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/incorrect/i));
  });

  it("verify form: 'Continue to student practice' switches mode to student", async () => {
    vi.spyOn(window.api.auth, "hasPin").mockResolvedValue(true);
    renderWithProvider({ initialMode: "locked", initialHasPin: true });
    await waitFor(() => screen.getByRole("heading", { name: /welcome back/i }));
    expect(screen.getByTestId("mode")).toHaveTextContent("locked");
    fireEvent.click(screen.getByRole("button", { name: /continue to student practice/i }));
    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("student"));
  });

  it("keeps the return action in the window toolbar", async () => {
    vi.spyOn(window.api.auth, "hasPin").mockResolvedValue(true);
    renderWithProvider({ initialMode: "locked", initialHasPin: true });
    await waitFor(() => screen.getByRole("heading", { name: /welcome back/i }));

    const backButton = screen.getByRole("button", { name: /back to choose mode/i });
    expect(backButton.closest("[data-window-chrome]")).toBeInTheDocument();
    fireEvent.click(backButton);

    expect(screen.getByTestId("mode")).toHaveTextContent("welcome");
  });
});
