import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { SrsArchiveBanner } from "@/ui/components/SrsArchiveBanner";
import { TutorBrand, type TutorNavItem, TutorNavigationRail } from "@/ui/tutor/components/Material";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
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
  { to: "/tutor/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { to: "/tutor/students", label: "Students", icon: <StudentsIcon /> },
  { to: "/tutor/content", label: "Content", icon: <ContentIcon /> },
  { to: "/tutor/imports", label: "Imports", icon: <ImportsIcon /> },
  { to: "/tutor/settings", label: "Settings", icon: <SettingsIcon /> },
];

export function TutorLayout() {
  const { lock, switchToStudent } = useAppMode();
  const isMac = window.api.app.platform === "darwin";
  const dictionaryQ = useQuery({
    queryKey: queryKeys.dictionary.status(),
    queryFn: () => api.dictionary.status(),
  });
  const items = dictionaryQ.data?.active
    ? [
        ITEMS[0],
        ITEMS[1],
        ITEMS[2],
        { to: "/tutor/dictionary", label: "Dictionary", icon: <DictionaryIcon /> },
        ITEMS[3],
        ITEMS[4],
      ].filter((item): item is TutorNavItem => Boolean(item))
    : ITEMS;

  return (
    <div className="tutor-workspace-shell flex h-screen w-screen overflow-hidden text-app">
      <TutorNavigationRail
        topInset={isMac}
        brand={<TutorBrand version={`v${window.api.app.version}`} />}
        items={items}
        footer={
          <div className="flex flex-col gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-[var(--shape-corner-lg)] text-muted hover:text-app"
              onClick={switchToStudent}
            >
              <StudentModeIcon className="h-[22px] w-[22px]" />
              <span>Student practice</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-[var(--shape-corner-lg)] text-muted hover:text-app"
              onClick={lock}
            >
              <LockIcon className="h-[22px] w-[22px]" />
              <span>Lock</span>
            </Button>
          </div>
        }
      />
      <main className="tutor-main-surface tutor-scrollbar min-w-0 flex-1 overflow-y-auto">
        <div className="px-6 pt-4">
          <SrsArchiveBanner />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
