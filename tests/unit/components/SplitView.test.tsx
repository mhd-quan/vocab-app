import { SplitView } from "@/ui/components/SplitView";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

describe("SplitView", () => {
  beforeEach(() => window.localStorage.clear());

  it("supports keyboard resizing and remembers the pane size", async () => {
    const first = render(
      <SplitView
        initialSize={220}
        minSize={180}
        maxSize={320}
        label="Resize navigation"
        storageKey="test.split"
      >
        <div>Navigation</div>
        <div>Content</div>
      </SplitView>,
    );

    const separator = screen.getByRole("separator", { name: "Resize navigation" });
    expect(separator).toHaveAttribute("aria-valuenow", "220");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "236");
    await waitFor(() => expect(window.localStorage.getItem("test.split")).toBe("236"));

    first.unmount();
    render(
      <SplitView
        initialSize={220}
        minSize={180}
        maxSize={320}
        label="Resize navigation"
        storageKey="test.split"
      >
        <div>Navigation</div>
        <div>Content</div>
      </SplitView>,
    );

    expect(screen.getByRole("separator", { name: "Resize navigation" })).toHaveAttribute(
      "aria-valuenow",
      "236",
    );
  });

  it("resets to its initial size on double click", () => {
    render(
      <SplitView initialSize={240} minSize={180} maxSize={320} label="Resize inspector">
        <div>Content</div>
        <div>Inspector</div>
      </SplitView>,
    );

    const separator = screen.getByRole("separator", { name: "Resize inspector" });
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "256");
    fireEvent.doubleClick(separator);
    expect(separator).toHaveAttribute("aria-valuenow", "240");
  });

  it("reclaims space from a stored side pane when the live container narrows", async () => {
    window.localStorage.setItem("test.responsive-split", "480");
    const { container } = render(
      <SplitView
        initialSize={360}
        minSize={304}
        maxSize={480}
        contentMinSize={320}
        label="Resize entry inspector"
        storageKey="test.responsive-split"
      >
        <div>Lessons</div>
        <div>Inspector</div>
      </SplitView>,
    );

    const root = container.firstElementChild as HTMLElement;
    root.getBoundingClientRect = () =>
      ({
        width: 600,
        height: 600,
        top: 0,
        right: 600,
        bottom: 600,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }) as DOMRect;
    fireEvent(window, new Event("resize"));

    await waitFor(() =>
      expect(screen.getByRole("separator", { name: "Resize entry inspector" })).toHaveAttribute(
        "aria-valuenow",
        "279",
      ),
    );
  });
});
