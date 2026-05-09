import { App } from "@/App";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("App shell smoke test", () => {
  it("renders the title and resolves IPC probes", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vocab App");
    expect(screen.getByText("Bridge")).toBeInTheDocument();
    expect(screen.getByText("Books")).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
    expect(screen.getByText("Ping")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("pong")).toBeInTheDocument();
    });
  });
});
