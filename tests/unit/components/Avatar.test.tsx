import { Avatar, computeInitials } from "@/ui/components/Avatar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("computeInitials", () => {
  it("returns the first letter of one-word names", () => {
    expect(computeInitials("Alice")).toBe("A");
  });

  it("returns the first letters of the first two words", () => {
    expect(computeInitials("Alice Cooper")).toBe("AC");
    expect(computeInitials("alice b cooper")).toBe("AB");
  });

  it("trims surrounding whitespace and collapses inner spacing", () => {
    expect(computeInitials("  alice   cooper  ")).toBe("AC");
  });

  it("falls back to '?' for empty input", () => {
    expect(computeInitials("")).toBe("?");
    expect(computeInitials("   ")).toBe("?");
  });
});

describe("Avatar", () => {
  it("renders initials and applies the supplied background color", () => {
    render(<Avatar name="Alice Cooper" color="#1a2b3c" />);
    const span = screen.getByText("AC");
    expect(span).toBeInTheDocument();
    expect(span).toHaveStyle({ backgroundColor: "#1a2b3c" });
  });

  it("falls back to the surface tone when no color is provided", () => {
    render(<Avatar name="Bob" />);
    const span = screen.getByText("B");
    // No inline color in the surface fallback path.
    expect(span.getAttribute("style")).toBeNull();
  });
});
