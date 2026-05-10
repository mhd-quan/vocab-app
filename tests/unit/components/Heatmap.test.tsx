import { bucketByDay } from "@/modules/analytics";
import { Heatmap } from "@/ui/components/Heatmap";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("Heatmap", () => {
  it("renders an empty placeholder when no cells", () => {
    render(<Heatmap cells={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("renders title + caption when supplied", () => {
    const cells = bucketByDay({
      eventTimestamps: [],
      now: new Date(2026, 4, 10),
      days: 14,
    });
    render(<Heatmap cells={cells} title="Activity" caption="14 days" />);
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("14 days")).toBeInTheDocument();
  });

  it("each non-empty cell carries an accessible date+count tooltip", () => {
    const cells = bucketByDay({
      eventTimestamps: [new Date(2026, 4, 10)],
      now: new Date(2026, 4, 10),
      days: 1,
    });
    const { container } = render(<Heatmap cells={cells} />);
    const titled = container.querySelector('[title*="2026-05-10"]');
    expect(titled).not.toBeNull();
    expect(titled?.getAttribute("title")).toContain("1 event");
  });
});
