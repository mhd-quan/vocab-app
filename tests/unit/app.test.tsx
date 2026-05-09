import { App } from "@/App";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("App shell smoke test", () => {
  it("renders the first-time PIN setup when no tutor PIN exists", async () => {
    // tests/setup.ts stubs auth.hasPin → false, so the unlock screen lands on
    // the setup variant. We just confirm the right tree mounted.
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /set your tutor pin/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/^new pin$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm pin$/i)).toBeInTheDocument();
  });
});
