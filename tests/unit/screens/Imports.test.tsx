import type { ImportItem, ImportRun } from "@/data/types";
import { TutorImports } from "@/ui/screens/tutor/Imports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeRun(overrides: Partial<ImportRun> = {}): ImportRun {
  const start = new Date("2026-01-01T10:00:00Z");
  const end = new Date("2026-01-01T10:00:01Z");
  return {
    id: 1,
    sourcePath: "/Users/me/vocab-app/content/books/destination-b1/unit-01-vocab.yaml",
    contentHash: "h1",
    startedAt: start,
    finishedAt: end,
    status: "success",
    stats: { inserted: 4, updated: 0, skipped: 0, failed: 0 },
    errorLog: null,
    ...overrides,
  };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TutorImports />
    </QueryClientProvider>,
  );
}

describe("TutorImports", () => {
  beforeEach(() => {
    vi.spyOn(window.api.imports, "listItems").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when no runs exist", async () => {
    vi.spyOn(window.api.imports, "listRuns").mockResolvedValue([]);
    renderScreen();
    await waitFor(() => expect(screen.getByText(/No imports yet/i)).toBeInTheDocument());
  });

  it("renders runs with status, shortened path, and stats", async () => {
    vi.spyOn(window.api.imports, "listRuns").mockResolvedValue([makeRun()]);
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByText(/content\/books\/destination-b1\/unit-01-vocab\.yaml/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/^success$/i)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("expands a row to show item details on click", async () => {
    vi.spyOn(window.api.imports, "listRuns").mockResolvedValue([makeRun()]);
    const items: ImportItem[] = [
      {
        id: 1,
        runId: 1,
        sourceId: "relative-noun",
        targetTable: "vocab_entries",
        targetId: 1,
        action: "inserted",
        hash: "h",
        error: null,
      },
    ];
    vi.spyOn(window.api.imports, "listItems").mockResolvedValue(items);

    renderScreen();
    const row = await screen.findByRole("button", { expanded: false });
    fireEvent.click(row);

    await waitFor(() => expect(window.api.imports.listItems).toHaveBeenCalledWith({ runId: 1 }));
    await waitFor(() => expect(screen.getByText("relative-noun")).toBeInTheDocument());
    expect(screen.getByText(/^inserted$/i)).toBeInTheDocument();
  });

  it("renders the error log inside an expandable details on partial runs", async () => {
    vi.spyOn(window.api.imports, "listRuns").mockResolvedValue([
      makeRun({
        status: "partial",
        stats: { inserted: 0, updated: 0, skipped: 0, failed: 1 },
        errorLog: "relative-noun: Example #1 has 2 cloze markers",
      }),
    ]);
    renderScreen();
    const row = await screen.findByRole("button", { expanded: false });
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByText(/2 cloze markers/i)).toBeInTheDocument());
    expect(screen.getByText(/^partial$/i)).toBeInTheDocument();
    void within;
  });
});
