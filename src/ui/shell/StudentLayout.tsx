import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { StudentDictionaryPopup } from "@/ui/components/dictionary/StudentDictionaryPopup";
import { HeartsBar } from "@/ui/student/components/HeartsBar";
import { StreakBanner } from "@/ui/student/components/StreakBanner";
import { XPBadge } from "@/ui/student/components/XPBadge";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { LockIcon } from "./icons";

export function StudentLayout() {
  const { lock } = useAppMode();
  const isMac = window.api.app.platform === "darwin";
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeStudentId = studentIdFromPath(pathname);
  const dictionaryQ = useQuery({
    queryKey: queryKeys.dictionary.status(),
    queryFn: () => api.dictionary.status(),
  });
  // Streak chip lives in the header so it follows the kid across every
  // student screen — a constant reminder of the day-streak. Disabled
  // when no profile is loaded (the picker screen).
  const streakQ = useQuery({
    queryKey: queryKeys.rewards.streak(activeStudentId ?? 0),
    queryFn: () => api.rewards.streak({ studentId: activeStudentId ?? 0 }),
    enabled: activeStudentId !== null,
  });
  const summaryQ = useQuery({
    queryKey: queryKeys.progress.summary(activeStudentId ?? 0),
    queryFn: () => api.progress.studentSummary({ studentId: activeStudentId ?? 0 }),
    enabled: activeStudentId !== null,
  });
  const summary = summaryQ.data;
  const hearts =
    summary && summary.totalSeen > 0 ? Math.max(1, Math.round(summary.accuracy * 5)) : 5;
  const xp = summary ? summary.totalSeen * 10 + Math.round(summary.accuracy * 100) : 0;

  return (
    <div className="flex h-screen w-screen flex-col bg-app">
      <header
        className={cn(
          "flex min-h-[var(--student-header-height)] items-center justify-between gap-4 border-b border-border-subtle bg-surface-1/95 py-3 pr-6 shadow-sm [-webkit-app-region:drag]",
          isMac ? "pl-20" : "pl-6",
        )}
      >
        <Link to="/student" className="flex items-center gap-3 [-webkit-app-region:no-drag]">
          <span className="rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-xs font-semibold uppercase text-success">
            Student
          </span>
          <span className="font-display text-base font-semibold">Vocab App</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 [-webkit-app-region:no-drag]">
          {activeStudentId !== null ? (
            <div className="hidden items-center gap-2 md:flex">
              <HeartsBar remaining={hearts} />
              <XPBadge xp={xp} />
              <StreakBanner stats={streakQ.data} />
            </div>
          ) : null}
          {dictionaryQ.data?.active ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDictionaryOpen(true)}
              className="text-muted hover:text-app"
            >
              Search word
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={lock}
            className="text-muted hover:text-app"
            aria-label="Switch to tutor"
          >
            <LockIcon className="h-[22px] w-[22px]" />
            <span>Tutor mode</span>
          </Button>
        </div>
      </header>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <StudentDictionaryPopup
        open={dictionaryOpen}
        onClose={() => setDictionaryOpen(false)}
        studentId={activeStudentId}
      />
    </div>
  );
}

function studentIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/student\/profile\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
