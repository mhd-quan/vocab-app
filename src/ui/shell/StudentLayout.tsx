import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { computeStudentXp } from "@/modules/rewards";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { StudentDictionaryPopup } from "@/ui/components/dictionary/StudentDictionaryPopup";
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
  const backgroundQ = useQuery({
    queryKey: ["studentPrefs", activeStudentId ?? 0, "studyBackground"],
    queryFn: () =>
      api.settings.get<string>({ key: `student_profile:${activeStudentId}:study_background` }),
    enabled: activeStudentId !== null,
  });
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
  const customBackground = backgroundQ.data || "";
  const summary = summaryQ.data;
  const xp = summary
    ? computeStudentXp({
        totalSeen: summary.totalSeen,
        totalCorrect: summary.totalCorrect,
        totalWrong: summary.totalWrong,
        accuracy: summary.accuracy,
        streakDays: streakQ.data?.currentStreak ?? 0,
        practicedToday: streakQ.data?.practicedToday ?? false,
      })
    : 0;

  return (
    <div
      className="flex h-screen w-screen flex-col bg-app"
      data-student-bg={customBackground ? "custom" : "default"}
      style={customBackground ? { background: customBackground, colorScheme: "light" } : undefined}
    >
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
          {activeStudentId !== null ? (
            <Link
              to="/student/profile/$studentId/settings"
              params={{ studentId: String(activeStudentId) }}
              className="inline-flex h-8 items-center rounded-button border border-border-strong bg-surface-1 px-3 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-app"
            >
              Fun settings
            </Link>
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
      <main
        className={cn(
          "min-w-0 flex-1 overflow-y-auto backdrop-blur-[1px]",
          customBackground ? "bg-white/58" : "bg-app/85",
        )}
      >
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
