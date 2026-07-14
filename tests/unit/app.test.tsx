import { App } from "@/App";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("App shell smoke test", () => {
  it("renders the welcome screen before entering first-time PIN setup", async () => {
    // tests/setup.ts stubs auth.hasPin -> false, so the app now lands on
    // the mode picker before the tutor chooses PIN setup.
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: /^vocab$/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /tutor/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: /set your tutor pin/i })),
    );
    expect(screen.getByLabelText(/^new pin$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm pin$/i)).toBeInTheDocument();
  });
});
