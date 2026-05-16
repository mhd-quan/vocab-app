import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { Sidebar, type SidebarItem } from "./Sidebar";
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

const ITEMS: SidebarItem[] = [
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
      ].filter((item): item is SidebarItem => Boolean(item))
    : ITEMS;

  return (
    <div className="flex h-screen w-screen bg-app">
      <Sidebar
        topInset={isMac}
        brand={
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-muted">Tutor</span>
            <span className="text-lg font-semibold">Vocab App</span>
            <span className="font-mono text-[11px] text-muted-2">v0.7.0</span>
          </div>
        }
        items={items}
        footer={
          <div className="flex flex-col gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted hover:text-app"
              onClick={switchToStudent}
            >
              <StudentModeIcon className="h-[22px] w-[22px]" />
              <span>Student practice</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted hover:text-app"
              onClick={lock}
            >
              <LockIcon className="h-[22px] w-[22px]" />
              <span>Lock</span>
            </Button>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
