import { cn } from "@/lib/cn";
import { useAppMode } from "@/providers/AppModeProvider";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Button } from "@/ui/components/Button";
import { WindowBackButton } from "@/ui/components/DesktopChrome";
import { PinInput } from "@/ui/components/PinInput";
import { type FormEvent, useEffect, useRef, useState } from "react";

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;

export function UnlockScreen() {
  const { hasPin, pinReady, lock } = useAppMode();
  return (
    <WindowFrame onBack={lock}>
      {!pinReady ? (
        <p role="status" className="text-ui text-muted">
          Loading…
        </p>
      ) : hasPin ? (
        <VerifyPinForm />
      ) : (
        <SetupPinForm />
      )}
    </WindowFrame>
  );
}

function VerifyPinForm() {
  const { unlockTutor, enterStudent } = useAppMode();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = "tutor-pin-error";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN must be at least ${MIN_PIN_LENGTH} characters`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await unlockTutor(pin);
      if (!result.ok) {
        setError(result.reason === "no_pin" ? "No PIN configured" : "Incorrect PIN");
        setPin("");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="object-surface w-full max-w-sm overflow-hidden">
      <Header title="Welcome back" subtitle="Enter your PIN to unlock the tutor dashboard." />
      <form className="flex flex-col gap-4 px-5 pb-5" onSubmit={onSubmit} aria-busy={busy}>
        <PinInput
          ref={inputRef}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.slice(0, MAX_PIN_LENGTH));
            if (error) setError(null);
          }}
          maxLength={MAX_PIN_LENGTH}
          aria-label="Tutor PIN"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          invalid={Boolean(error)}
          disabled={busy}
          autoComplete="current-password"
          enterKeyHint="done"
        />
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="rounded-control bg-danger/10 px-3 py-2 text-center text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || pin.length < MIN_PIN_LENGTH}
        >
          {busy ? "Verifying…" : "Unlock tutor mode"}
        </Button>
      </form>
      <footer className="border-t border-border-subtle px-3 py-2">
        <Button
          variant="ghost"
          onClick={enterStudent}
          className="w-full text-muted hover:text-app"
          size="md"
        >
          <span>Continue to student practice</span>
          <AppGlyph name="arrowRight" className="h-4 w-4" />
        </Button>
      </footer>
    </section>
  );
}

function SetupPinForm() {
  const { setupPin } = useAppMode();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = "setup-pin-error";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN must be at least ${MIN_PIN_LENGTH} characters`);
      return;
    }
    if (pin !== confirm) {
      setError("PINs do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setupPin(pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set PIN");
      setBusy(false);
    }
  }

  return (
    <section className="object-surface w-full max-w-sm overflow-hidden">
      <Header
        title="Set your tutor PIN"
        subtitle="This PIN protects tutor tools and student records. Keep it somewhere safe."
      />
      <form className="flex flex-col gap-4 px-5 pb-5" onSubmit={onSubmit} aria-busy={busy}>
        <PinInput
          ref={inputRef}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.slice(0, MAX_PIN_LENGTH));
            if (error) setError(null);
          }}
          aria-label="New PIN"
          aria-describedby={error ? errorId : undefined}
          maxLength={MAX_PIN_LENGTH}
          invalid={Boolean(error)}
          disabled={busy}
          autoComplete="new-password"
          enterKeyHint="next"
        />
        <PinInput
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value.slice(0, MAX_PIN_LENGTH));
            if (error) setError(null);
          }}
          aria-label="Confirm PIN"
          aria-describedby={error ? errorId : undefined}
          maxLength={MAX_PIN_LENGTH}
          invalid={Boolean(error)}
          disabled={busy}
          placeholder="Confirm"
          autoComplete="new-password"
          enterKeyHint="done"
        />
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="rounded-control bg-danger/10 px-3 py-2 text-center text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || pin.length < MIN_PIN_LENGTH}
        >
          {busy ? "Saving…" : "Set PIN & continue"}
        </Button>
      </form>
    </section>
  );
}

function WindowFrame({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  const isMac = window.api.app.platform === "darwin";
  return (
    <div
      data-app-window
      className="flex h-screen w-screen flex-col overflow-hidden bg-app text-app"
    >
      <header
        data-window-chrome
        className={cn(
          "window-material flex h-[var(--size-toolbar)] shrink-0 items-center gap-1 border-b border-border-subtle pr-3 [-webkit-app-region:drag]",
          isMac ? "pl-[4.5rem]" : "pl-3",
        )}
      >
        <WindowBackButton label="Choose mode" onClick={onBack} />
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border-subtle" />
        <span className="truncate text-ui font-medium">Tutor access</span>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center px-6 py-6 [-webkit-app-region:no-drag]">
        {children}
      </main>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="px-5 pb-4 pt-5 text-center">
      <h1 className="text-title font-semibold">{title}</h1>
      <p className="mt-1 text-ui leading-5 text-muted">{subtitle}</p>
    </header>
  );
}
