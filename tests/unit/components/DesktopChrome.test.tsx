import { CommandPalette } from "@/ui/components/DesktopChrome";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("CommandPalette", () => {
  it("gives its search row a visible focus-within treatment", async () => {
    render(<CommandPalette open onClose={vi.fn()} items={[]} />);

    const search = screen.getByRole("combobox", { name: "Search commands and destinations" });
    await waitFor(() => expect(search).toHaveFocus());
    expect(search.closest("label")).toHaveClass(
      "focus-within:border-accent",
      "focus-within:ring-2",
      "focus-within:ring-focus/30",
    );
  });
});
