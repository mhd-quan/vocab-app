import { cn } from "@/lib/cn";
import { useAppMode } from "@/providers/AppModeProvider";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { BrandMark } from "@/ui/components/Brand";
import { StudentModeIcon, TutorModeIcon } from "@/ui/shell/icons";

export function WelcomeScreen() {
  const { selectTutor, selectStudent } = useAppMode();

  return (
    <WindowFrame title="Welcome">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="text-center">
          <h1 className="text-title font-semibold">Vocab</h1>
          <p className="mt-1 text-ui text-muted">Choose how you want to continue.</p>
        </header>
        <div className="ui-group w-full bg-paper">
          <ModeChoice
            label="Tutor"
            description="Manage students, content, and progress"
            icon={<TutorModeIcon className="h-[18px] w-[18px]" />}
            onClick={selectTutor}
            separated
          />
          <ModeChoice
            label="Student"
            description="Continue lessons and practice"
            icon={<StudentModeIcon className="h-[18px] w-[18px]" />}
            onClick={selectStudent}
          />
        </div>
      </div>
    </WindowFrame>
  );
}

function ModeChoice({
  label,
  description,
  icon,
  onClick,
  separated = false,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  separated?: boolean;
}) {
  const descriptionId = `${label.toLowerCase().replaceAll(" ", "-")}-mode-description`;
  return (
    <button
      type="button"
      aria-label={label}
      aria-describedby={descriptionId}
      onClick={onClick}
      className={cn(
        "group flex min-h-[var(--size-row-comfortable)] w-full items-center gap-3 px-4 text-left",
        "transition-colors duration-fast hover:bg-surface-2/70 active:bg-surface-3/55",
        "focus-visible:relative focus-visible:z-10 focus-visible:outline-offset-[-2px]",
        separated && "border-b border-border-subtle",
      )}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center text-muted transition-colors duration-fast group-hover:text-app">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className="text-ui font-semibold text-app">{label}</span>
        <span id={descriptionId} className="text-xs font-normal text-muted">
          {description}
        </span>
      </span>
      <AppGlyph
        name="arrowRight"
        className="h-4 w-4 shrink-0 text-muted-2 transition-colors duration-fast group-hover:text-accent"
      />
    </button>
  );
}

function WindowFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const isMac = window.api.app.platform === "darwin";
  return (
    <div
      data-app-window
      className="flex h-screen w-screen flex-col overflow-hidden bg-app text-app"
    >
      <header
        data-window-chrome
        className={cn(
          "window-material flex h-[var(--size-toolbar)] shrink-0 items-center gap-2 border-b border-border-subtle pr-3 [-webkit-app-region:drag]",
          isMac ? "pl-[4.5rem]" : "pl-3",
        )}
      >
        <BrandMark className="h-5 w-5 text-accent" />
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border-subtle" />
        <span className="truncate text-ui font-medium">{title}</span>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center px-6 py-6 [-webkit-app-region:no-drag]">
        {children}
      </main>
    </div>
  );
}
