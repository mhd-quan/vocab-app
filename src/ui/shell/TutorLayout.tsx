import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useAppMode } from "@/providers/AppModeProvider";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { BrandMark } from "@/ui/components/Brand";
import {
  type CommandItem,
  CommandPalette,
  CommandTrigger,
  WindowBackButton,
  WindowIconButton,
} from "@/ui/components/DesktopChrome";
import { SrsArchiveBanner } from "@/ui/components/SrsArchiveBanner";
import { type TutorNavItem, TutorNavigationRail } from "@/ui/tutor/components/Material";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ContentIcon,
  DashboardIcon,
  DictionaryIcon,
  ImportsIcon,
  LockIcon,
  SettingsIcon,
  StudentModeIcon,
  StudentsIcon,
} from "./icons";

const ITEMS: TutorNavItem[] = [
  {
    to: "/tutor/dashboard",
    label: "Overview",
    icon: <DashboardIcon />,
    section: "Workspace",
  },
  {
    to: "/tutor/students",
    label: "Students",
    icon: <StudentsIcon />,
    section: "Workspace",
  },
  {
    to: "/tutor/content",
    label: "Library",
    icon: <ContentIcon />,
    section: "Workspace",
  },
  {
    to: "/tutor/imports",
    label: "Imports",
    icon: <ImportsIcon />,
    section: "Tools",
  },
  {
    to: "/tutor/settings",
    label: "Settings",
    icon: <SettingsIcon />,
    section: "System",
  },
];

export function TutorLayout() {
  const { lock, switchToStudent } = useAppMode();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isMac = window.api.app.platform === "darwin";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const dictionaryQ = useQuery({
    queryKey: queryKeys.dictionary.status(),
    queryFn: () => api.dictionary.status(),
  });
  const items = dictionaryQ.data?.active
    ? [
        ITEMS[0],
        ITEMS[1],
        ITEMS[2],
        {
          to: "/tutor/dictionary",
          label: "Dictionary",
          icon: <DictionaryIcon />,
          section: "Tools" as const,
        },
        ITEMS[3],
        ITEMS[4],
      ].filter((item): item is TutorNavItem => Boolean(item))
    : ITEMS;
  const isStudentDetail = /^\/tutor\/students\/\d+$/.test(pathname);
  const currentLabel = isStudentDetail
    ? "Student details"
    : (items.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.label ??
      "Tutor");
  const backToStudents = useCallback(() => void navigate({ to: "/tutor/students" }), [navigate]);
  const commands = useMemo<CommandItem[]>(
    () => [
      ...items.map((item) => ({
        id: item.to,
        label: `Open ${item.label}`,
        group: "Navigate",
        icon: item.icon,
        keywords: item.label,
        onSelect: () => void navigate({ to: item.to }),
      })),
      {
        id: "student-mode",
        label: "Switch to student practice",
        group: "Application",
        icon: <StudentModeIcon />,
        onSelect: switchToStudent,
      },
      {
        id: "lock",
        label: "Lock tutor workspace",
        group: "Application",
        icon: <LockIcon />,
        shortcut: isMac ? "⌘L" : "Ctrl L",
        onSelect: lock,
      },
    ],
    [isMac, items, lock, navigate, switchToStudent],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (document.querySelector("[data-dialog-surface]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandsOpen((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        lock();
      }
      const systemBack =
        (event.altKey && event.key === "ArrowLeft") ||
        (isMac && event.metaKey && event.key === "[");
      if (isStudentDetail && !commandsOpen && systemBack) {
        event.preventDefault();
        backToStudents();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [backToStudents, commandsOpen, isMac, isStudentDetail, lock]);

  return (
    <div
      data-app-window
      className="tutor-workspace-shell flex h-screen w-screen flex-col overflow-hidden text-app"
    >
      <header
        data-window-chrome
        className="window-material relative z-30 flex h-[var(--tutor-toolbar-height)] shrink-0 items-center gap-2 border-b border-border-subtle pr-3 [-webkit-app-region:drag]"
      >
        <div className={isMac ? "w-[4.5rem] shrink-0" : "w-2 shrink-0"} />
        <BrandMark className="mr-1 h-5 w-5 text-accent" />
        <WindowIconButton
          label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          className="[-webkit-app-region:no-drag]"
          onClick={() => setSidebarCollapsed((value) => !value)}
        >
          <AppGlyph name="sidebar" className="h-[18px] w-[18px]" />
        </WindowIconButton>
        <span aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />
        {isStudentDetail ? (
          <>
            <WindowBackButton label="Students" onClick={backToStudents} />
            <span aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />
          </>
        ) : null}
        <span className="truncate text-ui font-medium text-app">{currentLabel}</span>
        <div className="flex-1" />
        <CommandTrigger onClick={() => setCommandsOpen(true)} shortcut={isMac ? "⌘K" : "Ctrl K"} />
        <WindowIconButton
          label="Switch to student practice"
          className="[-webkit-app-region:no-drag]"
          onClick={switchToStudent}
        >
          <StudentModeIcon className="h-[18px] w-[18px]" />
        </WindowIconButton>
        <WindowIconButton
          label="Lock tutor workspace"
          className="[-webkit-app-region:no-drag]"
          onClick={lock}
        >
          <LockIcon className="h-[18px] w-[18px]" />
        </WindowIconButton>
      </header>
      <div className="flex min-h-0 flex-1">
        <TutorNavigationRail collapsed={sidebarCollapsed} items={items} />
        <main className="tutor-main-surface flex min-w-0 flex-1 flex-col overflow-hidden">
          <SrsArchiveBanner />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div key={pathname} className="motion-enter h-full min-h-0">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <CommandPalette open={commandsOpen} onClose={() => setCommandsOpen(false)} items={commands} />
    </div>
  );
}
