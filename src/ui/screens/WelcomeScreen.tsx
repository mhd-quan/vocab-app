import { cn } from "@/lib/cn";
import { useAppMode } from "@/providers/AppModeProvider";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { TutorModeIcon } from "@/ui/shell/icons";
import { StudentLogoMark } from "@/ui/student/pets";

export function WelcomeScreen() {
  const { selectTutor, selectStudent } = useAppMode();

  return (
    <FullScreen>
      <Header eyebrow="Welcome" title="Vocab App" subtitle="Choose a mode to continue." />
      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Button size="lg" onClick={selectTutor} className="h-24 flex-col items-start px-6 text-lg">
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-fg/15 text-accent-fg shadow-[0_10px_30px_rgb(0_0_0/0.12)]">
              <TutorModeIcon className="h-7 w-7" />
            </span>
            <span>Tutor</span>
          </span>
          <span className="text-sm font-normal text-accent-fg/80">Manage</span>
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={selectStudent}
          className="h-24 flex-col items-start px-6 text-lg"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 shadow-card">
              <StudentLogoMark className="h-10 w-10" />
            </span>
            <span>Student</span>
          </span>
          <span className="text-sm font-normal text-muted-2">Practice</span>
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
      <div className="flex w-full max-w-2xl flex-col items-center gap-7 [-webkit-app-region:no-drag]">
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
      <Badge tone="focus" uppercase>
        {eyebrow}
      </Badge>
      <h1 className="text-5xl font-semibold leading-tight">{title}</h1>
      <p className="max-w-sm text-balance text-sm text-muted">{subtitle}</p>
    </div>
  );
}
