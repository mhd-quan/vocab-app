import { cn } from "@/lib/cn";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { PinInput } from "@/ui/components/PinInput";
import { type FormEvent, useEffect, useRef, useState } from "react";

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;

export function UnlockScreen() {
  const { hasPin, pinReady } = useAppMode();
  if (!pinReady) {
    return (
      <FullScreen>
        <p className="text-sm text-muted">Loading…</p>
      </FullScreen>
    );
  }
  return hasPin ? <VerifyPinForm /> : <SetupPinForm />;
}

function VerifyPinForm() {
  const { unlockTutor, enterStudent } = useAppMode();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN must be at least ${MIN_PIN_LENGTH} digits`);
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
    <FullScreen>
      <Header
        eyebrow="Tutor mode"
        title="Welcome back"
        subtitle="Enter your PIN to unlock the tutor dashboard."
      />
      <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={onSubmit}>
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
          invalid={Boolean(error)}
          disabled={busy}
        />
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy || pin.length < MIN_PIN_LENGTH}>
          {busy ? "Verifying…" : "Unlock tutor mode"}
        </Button>
      </form>
      <Divider />
      <Button
        variant="ghost"
        onClick={enterStudent}
        className="text-muted hover:text-app"
        size="sm"
      >
        Continue to student practice →
      </Button>
    </FullScreen>
  );
}

function SetupPinForm() {
  const { setupPin } = useAppMode();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    <FullScreen>
      <Header
        eyebrow="First time setup"
        title="Set your tutor PIN"
        subtitle="This PIN protects the tutor dashboard. Pick something memorable — it can't be recovered, only reset by clearing the local DB."
      />
      <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={onSubmit}>
        <PinInput
          ref={inputRef}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.slice(0, MAX_PIN_LENGTH));
            if (error) setError(null);
          }}
          aria-label="New PIN"
          maxLength={MAX_PIN_LENGTH}
          invalid={Boolean(error)}
          disabled={busy}
        />
        <PinInput
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value.slice(0, MAX_PIN_LENGTH));
            if (error) setError(null);
          }}
          aria-label="Confirm PIN"
          maxLength={MAX_PIN_LENGTH}
          invalid={Boolean(error)}
          disabled={busy}
          placeholder="Confirm"
        />
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy || pin.length < MIN_PIN_LENGTH}>
          {busy ? "Saving…" : "Set PIN & continue"}
        </Button>
      </form>
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

function Divider() {
  return (
    <div className="flex w-full max-w-sm items-center gap-3 text-xs text-muted-2">
      <span className="h-px flex-1 bg-border-subtle" />
      <span>or</span>
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}
