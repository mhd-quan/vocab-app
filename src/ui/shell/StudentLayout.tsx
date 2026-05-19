import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { computeStudentXp } from "@/modules/rewards";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { StudentDictionaryPopup } from "@/ui/components/dictionary/StudentDictionaryPopup";
import {
  getStudentAccessVersion,
  isStudentUnlocked,
  subscribeStudentAccess,
} from "@/ui/student/access";
import { StreakBanner } from "@/ui/student/components/StreakBanner";
import { XPBadge } from "@/ui/student/components/XPBadge";
import { StudentLogoMark } from "@/ui/student/pets";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LockIcon } from "./icons";

const loadedStudyBackgrounds = new Set<string>();

export function StudentLayout() {
  const { lock } = useAppMode();
  const isMac = window.api.app.platform === "darwin";
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeStudentId = studentIdFromPath(pathname);
  const studentAccessVersion = useSyncExternalStore(
    subscribeStudentAccess,
    getStudentAccessVersion,
    getStudentAccessVersion,
  );
  const backgroundQ = useQuery({
    queryKey: queryKeys.studentPrefs.studyBackground(activeStudentId ?? 0),
    queryFn: () =>
      api.settings.get<string>({ key: `student_profile:${activeStudentId}:study_background` }),
    enabled: activeStudentId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
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
  const savedBackground = normalizeStudyBackground(backgroundQ.data || "");
  const customBackground = useLoadedStudyBackground(savedBackground);
  const hasCustomBackground = savedBackground.length > 0;
  const summary = summaryQ.data;
  const pinQ = useQuery({
    queryKey: queryKeys.students.hasPin(activeStudentId ?? 0),
    queryFn: () => api.students.hasPin({ studentId: activeStudentId ?? 0 }),
    enabled: activeStudentId !== null,
  });
  const checkingStudentPin = activeStudentId !== null && pinQ.data === undefined;
  const lockedByStudentPin =
    activeStudentId !== null && pinQ.data === true && !isStudentUnlocked(activeStudentId);
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
      data-student-bg={hasCustomBackground ? "custom" : "default"}
      style={
        hasCustomBackground
          ? {
              background: customBackground || "rgb(var(--color-surface-0))",
              backgroundAttachment: "scroll",
              colorScheme: "light",
            }
          : undefined
      }
    >
      <header
        className={cn(
          "flex min-h-[var(--student-header-height)] items-center justify-between gap-4 border-b border-border-subtle bg-surface-1/95 py-3 pr-6 shadow-sm [-webkit-app-region:drag]",
          isMac ? "pl-20" : "pl-6",
        )}
      >
        <Link to="/student" className="flex items-center gap-3 [-webkit-app-region:no-drag]">
          <StudentLogoMark className="h-10 w-10" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-base font-semibold">Vocab App</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-success">
              Student
            </span>
          </span>
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
          "min-w-0 flex-1 overflow-y-auto",
          hasCustomBackground ? "bg-transparent" : "bg-app/85",
        )}
      >
        {checkingStudentPin ? (
          <StudentProfileChecking />
        ) : lockedByStudentPin ? (
          <StudentProfileLocked />
        ) : (
          <Outlet key={studentAccessVersion} />
        )}
      </main>
      <StudentDictionaryPopup
        open={dictionaryOpen}
        onClose={() => setDictionaryOpen(false)}
        studentId={activeStudentId}
      />
    </div>
  );
}

function StudentProfileChecking() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-3 px-8 py-12 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-accent" />
      <p className="text-sm font-medium text-muted">Checking profile…</p>
    </div>
  );
}

function StudentProfileLocked() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-4 px-8 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full border border-border-subtle bg-surface-1 text-muted shadow-card">
        <LockIcon className="h-8 w-8" />
      </div>
      <div>
        <h1 className="font-display text-3xl font-semibold">Profile locked</h1>
        <p className="mt-2 text-sm text-muted">
          Enter this student's password from the profile picker.
        </p>
      </div>
      <Link
        to="/student"
        className="inline-flex h-10 items-center justify-center rounded-button bg-accent px-4 text-sm font-semibold text-accent-fg shadow-sm shadow-accent/20 hover:bg-accent/90"
      >
        Choose profile
      </Link>
    </div>
  );
}

function studentIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/student\/profile\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function useLoadedStudyBackground(savedBackground: string): string {
  const normalized = normalizeStudyBackground(savedBackground);
  const [loadedBackground, setLoadedBackground] = useState(() =>
    extractBackgroundImageUrl(normalized) && !loadedStudyBackgrounds.has(normalized)
      ? ""
      : normalized,
  );

  useEffect(() => {
    const nextBackground = normalizeStudyBackground(savedBackground);
    if (!nextBackground) {
      setLoadedBackground("");
      return;
    }

    const imageUrl = extractBackgroundImageUrl(nextBackground);
    if (!imageUrl || loadedStudyBackgrounds.has(nextBackground)) {
      setLoadedBackground(nextBackground);
      return;
    }

    setLoadedBackground("");
    let cancelled = false;
    let settled = false;
    const image = new Image();
    image.decoding = "async";
    const finish = () => {
      if (cancelled || settled) return;
      settled = true;
      loadedStudyBackgrounds.add(nextBackground);
      setLoadedBackground(nextBackground);
    };

    image.onload = finish;
    image.onerror = finish;
    image.src = imageUrl;
    if (image.complete) finish();
    const decodePromise = image.decode?.();
    if (decodePromise) void decodePromise.then(finish, finish);

    return () => {
      cancelled = true;
    };
  }, [savedBackground]);

  return loadedBackground;
}

function normalizeStudyBackground(background: string): string {
  return background.trim().replace(/\s+fixed\s*$/i, " no-repeat");
}

function extractBackgroundImageUrl(background: string): string | null {
  const match = background.match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2] ?? null;
}
