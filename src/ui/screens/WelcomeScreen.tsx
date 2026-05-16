import { APP_DISPLAY_NAME } from "@/application/appInfo";
import { cn } from "@/lib/cn";
import { useAppMode } from "@/providers/AppModeProvider";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { StudentModeIcon, TutorModeIcon } from "@/ui/shell/icons";

export function WelcomeScreen() {
  const { selectTutor, selectStudent } = useAppMode();

  return (
    <FullScreen>
      <Header
        eyebrow="Offline learning lab"
        title={APP_DISPLAY_NAME}
        subtitle="Tutor-led vocabulary, grammar, and progress handoff in one local desktop app."
      />
      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Button
          size="lg"
          onClick={selectTutor}
          className="h-32 flex-col items-start justify-between px-6 py-5 text-left text-lg"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-fg/15 text-accent-fg shadow-[0_10px_30px_rgb(0_0_0/0.12)]">
              <TutorModeIcon className="h-7 w-7" />
            </span>
            <span>Tutor Desk</span>
          </span>
          <span className="max-w-[15rem] text-sm font-normal leading-5 text-accent-fg/80">
            Students, content, analytics, and imported practice logs.
          </span>
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={selectStudent}
          className="h-32 flex-col items-start justify-between px-6 py-5 text-left text-lg"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-app shadow-card">
              <StudentModeIcon className="h-7 w-7" />
            </span>
            <span>Student Desk</span>
          </span>
          <span className="max-w-[15rem] text-sm font-normal leading-5 text-muted-2">
            Assigned practice with an exportable local progress log.
          </span>
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
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 [-webkit-app-region:no-drag]">
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
      <h1 className="text-6xl font-semibold leading-tight">{title}</h1>
      <p className="max-w-lg text-balance text-sm text-muted">{subtitle}</p>
    </div>
  );
}
