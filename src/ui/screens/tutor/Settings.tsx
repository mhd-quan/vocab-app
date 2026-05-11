import type { PracticeMode } from "@/data/schema";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAppMode } from "@/providers/AppModeProvider";
import { type ThemePreference, useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { PageHeader } from "@/ui/components/PageHeader";
import { PinInput } from "@/ui/components/PinInput";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useCallback, useState } from "react";

const MIN_PIN = 4;
const MAX_PIN = 12;

const SOUND_KEY = "rewards_sound_enabled";
const SETTINGS = {
  sessionCount: "session_default_count",
  sessionMode: "session_default_mode",
  sessionShuffle: "session_shuffle",
  fontSize: "display_font_size",
  compact: "display_compact",
  locale: "locale",
  definitionPriority: "definition_priority",
  idleTimeout: "idle_timeout_minutes",
  lockOnClose: "lock_on_close",
} as const;

const RESETTABLE_KEYS = ["theme", SOUND_KEY, ...Object.values(SETTINGS)];

export function TutorSettings() {
  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Settings"
        subtitle="Tutor access, display, session defaults, and local app preferences."
      />
      <section className="grid grid-cols-1 gap-6 px-8 py-6 md:grid-cols-2 xl:grid-cols-3">
        <ChangePinCard />
        <ThemeCard />
        <RewardSoundCard />
        <SessionDefaultsCard />
        <DisplayCard />
        <LanguageCard />
        <AutoLockCard />
        <AboutCard />
      </section>
    </>
  );
}

function ThemeCard() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const options: Array<{ value: ThemePreference; label: string; detail: string }> = [
    { value: "light", label: "Light", detail: "Bright" },
    { value: "dark", label: "Dark", detail: "Dim" },
    { value: "system", label: "System", detail: resolvedTheme },
  ];

  return (
    <SettingsCard title="Theme" description="Choose the app appearance.">
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                active
                  ? "border-accent bg-accent/10 text-app"
                  : "border-border-subtle bg-surface-0 text-muted hover:border-border-strong hover:text-app",
              )}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-[10px] uppercase text-muted-2">{option.detail}</span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

function RewardSoundCard() {
  const sound = useSetting<boolean>(SOUND_KEY, false);
  const enabled = sound.value === true;

  return (
    <SettingsCard title="Reward sound" description="Optional chime for in-session streak rewards.">
      <SettingToggle
        label={enabled ? "Sound effects enabled" : "Sound effects muted"}
        checked={enabled}
        disabled={sound.loading || sound.saving}
        onChange={sound.setValue}
      />
    </SettingsCard>
  );
}

function SessionDefaultsCard() {
  const count = useSetting<number>(SETTINGS.sessionCount, 15);
  const mode = useSetting<PracticeMode>(SETTINGS.sessionMode, "mixed");
  const shuffle = useSetting<boolean>(SETTINGS.sessionShuffle, true);

  return (
    <SettingsCard title="Session defaults" description="Starting values for student sessions.">
      <SettingSelect
        label="Exercise count"
        value={String(count.value)}
        disabled={count.loading || count.saving}
        options={[
          ["5", "5"],
          ["10", "10"],
          ["15", "15"],
          ["20", "20"],
          ["30", "30"],
        ]}
        onChange={(value) => count.setValue(Number(value))}
      />
      <SettingSelect
        label="Mode"
        value={mode.value}
        disabled={mode.loading || mode.saving}
        options={[
          ["mixed", "Mixed"],
          ["flashcard", "Flashcard"],
          ["multiple_choice", "Multiple choice"],
        ]}
        onChange={(value) => mode.setValue(value as PracticeMode)}
      />
      <SettingToggle
        label="Shuffle exercises"
        checked={shuffle.value === true}
        disabled={shuffle.loading || shuffle.saving}
        onChange={shuffle.setValue}
      />
    </SettingsCard>
  );
}

function DisplayCard() {
  const fontSize = useSetting<string>(SETTINGS.fontSize, "medium");
  const compact = useSetting<boolean>(SETTINGS.compact, false);

  return (
    <SettingsCard title="Display" description="Reading density and typography.">
      <SettingSelect
        label="Font size"
        value={fontSize.value}
        disabled={fontSize.loading || fontSize.saving}
        options={[
          ["small", "Small"],
          ["medium", "Medium"],
          ["large", "Large"],
        ]}
        onChange={fontSize.setValue}
      />
      <SettingToggle
        label="Compact mode"
        checked={compact.value === true}
        disabled={compact.loading || compact.saving}
        onChange={compact.setValue}
      />
    </SettingsCard>
  );
}

