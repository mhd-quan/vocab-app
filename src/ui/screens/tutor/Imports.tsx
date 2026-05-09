import { PageHeader } from "@/ui/components/PageHeader";
import { PlaceholderPanel } from "@/ui/components/PlaceholderPanel";

export function TutorImports() {
  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Import history"
        subtitle="Every `npm run import` invocation is recorded — this screen surfaces those rows for debugging."
      />
      <PlaceholderPanel
        title="Import runs + per-item log"
        body="Read-only table of import_runs with stats (inserted/updated/skipped/failed) and drill-down into import_items per run. Lands in PR #6."
        hint="Data is already logged — you can inspect it with `select * from import_runs` in any SQLite client."
      />
    </>
  );
}
