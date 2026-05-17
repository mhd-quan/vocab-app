/**
 * One-shot tutor banner for the v0.10 SRS migration.
 *
 * Behaviour:
 *   - Query `meta.srsArchiveStatus` on mount. Render nothing while
 *     loading or once the tutor has acknowledged.
 *   - On dismiss, flip `srs_archive_acknowledged` in app_settings and
 *     invalidate the query so the banner unmounts cleanly.
 *
 * Copy explains the trade-off in plain Vietnamese: SM-2 state is
 * archived (not deleted), FSRS-lite is the new scheduler, and students
 * start fresh. The `legacyRowCount` makes the change feel auditable.
 */
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
      role="status"
      className="motion-enter mx-auto flex w-full max-w-screen-3xl items-start gap-4 rounded-bento border border-warning bg-surface-1 px-5 py-4 shadow-card"
    >
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-app">Đã chuyển sang FSRS-lite (v0.10)</h3>
        <p className="mt-1 text-sm text-muted">
          Học sinh sẽ bắt đầu lại từ đầu với thuật toán mới.{" "}
          {legacyRowCount > 0
            ? `${legacyRowCount} bản ghi tiến độ SM-2 cũ đã được archive vào item_progress_v1_archive — không bị xoá, có thể rollback nếu cần.`
            : "Không có tiến độ SM-2 cũ để archive."}{" "}
          Mức ngưỡng FSRS (1 / 21 ngày mặc định) chỉnh được trong Settings.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => dismiss.mutate()}
        disabled={dismiss.isPending}
      >
        {dismiss.isPending ? "Saving…" : "Got it"}
      </Button>
    </aside>
  );
}
