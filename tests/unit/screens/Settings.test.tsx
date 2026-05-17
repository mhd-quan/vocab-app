import { AppModeProvider } from "@/providers/AppModeProvider";
import { DisplayPreferencesProvider } from "@/providers/DisplayPreferencesProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { TutorSettings } from "@/ui/screens/tutor/Settings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
      if (key === "session_default_count") return 15;
      if (key === "session_default_mode") return "mixed";
      if (key === "session_shuffle") return true;
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

    expect(document.querySelector("md-outlined-select")).toBeNull();
    expect(document.querySelector("md-outlined-text-field")).toBeNull();
    expect(document.querySelector("md-switch")).toBeNull();
  });
});
