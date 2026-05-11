import { cn } from "@/lib/cn";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { Link, Outlet } from "@tanstack/react-router";
import { LockIcon } from "./icons";

export function StudentLayout() {
  const { lock } = useAppMode();
  const isMac = window.api.app.platform === "darwin";

  return (
    <div className="flex h-screen w-screen flex-col bg-app">
      <header
        className={cn(
          "flex items-center justify-between border-b border-border-subtle bg-surface-1 py-3 pr-6 [-webkit-app-region:drag]",
          isMac ? "pl-20" : "pl-6",
        )}
      >
        <Link to="/student" className="flex items-center gap-3 [-webkit-app-region:no-drag]">
          <span className="rounded-full border border-border-subtle bg-surface-2 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted">
            Student
          </span>
          <span className="text-sm font-semibold">Vocab App</span>
        </Link>
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <Button
            variant="ghost"
            size="sm"
            onClick={lock}
            className="text-muted hover:text-app"
            aria-label="Switch to tutor"
          >
            <LockIcon />
            <span>Tutor mode</span>
          </Button>
        </div>
      </header>
      <main className="flex flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
