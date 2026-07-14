import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { computeStudentXp } from "@/modules/rewards";
import { useAppMode } from "@/providers/AppModeProvider";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { BrandMark } from "@/ui/components/Brand";
import { WindowBackButton, WindowIconButton } from "@/ui/components/DesktopChrome";
import {
  type WindowBackRegistration,
  WindowNavigationProvider,
} from "@/ui/components/WindowNavigation";
import { StudentDictionaryPopup } from "@/ui/components/dictionary/StudentDictionaryPopup";
import {
  getStudentAccessVersion,
  isStudentUnlocked,
  subscribeStudentAccess,
} from "@/ui/student/access";
import { StreakBanner } from "@/ui/student/components/StreakBanner";
import { XPBadge } from "@/ui/student/components/XPBadge";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LockIcon } from "./icons";

const loadedStudyBackgrounds = new Set<string>();

export function StudentLayout() {
  const { lock } = useAppMode();
  const navigate = useNavigate();
  const isMac = window.api.app.platform === "darwin";
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [registeredBack, setRegisteredBack] = useState<WindowBackRegistration | null>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const chrome = useMemo(() => studentChromeForPath(pathname), [pathname]);
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
  const hasUploadedBackground = extractBackgroundImageUrl(savedBackground) !== null;
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

  const registerBack = useCallback((registration: WindowBackRegistration) => {
    setRegisteredBack(registration);
    return () => setRegisteredBack((current) => (current === registration ? null : current));
  }, []);

  const defaultBack = useCallback(() => {
    const studentId = studentIdFromPath(pathname);
    if (studentId === null) return;
    if (/\/personal-vocabulary\/session$/.test(pathname)) {
      void navigate({
        to: "/student/profile/$studentId/personal-vocabulary",
        params: { studentId: String(studentId) },
      });
      return;
    }
    if (pathname === `/student/profile/${studentId}`) {
      void navigate({ to: "/student" });
      return;
    }
    void navigate({
      to: "/student/profile/$studentId",
      params: { studentId: String(studentId) },
    });
  }, [navigate, pathname]);

  const backAction =
    registeredBack?.pathname === pathname
      ? { label: registeredBack.label, onBack: registeredBack.onBack }
      : chrome.backLabel
        ? { label: chrome.backLabel, onBack: defaultBack }
        : null;

  useEffect(() => {
    if (!dictionaryQ.data?.active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (document.querySelector("[data-dialog-surface]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDictionaryOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dictionaryQ.data?.active]);

  useEffect(() => {
    if (!backAction || dictionaryOpen) return;
    function onNavigateBack(event: KeyboardEvent) {
      if (document.querySelector("[data-dialog-surface]")) return;
      const systemBack =
        (event.altKey && event.key === "ArrowLeft") ||
        (isMac && event.metaKey && event.key === "[");
      if (!systemBack) return;
      event.preventDefault();
      backAction?.onBack();
    }
    document.addEventListener("keydown", onNavigateBack);
    return () => document.removeEventListener("keydown", onNavigateBack);
  }, [backAction, dictionaryOpen, isMac]);

  return (
    <WindowNavigationProvider register={registerBack} pathname={pathname}>
      <div
        data-app-window
        className="relative isolate flex h-screen w-screen flex-col overflow-hidden bg-app"
        data-student-bg={hasCustomBackground ? "custom" : "default"}
        style={
          hasCustomBackground
            ? {
                background: customBackground || "rgb(var(--color-surface-0))",
              }
            : undefined
        }
      >
        {hasUploadedBackground ? (
          <div
            aria-hidden="true"
            data-testid="student-background-tint"
            className="pointer-events-none absolute inset-0 z-0 bg-surface-0/20 backdrop-brightness-90 backdrop-saturate-125"
          />
        ) : null}
        <header
          data-window-chrome
          className={cn(
            "window-material relative z-20 flex h-[var(--student-header-height)] shrink-0 items-center justify-between gap-2 border-b border-border-subtle pr-3 [-webkit-app-region:drag]",
            isMac ? "pl-[4.5rem]" : "pl-3",
          )}
        >
          <div className="flex min-w-0 items-center gap-1 [-webkit-app-region:no-drag]">
            {backAction ? (
              <WindowBackButton label={backAction.label} onClick={backAction.onBack} />
            ) : (
              <Link
                to="/student"
                title="Profiles"
                className="ui-focus-ring grid h-[var(--size-control-md)] w-[var(--size-control-md)] place-items-center rounded-control text-accent transition-colors duration-fast hover:bg-surface-2"
                aria-label="Profiles"
              >
                <BrandMark className="h-5 w-5" />
              </Link>
            )}
            <span aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />
            <span className="truncate text-ui font-medium text-app">{chrome.title}</span>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 [-webkit-app-region:no-drag]">
            {activeStudentId !== null ? (
              <div className="hidden items-center gap-2 md:flex">
                <XPBadge xp={xp} />
                <StreakBanner stats={streakQ.data} />
              </div>
            ) : null}
            {dictionaryQ.data?.active ? (
              <button
                type="button"
                onClick={() => setDictionaryOpen(true)}
                className="ui-focus-ring hidden h-[var(--size-control-md)] min-w-36 items-center gap-2 rounded-control border border-border-strong/60 bg-paper/74 px-2.5 text-xs text-muted transition-colors duration-fast hover:bg-paper hover:text-app md:inline-flex"
              >
                <AppGlyph name="search" className="h-4 w-4" />
                <span className="flex-1 text-left">Look up a word</span>
                <kbd className="font-mono text-[10px] text-muted-2">{isMac ? "⌘K" : "Ctrl K"}</kbd>
              </button>
            ) : null}
            {activeStudentId !== null ? (
              <Link
                to="/student/profile/$studentId/settings"
                params={{ studentId: String(activeStudentId) }}
                title="Student settings"
                aria-label="Student settings"
                className="ui-focus-ring inline-grid h-[var(--size-control-md)] w-[var(--size-control-md)] place-items-center rounded-control text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-app"
              >
                <AppGlyph name="settings" className="h-[18px] w-[18px]" />
              </Link>
            ) : null}
            <WindowIconButton label="Switch to tutor" onClick={lock}>
              <LockIcon className="h-[18px] w-[18px]" />
            </WindowIconButton>
          </div>
        </header>
        <main
          data-student-workplane
          className={cn(
            "relative z-10 min-w-0 flex-1 overflow-y-auto",
            hasUploadedBackground
              ? "bg-paper/90 backdrop-blur-[2px]"
              : hasCustomBackground
                ? "bg-paper/80"
                : "bg-app",
          )}
        >
          {checkingStudentPin ? (
            <StudentProfileChecking />
          ) : lockedByStudentPin ? (
            <StudentProfileLocked />
          ) : (
            <div
              key={`${pathname}:${studentAccessVersion}`}
              className="motion-enter h-full min-h-0"
            >
              <Outlet />
            </div>
          )}
        </main>
        <StudentDictionaryPopup
          open={dictionaryOpen}
          onClose={() => setDictionaryOpen(false)}
          studentId={activeStudentId}
        />
      </div>
    </WindowNavigationProvider>
  );
}

function studentChromeForPath(pathname: string): { title: string; backLabel: string | null } {
  if (pathname === "/student" || pathname === "/student/") {
    return { title: "Profiles", backLabel: null };
  }
  if (/\/personal-vocabulary\/session$/.test(pathname)) {
    return { title: "Practice", backLabel: "Personal vocabulary" };
  }
  if (/\/session\/\d+$/.test(pathname)) return { title: "Practice", backLabel: "Lessons" };
  if (/\/unit\/\d+$/.test(pathname)) return { title: "Unit study", backLabel: "Lessons" };
  if (/\/achievements$/.test(pathname)) return { title: "Achievements", backLabel: "Lessons" };
  if (/\/personal-vocabulary$/.test(pathname)) {
    return { title: "Personal vocabulary", backLabel: "Lessons" };
  }
  if (/\/pronunciation$/.test(pathname)) {
    return { title: "Pronunciation", backLabel: "Lessons" };
  }
  if (/\/settings$/.test(pathname)) return { title: "Profile settings", backLabel: "Lessons" };
  return { title: "Lessons", backLabel: "Profiles" };
}

function StudentProfileChecking() {
  return (
    <div
      role="status"
      className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-3 px-6 py-10 text-center"
    >
      <div
        aria-hidden="true"
        className="h-7 w-7 animate-spin rounded-full border-2 border-border-subtle border-t-accent motion-reduce:animate-none"
      />
      <p className="text-ui font-medium text-muted">Checking profile…</p>
    </div>
  );
}

function StudentProfileLocked() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <LockIcon className="h-7 w-7 text-muted" />
      <div>
        <h1 className="text-title font-semibold">Profile locked</h1>
        <p className="mt-1 text-ui text-muted">Enter this student's PIN from the profile picker.</p>
      </div>
      <Link
        to="/student"
        className="ui-focus-ring inline-flex h-[var(--size-control-lg)] items-center justify-center rounded-control bg-accent px-4 text-ui font-medium text-accent-fg transition-colors duration-fast hover:bg-accent/90 active:bg-accent/80"
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
