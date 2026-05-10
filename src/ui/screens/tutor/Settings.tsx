import { api } from "@/lib/api";
import { useAppMode } from "@/providers/AppModeProvider";
import { Button } from "@/ui/components/Button";
import { PageHeader } from "@/ui/components/PageHeader";
import { PinInput } from "@/ui/components/PinInput";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

const MIN_PIN = 4;
const MAX_PIN = 12;
const SOUND_KEY = "rewards_sound_enabled";

export function TutorSettings() {
  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Settings"
        subtitle="Tutor PIN management + reward feedback. Theme, locale, and idle-timeout knobs land in later PRs."
      />
      <section className="grid grid-cols-1 gap-6 px-8 py-6 lg:grid-cols-2">
        <ChangePinCard />
        <RewardSoundCard />
      </section>
    </>
  );
}

function RewardSoundCard() {
  const queryClient = useQueryClient();
  const settingQ = useQuery({
    queryKey: ["settings", "get", SOUND_KEY],
    queryFn: () => api.settings.get<boolean>({ key: SOUND_KEY }),
  });
  const setMutation = useMutation({
    mutationFn: (next: boolean) => api.settings.set({ key: SOUND_KEY, value: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "get", SOUND_KEY] });
    },
  });

  const enabled = settingQ.data === true;

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-1 p-6">
      <header className="mb-4 flex flex-col gap-1">
        <h2 className="text-base font-semibold">Reward sound</h2>
        <p className="text-xs text-muted">
          Plays a soft chime when a student hits a 5- or 10-in-a-row streak inside a session. Off by
          default; the visual celebration (confetti + toast) is always on.
        </p>
      </header>
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={settingQ.isLoading || setMutation.isPending}
          onChange={(e) => setMutation.mutate(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-accent"
        />
        <span>{enabled ? "Sound effects enabled" : "Sound effects muted"}</span>
      </label>
    </article>
  );
}

function ChangePinCard() {
  const { changePin } = useAppMode();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (next.length < MIN_PIN) {
      setError(`New PIN must be at least ${MIN_PIN} characters`);
      return;
    }
    if (next !== confirm) {
      setError("New PIN and confirmation do not match");
      return;
    }
    setBusy(true);
    try {
      await changePin(current, next);
      setSuccess("PIN updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-1 p-6">
      <header className="mb-4 flex flex-col gap-1">
        <h2 className="text-base font-semibold">Change tutor PIN</h2>
        <p className="text-xs text-muted">
          You'll be asked for the current PIN before the new one is saved. Locked sessions
          auto-redirect to PIN entry until the new PIN matches.
        </p>
      </header>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <PinInput
          aria-label="Current PIN"
          value={current}
          onChange={(e) => setCurrent(e.target.value.slice(0, MAX_PIN))}
          placeholder="Current"
          disabled={busy}
          maxLength={MAX_PIN}
        />
        <PinInput
          aria-label="New PIN"
          value={next}
          onChange={(e) => setNext(e.target.value.slice(0, MAX_PIN))}
          placeholder="New PIN"
          disabled={busy}
          maxLength={MAX_PIN}
          invalid={Boolean(error)}
        />
        <PinInput
          aria-label="Confirm new PIN"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.slice(0, MAX_PIN))}
          placeholder="Confirm new PIN"
          disabled={busy}
          maxLength={MAX_PIN}
          invalid={Boolean(error)}
        />
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <output className="block rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
            {success}
          </output>
        ) : null}
        <Button
          type="submit"
          disabled={busy || !current || next.length < MIN_PIN}
          className="self-start"
        >
          {busy ? "Saving…" : "Update PIN"}
        </Button>
      </form>
    </article>
  );
}
