import { cn } from "@/lib/cn";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { StudentModeIcon, TutorModeIcon } from "@/ui/shell/icons";

export function WelcomeScreen() {
  const { selectTutor, selectStudent } = useAppMode();

  return (
    <FullScreen>
      <Header eyebrow="Welcome" title="Vocab App" subtitle="Choose a mode to continue." />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Button size="lg" onClick={selectTutor} className="h-16 justify-between px-6 text-lg">
          <span className="flex items-center gap-3">
            <span className="text-xl">
              <TutorModeIcon />
            </span>
            <span>Tutor</span>
          </span>
          <span className="text-muted-2/80 text-sm font-normal">Manage &raquo;</span>
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={selectStudent}
          className="h-16 justify-between px-6 text-lg"
        >
          <span className="flex items-center gap-3">
            <span className="text-xl text-muted">
              <StudentModeIcon />
            </span>
            <span>Student</span>
          </span>
          <span className="text-muted-2/80 text-sm font-normal">Practice &raquo;</span>
        </Button>
      </div>
    </FullScreen>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  const isMac = window.api.app.platform === "darwin";
  return (
    <div
      className={cn(
        "flex h-screen w-screen items-center justify-center px-6 [-webkit-app-region:drag]",
        isMac ? "pt-10" : "",
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6 [-webkit-app-region:no-drag]">
        {children}
      </div>
    </div>
  );
}

function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="rounded-full border border-border-subtle bg-surface-1 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted">
        {eyebrow}
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-sm text-balance text-sm text-muted">{subtitle}</p>
    </div>
  );
}
