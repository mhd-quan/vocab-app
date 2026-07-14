import { Avatar, computeInitials } from "@/ui/components/Avatar";
import { PROFILE_COLORS } from "@/ui/design/profileColors";
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
    expect(container.firstElementChild).toHaveStyle({ color: "#fcfcfa" });
  });

  it("uses dark ink on a bright profile color", () => {
    const { container } = render(<Avatar name="Alice Cooper" color="#ff9f0a" />);
    expect(container.firstElementChild).toHaveStyle({ color: "#222220" });
  });

  it.each(PROFILE_COLORS)("keeps initials readable on the $name identity swatch", ({ value }) => {
    const { container } = render(<Avatar name="Alice Cooper" color={value} />);
    const foreground = getComputedStyle(container.firstElementChild as Element).color;
    expect(contrastRatio(value, foreground)).toBeGreaterThanOrEqual(4.5);
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

  it("falls back to initials for unsupported glyph avatar seeds", () => {
    const { container } = render(
      <Avatar name="Alice Cooper" avatarSeed="glyph:flame" color="#1a2b3c" />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("AC")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ backgroundColor: "#1a2b3c" });
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

  it("falls back to initials for legacy pet avatar seeds", () => {
    const { container } = render(
      <Avatar name="Alice Cooper" avatarSeed="pet:nova" color="#1a2b3c" />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("AC")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ backgroundColor: "#1a2b3c" });
  });
});

function contrastRatio(background: string, foreground: string): number {
  const backgroundLuminance = luminance(parseColor(background));
  const foregroundLuminance = luminance(parseColor(foreground));
  const lighter = Math.max(backgroundLuminance, foregroundLuminance);
  const darker = Math.min(backgroundLuminance, foregroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColor(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)) as [
      number,
      number,
      number,
    ];
  }
  const channels = color.match(/\d+/g)?.slice(0, 3).map(Number);
  return (channels ?? [0, 0, 0]) as [number, number, number];
}

function luminance(channels: [number, number, number]): number {
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}
