import { AppModeProvider, useAppMode } from "@/providers/AppModeProvider";
import { WelcomeScreen } from "@/ui/screens/WelcomeScreen";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function ModeProbe() {
  const { mode } = useAppMode();
  return <span data-testid="mode">{mode}</span>;
}

function renderWelcome() {
  return render(
    <AppModeProvider initialMode="welcome" initialHasPin>
      <WelcomeScreen />
      <ModeProbe />
    </AppModeProvider>,
  );
}

describe("WelcomeScreen", () => {
  it("keeps mode selection inside the desktop window frame", () => {
    renderWelcome();

    expect(screen.getByRole("heading", { name: "Vocab" })).toBeInTheDocument();
    expect(screen.getByText("Welcome").closest("[data-window-chrome]")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tutor" })).toHaveAccessibleDescription(
      "Manage students, content, and progress",
    );
    expect(screen.getByRole("button", { name: "Student" })).toBeInTheDocument();
  });

  it("routes the tutor choice through the app mode provider", () => {
    renderWelcome();

    fireEvent.click(screen.getByRole("button", { name: "Tutor" }));
    expect(screen.getByTestId("mode")).toHaveTextContent("locked");
  });
});
