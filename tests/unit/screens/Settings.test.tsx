import { AppModeProvider } from "@/providers/AppModeProvider";
import { DisplayPreferencesProvider } from "@/providers/DisplayPreferencesProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { TutorSettings } from "@/ui/screens/tutor/Settings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <DisplayPreferencesProvider>
          <AppModeProvider initialMode="tutor" initialHasPin>
            <TutorSettings />
          </AppModeProvider>
        </DisplayPreferencesProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("TutorSettings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses native token-aligned controls instead of partial Material custom elements", async () => {
    vi.spyOn(window.api.settings, "get").mockImplementation(async ({ key }) => {
      if (key === "theme") return "system";
      if (key === "display_font_size") return "medium";
      if (key === "pronunciation_autoplay") return true;
      if (key === "pronunciation_default_accent") return "uk";
      if (key === "session_default_count") return 15;
      if (key === "session_default_mode") return "mixed";
      if (key === "session_shuffle") return true;
      if (key === "unit_review_exclude_speaking") return false;
      if (key === "session_camera_checkins_enabled") return true;
      if (key === "session_screenshots_enabled") return false;
      if (key === "fsrs_short_term_days") return 1;
      if (key === "fsrs_long_term_days") return 21;
      return null;
    });

    renderSettings();

    await waitFor(() => expect(screen.getByText("Preferences")).toBeInTheDocument());

    expect(screen.getByLabelText("Font size").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Mode").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Short-term (days)")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Long-term (days)")).toHaveAttribute("type", "number");
    expect(screen.getByRole("switch", { name: /autoplay headword audio/i })).toBeChecked();
    expect(screen.getByLabelText("Default accent")).toHaveValue("uk");
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /camera check-ins/i })).toBeChecked(),
    );
    expect(
      screen.getByRole("switch", { name: /exclude speaking in unit review/i }),
    ).not.toBeChecked();
    expect(screen.getByRole("switch", { name: /allow screenshots/i })).not.toBeChecked();

    expect(document.querySelector("md-outlined-select")).toBeNull();
    expect(document.querySelector("md-outlined-text-field")).toBeNull();
    expect(document.querySelector("md-switch")).toBeNull();
  });

  it("saves the tutor screenshot toggle through settings", async () => {
    vi.spyOn(window.api.settings, "get").mockImplementation(async ({ key }) =>
      key === "session_screenshots_enabled" ? false : null,
    );
    const setSpy = vi.spyOn(window.api.settings, "set").mockResolvedValue({ ok: true });

    renderSettings();

    const toggle = await screen.findByRole("switch", { name: /allow screenshots/i });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(setSpy).toHaveBeenCalledWith({
        key: "session_screenshots_enabled",
        value: true,
      }),
    );
  });

  it("saves the tutor unit-review speaking exclusion toggle through settings", async () => {
    vi.spyOn(window.api.settings, "get").mockImplementation(async ({ key }) =>
      key === "unit_review_exclude_speaking" ? false : null,
    );
    const setSpy = vi.spyOn(window.api.settings, "set").mockResolvedValue({ ok: true });

    renderSettings();

    const toggle = await screen.findByRole("switch", {
      name: /exclude speaking in unit review/i,
    });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(setSpy).toHaveBeenCalledWith({
        key: "unit_review_exclude_speaking",
        value: true,
      }),
    );
  });

  it("keeps active preferences until confirmation, then resets every provider-backed value", async () => {
    vi.spyOn(window.api.settings, "get").mockImplementation(async ({ key }) => {
      if (key === "theme") return "dark";
      if (key === "display_font_size") return "large";
      if (key === "pronunciation_autoplay") return false;
      if (key === "pronunciation_default_accent") return "us";
      return null;
    });
    const deleteSpy = vi.spyOn(window.api.settings, "delete").mockResolvedValue({ ok: true });
    const setSpy = vi.spyOn(window.api.settings, "set").mockResolvedValue({ ok: true });

    renderSettings();

    const fontSize = await screen.findByLabelText("Font size");
    const autoplay = screen.getByRole("switch", { name: /autoplay headword audio/i });
    const accent = screen.getByLabelText("Default accent");
    const darkTheme = screen.getByRole("button", { name: "Dark" });
    const systemTheme = screen.getByRole("button", { name: "System" });
    await waitFor(() => {
      expect(fontSize).toHaveValue("large");
      expect(autoplay).not.toBeChecked();
      expect(accent).toHaveValue("us");
      expect(darkTheme).toHaveClass("bg-paper");
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset preferences" }));

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(fontSize).toHaveValue("large");
    expect(autoplay).not.toBeChecked();
    expect(accent).toHaveValue("us");
    expect(darkTheme).toHaveClass("bg-paper");

    fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith({ key: "pronunciation_autoplay" }));
    await waitFor(() => {
      expect(fontSize).toHaveValue("medium");
      expect(autoplay).toBeChecked();
      expect(accent).toHaveValue("uk");
      expect(systemTheme).toHaveClass("bg-paper");
    });
    expect(setSpy).not.toHaveBeenCalled();
  });
});
