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
    const { container } = render(<Avatar name="Alice Cooper" color="#1a2b3c" />);
    const span = screen.getByText("AC");
    expect(span).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ backgroundColor: "#1a2b3c" });
  });

  it("falls back to the surface tone when no color is provided", () => {
    render(<Avatar name="Bob" />);
    const span = screen.getByText("B");
    // No inline color in the surface fallback path.
    expect(span.getAttribute("style")).toBeNull();
  });

  it("renders emoji avatar seeds ahead of initials", () => {
    render(<Avatar name="Alice Cooper" avatarSeed="emoji:🔥" color="#1a2b3c" />);
    expect(screen.getByText("🔥")).toBeInTheDocument();
    expect(screen.queryByText("AC")).toBeNull();
  });

  it("renders image avatar seeds without applying an inline background color", () => {
    const dataUrl = "data:image/png;base64,abc";
    const { container } = render(
      <Avatar name="Alice Cooper" avatarSeed={`image:${dataUrl}`} color="#1a2b3c" />,
    );

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", dataUrl);
    expect(img?.parentElement).not.toHaveStyle({ backgroundColor: "#1a2b3c" });
  });

  it("falls back to unified glyph initials for legacy pet avatar seeds", () => {
    const { container } = render(
      <Avatar name="Alice Cooper" avatarSeed="pet:nova" color="#1a2b3c" />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("AC")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ backgroundColor: "#1a2b3c" });
  });
});
