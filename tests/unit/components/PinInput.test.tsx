import { PinInput } from "@/ui/components/PinInput";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("PinInput", () => {
  it("uses control geometry and exposes its invalid state", () => {
    render(<PinInput aria-label="PIN" invalid />);

    const input = screen.getByLabelText("PIN");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("ui-focus-ring", "rounded-control");
    expect(input).not.toHaveClass("rounded-xl", "focus-visible:outline-none");
  });

  it("preserves an explicit aria-invalid value", () => {
    render(<PinInput aria-label="PIN" aria-invalid="grammar" />);

    expect(screen.getByLabelText("PIN")).toHaveAttribute("aria-invalid", "grammar");
  });
});
