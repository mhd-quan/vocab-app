/** One-shot tutor notice for the review-schedule migration. */
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { Button } from "@/ui/components/Button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function SrsArchiveBanner() {
  const queryClient = useQueryClient();
  const statusQ = useQuery({
    queryKey: queryKeys.meta.srsArchiveStatus(),
    queryFn: () => api.meta.srsArchiveStatus(),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const dismiss = useMutation({
    mutationFn: () => api.settings.set({ key: "srs_archive_acknowledged", value: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meta.srsArchiveStatus() });
    },
  });

  if (!statusQ.data || statusQ.data.acknowledged) return null;

  const { legacyRowCount } = statusQ.data;

  return (
    <aside
      role="region"
      aria-labelledby="srs-archive-title"
      aria-busy={dismiss.isPending}
      className="object-surface learning-trace motion-enter mx-[var(--space-window-x)] mt-3 flex shrink-0 items-start gap-4 px-4 py-3 [--trace-rgb:var(--color-ochre)]"
    >
      <div role="status" className="min-w-0 flex-1">
        <h2 id="srs-archive-title" className="text-ui font-semibold text-app">
          Review schedule updated
        </h2>
        <p className="mt-0.5 max-w-4xl text-xs leading-5 text-muted">
          Student reviews now use FSRS-lite.{" "}
          {legacyRowCount > 0
            ? `${legacyRowCount} earlier progress records were archived for recovery; none were deleted.`
            : "There was no earlier progress to archive."}
        </p>
        {dismiss.isError ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            Couldn't dismiss this notice. Try again.
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => dismiss.mutate()}
        disabled={dismiss.isPending}
      >
        {dismiss.isPending ? "Dismissing…" : "Dismiss"}
      </Button>
    </aside>
  );
}
