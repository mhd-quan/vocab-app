import { bucketByDay } from "@/modules/analytics";
import { Heatmap } from "@/ui/components/Heatmap";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("surfaces the hovered day count in the header", () => {
    const cells = bucketByDay({
      eventTimestamps: [new Date(2026, 4, 10), new Date(2026, 4, 10)],
      now: new Date(2026, 4, 10),
      days: 1,
    });
    render(<Heatmap cells={cells} title="Activity" caption="1 day" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /2026-05-10/i }));
    expect(screen.getByText(/2026-05-10 · 2 practice reps/i)).toBeInTheDocument();
  });

  it("keeps heatmap interaction in place instead of scaling cells", () => {
    const cells = bucketByDay({
      eventTimestamps: [new Date(2026, 4, 10)],
      now: new Date(2026, 4, 10),
      days: 1,
    });
    render(<Heatmap cells={cells} />);
    const cell = screen.getByRole("button", { name: /2026-05-10/i });
    expect(cell.className).not.toContain("scale-");
    expect(cell.className).toContain("bg-iris/");
  });

  it("uses roomy mode to surface activity summary stats", () => {
    const cells = bucketByDay({
      eventTimestamps: [new Date(2026, 4, 8), new Date(2026, 4, 10), new Date(2026, 4, 10)],
      now: new Date(2026, 4, 10),
      days: 4,
    });
    render(<Heatmap cells={cells} title="Activity" caption="4 days" density="roomy" />);
    expect(screen.getByText("Total reps")).toBeInTheDocument();
    expect(screen.getByText("Active days")).toBeInTheDocument();
    expect(screen.getByText("Best day")).toBeInTheDocument();
    expect(screen.getByText("Last active")).toBeInTheDocument();
    expect(screen.getByText("05/10")).toBeInTheDocument();
  });

  it("uses one keyboard stop and arrow navigation across the activity grid", () => {
    const cells = bucketByDay({
      eventTimestamps: [new Date(2026, 4, 9), new Date(2026, 4, 10)],
      now: new Date(2026, 4, 10),
      days: 2,
    });
    render(<Heatmap cells={cells} title="Activity" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    const active = buttons.find((button) => button.tabIndex === 0);
    fireEvent.focus(active as HTMLButtonElement);
    fireEvent.keyDown(active as HTMLButtonElement, { key: "ArrowUp" });
    expect(buttons[0]).toHaveFocus();
  });
});
