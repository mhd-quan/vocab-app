import { APP_DISPLAY_NAME } from "@/application/appInfo";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { StudentDictionaryPopup } from "@/ui/components/dictionary/StudentDictionaryPopup";
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

  return (
    <div className="flex h-screen w-screen flex-col bg-app">
      <header
        className={cn(
          "flex items-center justify-between border-b border-border-subtle bg-surface-1/95 py-3 pr-6 shadow-sm [-webkit-app-region:drag]",
          isMac ? "pl-20" : "pl-6",
        )}
      >
        <Link to="/student" className="flex items-center gap-3 [-webkit-app-region:no-drag]">
          <span className="rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs font-semibold uppercase text-muted">
            Student
          </span>
          <span className="text-base font-semibold">{APP_DISPLAY_NAME}</span>
        </Link>
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
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
      <main className="flex flex-1 overflow-y-auto">
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
