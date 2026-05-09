import { App } from "@/App";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("App shell smoke test", () => {
  it("renders the title and bridge status pill", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vocab App");
    expect(screen.getByText(/Bridge/)).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
