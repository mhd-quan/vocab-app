import { SrsArchiveBanner } from "@/ui/components/SrsArchiveBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("SrsArchiveBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an auditable notice and removes it after dismissal", async () => {
    vi.spyOn(window.api.meta, "srsArchiveStatus")
      .mockResolvedValueOnce({ acknowledged: false, legacyRowCount: 12 })
      .mockResolvedValue({ acknowledged: true, legacyRowCount: 12 });
    const setSetting = vi.spyOn(window.api.settings, "set").mockResolvedValue({ ok: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <SrsArchiveBanner />
      </QueryClientProvider>,
    );

    const heading = await screen.findByRole("heading", { name: "Review schedule updated" });
    const region = heading.closest("[role='region']");
    expect(region).toHaveClass("object-surface", "learning-trace");
    expect(region).not.toHaveClass("shadow-card", "rounded-bento");
    expect(screen.getByText(/12 earlier progress records/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() =>
      expect(setSetting).toHaveBeenCalledWith({
        key: "srs_archive_acknowledged",
        value: true,
      }),
    );
    await waitFor(() => expect(screen.queryByText("Review schedule updated")).toBeNull());
  });
});
