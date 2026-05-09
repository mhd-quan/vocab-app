import { ClozeText, parseSegments } from "@/ui/components/ClozeText";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("parseSegments", () => {
  it("splits a single-cloze sentence into prefix + cloze + suffix", () => {
    const segs = parseSegments("I have many {{relatives}} in Hanoi.");
    expect(segs).toEqual([
      { text: "I have many ", cloze: false },
      { text: "relatives", cloze: true },
      { text: " in Hanoi.", cloze: false },
    ]);
  });

  it("trims whitespace inside markers", () => {
    const segs = parseSegments("see {{   the cat   }} sit.");
    const cloze = segs.find((s) => s.cloze);
    expect(cloze?.text).toBe("the cat");
  });

  it("returns the whole text as one non-cloze segment when no markers exist", () => {
    expect(parseSegments("Plain sentence.")).toEqual([{ text: "Plain sentence.", cloze: false }]);
  });

  it("preserves multiple markers (degrade-gracefully path)", () => {
    const segs = parseSegments("Has {{a}} and {{b}} markers.");
    expect(segs.filter((s) => s.cloze).map((s) => s.text)).toEqual(["a", "b"]);
  });
});

describe("ClozeText", () => {
  it("renders the cloze span with data-cloze=true and shows the word", () => {
    render(<ClozeText text="I have many {{relatives}} here." />);
    const cloze = screen.getByText("relatives");
    expect(cloze).toHaveAttribute("data-cloze", "true");
    // The surrounding text is also present.
    expect(screen.getByText(/I have many/)).toBeInTheDocument();
    expect(screen.getByText(/here\./)).toBeInTheDocument();
  });

  it("masks the cloze content when mode='mask'", () => {
    render(<ClozeText text="See {{cat}} sit." mode="mask" />);
    const cloze = document.querySelector('[data-cloze="true"]');
    expect(cloze).not.toBeNull();
    // Underscored placeholder; the original word is hidden.
    expect(cloze?.textContent).toMatch(/_+/);
    expect(screen.queryByText("cat")).toBeNull();
  });
});