function LanguageCard() {
  const locale = useSetting<string>(SETTINGS.locale, "en");
  const priority = useSetting<string>(SETTINGS.definitionPriority, "en_first");

  return (
    <SettingsCard title="Language" description="Locale and definition order.">
      <SettingSelect
        label="App language"
        value={locale.value}
        disabled={locale.loading || locale.saving}
        options={[
          ["en", "English"],
          ["vi", "Vietnamese"],
        ]}
        onChange={locale.setValue}
      />
      <SettingSelect
        label="Definition priority"
        value={priority.value}
        disabled={priority.loading || priority.saving}
        options={[
          ["en_first", "English first"],
          ["vi_first", "Vietnamese first"],
        ]}
        onChange={priority.setValue}
      />
    </SettingsCard>
  );
}

function AutoLockCard() {
  const timeout = useSetting<number>(SETTINGS.idleTimeout, 15);
  const lockOnClose = useSetting<boolean>(SETTINGS.lockOnClose, true);

  return (
    <SettingsCard title="Auto-lock" description="Tutor lock behavior.">
      <SettingSelect
        label="Idle timeout"
        value={String(timeout.value)}
        disabled={timeout.loading || timeout.saving}
        options={[
          ["0", "Off"],
          ["5", "5 minutes"],
          ["15", "15 minutes"],
          ["30", "30 minutes"],
          ["60", "60 minutes"],
        ]}
        onChange={(value) => timeout.setValue(Number(value))}
      />
      <SettingToggle
        label="Lock on window close"
        checked={lockOnClose.value === true}
        disabled={lockOnClose.loading || lockOnClose.saving}
        onChange={lockOnClose.setValue}
      />
    </SettingsCard>
  );
}

function AboutCard() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const infoQ = useQuery({
    queryKey: ["meta", "appInfo"],
    queryFn: () => api.meta.appInfo(),
  });
  const resetMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(RESETTABLE_KEYS.map((key) => api.settings.delete({ key })));
    },
    onSuccess: () => {
      for (const key of RESETTABLE_KEYS) {
        queryClient.invalidateQueries({ queryKey: settingKey(key) });
      }
      queryClient.invalidateQueries({ queryKey: ["meta", "appInfo"] });
      setConfirming(false);
    },
  });

  return (
    <SettingsCard title="About" description="Version and local storage.">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted">Version</dt>
        <dd className="font-mono text-app">{api.app.version}</dd>
        <dt className="text-muted">Database</dt>
        <dd className="break-all font-mono text-muted-2">{infoQ.data?.dbPath ?? "Loading..."}</dd>
      </dl>
      <Button
        variant={confirming ? "danger" : "secondary"}
        size="sm"
        disabled={resetMutation.isPending}
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          resetMutation.mutate();
        }}
      >
        {resetMutation.isPending
          ? "Resetting..."
          : confirming
            ? "Confirm reset"
            : "Reset preferences"}
      </Button>
    </SettingsCard>
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
    <SettingsCard
      title="Change tutor PIN"
      description="Current PIN is required before saving a replacement."
    >
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
            className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <output className="block rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
            {success}
          </output>
        ) : null}
        <Button
          type="submit"
          disabled={busy || !current || next.length < MIN_PIN}
          className="self-start"
        >
          {busy ? "Saving..." : "Update PIN"}
        </Button>
      </form>
    </SettingsCard>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-1 p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted">{description}</p>
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </article>
  );
}

function SettingSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-border-subtle bg-surface-0 px-3 text-sm text-app outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SettingToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-accent disabled:cursor-not-allowed"
      />
      <span>{label}</span>
    </label>
  );
}

function useSetting<T>(key: string, fallback: T) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: settingKey(key),
    queryFn: () => api.settings.get<T>({ key }),
  });
  const mutation = useMutation({
    mutationFn: (value: T) => api.settings.set({ key, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingKey(key) });
    },
  });
  const setValue = useCallback((value: T) => mutation.mutate(value), [mutation]);

  return {
    value: query.data ?? fallback,
    loading: query.isLoading,
    saving: mutation.isPending,
    setValue,
  };
}

function settingKey(key: string) {
  return ["settings", "get", key] as const;
}
