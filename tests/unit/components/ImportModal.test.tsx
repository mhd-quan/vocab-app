import { ImportModal } from "@/ui/components/ImportModal";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("ImportModal", () => {
  it("presents import as one window-scoped sheet with an accessible drop target", async () => {
    render(<ImportModal open onClose={vi.fn()} onImported={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Import YAML" })).toBeInTheDocument();
    const dropTarget = screen.getByRole("group", { name: "YAML file drop area" });
    expect(dropTarget).toHaveClass("rounded-object");
    expect(dropTarget).not.toHaveClass("rounded-2xl", "shadow-card");
    const chooseFile = screen.getByRole("button", { name: "Choose file" });
    expect(chooseFile).toBeInTheDocument();
    await waitFor(() => expect(chooseFile).toHaveFocus());
  });
});
