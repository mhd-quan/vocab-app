import type { PracticeMode } from "@/data/schema";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { useAppMode } from "@/providers/AppModeProvider";
import {
  type DisplayFontSize,
  useDisplayPreferences,
} from "@/providers/DisplayPreferencesProvider";
import { type ThemePreference, useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/ui/components/Button";
import { PageHeader } from "@/ui/components/PageHeader";
import { PinInput } from "@/ui/components/PinInput";
import { MdSelectField } from "@/ui/tutor/components/MdSelectField";
import { MdSwitchField } from "@/ui/tutor/components/MdSwitchField";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useCallback, useState } from "react";

const MIN_PIN = 4;
const MAX_PIN = 12;

const SOUND_KEY = "rewards_sound_enabled";
const SETTINGS = {
  dictionaryPackPath: "dictionary_pack_path",
  sessionCount: "session_default_count",
  sessionMode: "session_default_mode",
  sessionShuffle: "session_shuffle",
  definitionPriority: "definition_priority",
  idleTimeout: "idle_timeout_minutes",
  lockOnClose: "lock_on_close",
  fsrsShortTermDays: "fsrs_short_term_days",
  fsrsLongTermDays: "fsrs_long_term_days",
} as const;

const LEGACY_SETTING_KEYS = ["display_compact", "locale"] as const;
const RESETTABLE_KEYS = [
  "theme",
  SOUND_KEY,
  "display_font_size",
  ...Object.values(SETTINGS),
  ...LEGACY_SETTING_KEYS,
];

export function TutorSettings() {
  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Settings"
        subtitle="Tutor access, display, session defaults, and local app preferences."
      />
      <section className="grid grid-cols-1 gap-5 px-8 py-6 xl:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <ChangePinCard />
          <AutoLockCard />
          <DictionaryPackCard />
          <AboutCard />
        </div>
        <div className="flex flex-col gap-5">
          <PreferencesCard />
          <SessionDefaultsCard />
          <SrsThresholdsCard />
        </div>
      </section>
    </>
  );
}

function PreferencesCard() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  // Display preferences provider owns autoplay state — using the provider
  // (instead of the generic useSetting) keeps a single source of truth so
  // any in-session card reads the same boolean a re-render later.
  const { fontSize, setFontSize, pronunciationAutoplay, setPronunciationAutoplay } =
    useDisplayPreferences();
  const sound = useSetting<boolean>(SOUND_KEY, false);
  const priority = useSetting<string>(SETTINGS.definitionPriority, "en_first");
  const soundEnabled = sound.value === true;
  const options: Array<{ value: ThemePreference; label: string; detail: string }> = [
    { value: "light", label: "Light", detail: "Bright" },
    { value: "dark", label: "Dark", detail: "Dim" },
    { value: "system", label: "System", detail: resolvedTheme },
  ];

  return (
    <SettingsCard title="Preferences" description="Appearance and learner feedback.">
      <div className="divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle bg-surface-0/70">
        <PreferenceRow title="Theme">
          <SegmentedControl
            value={theme}
            options={options.map((option) => ({
              value: option.value,
              label: option.label,
              detail: option.detail,
            }))}
            onChange={(value) => setTheme(value as ThemePreference)}
          />
        </PreferenceRow>

        <PreferenceRow title="Display">
          <SettingSelect
            label="Font size"
            value={fontSize}
            options={[
              ["small", "Small"],
              ["medium", "Medium"],
              ["large", "Large"],
            ]}
            onChange={(value) => setFontSize(value as DisplayFontSize)}
          />
        </PreferenceRow>

        <PreferenceRow title="Reward sound">
          <SettingToggle
            label={soundEnabled ? "Reward sounds enabled" : "Reward sounds muted"}
            checked={soundEnabled}
            disabled={sound.loading || sound.saving}
            onChange={sound.setValue}
          />
        </PreferenceRow>

        <PreferenceRow title="Pronunciation autoplay">
          <MdSwitchField
            label={
              pronunciationAutoplay
                ? "Autoplay headword audio on every new card"
                : "Manual playback only — kid taps to listen"
            }
            checked={pronunciationAutoplay}
            onChange={setPronunciationAutoplay}
          />
        </PreferenceRow>

        <PreferenceRow title="Definition order">
          <SettingSelect
            label="Definition order"
            value={priority.value}
            disabled={priority.loading || priority.saving}
            options={[
              ["en_first", "English first"],
              ["vi_first", "Vietnamese first"],
            ]}
            onChange={priority.setValue}
          />
        </PreferenceRow>
      </div>
    </SettingsCard>
  );
}

function SessionDefaultsCard() {
  const count = useSetting<number>(SETTINGS.sessionCount, 15);
  const mode = useSetting<PracticeMode>(SETTINGS.sessionMode, "mixed");
  const shuffle = useSetting<boolean>(SETTINGS.sessionShuffle, true);

  return (
    <SettingsCard title="Session defaults" description="Starting values for student sessions.">
      <div className="grid gap-3 lg:grid-cols-[10rem_1fr_auto] lg:items-end">
        <SettingSelect
          label="Count"
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
          label="Shuffle"
          checked={shuffle.value === true}
          disabled={shuffle.loading || shuffle.saving}
          onChange={shuffle.setValue}
        />
      </div>
    </SettingsCard>
  );
}

function SrsThresholdsCard() {
  // FSRS-lite state transitions: stability < shortTerm → "learning",
  // stability ≥ shortTerm → "short_term", stability ≥ longTerm → "long_term".
  // The defaults (1 / 21 days) are what the migration seeded.
  const shortTerm = useSetting<number>(SETTINGS.fsrsShortTermDays, 1);
  const longTerm = useSetting<number>(SETTINGS.fsrsLongTermDays, 21);

  return (
    <SettingsCard
      title="SRS thresholds"
      description="Tune how aggressively FSRS-lite graduates words to short-term and long-term memory."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <SettingSelect
          label="Short-term (days)"
          value={String(shortTerm.value)}
          disabled={shortTerm.loading || shortTerm.saving}
          options={[
            ["0.5", "0.5 — same day"],
            ["1", "1 — next day (default)"],
            ["2", "2 days"],
            ["3", "3 days"],
          ]}
          onChange={(value) => shortTerm.setValue(Number(value))}
        />
        <SettingSelect
          label="Long-term (days)"
          value={String(longTerm.value)}
          disabled={longTerm.loading || longTerm.saving}
          options={[
            ["7", "7 — weekly"],
            ["14", "14 — fortnightly"],
            ["21", "21 (default)"],
            ["30", "30 — monthly"],
          ]}
          onChange={(value) => longTerm.setValue(Number(value))}
        />
      </div>
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

function DictionaryPackCard() {
  const queryClient = useQueryClient();
  const statusQ = useQuery({
    queryKey: queryKeys.dictionary.status(),
    queryFn: () => api.dictionary.status(),
  });
  const selectMutation = useMutation({
    mutationFn: () => api.dictionary.selectPackFolder(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.status() });
    },
  });
  const clearMutation = useMutation({
    mutationFn: () => api.dictionary.clearPackFolder(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.status() });
    },
  });
  const status = statusQ.data;

  return (
    <SettingsCard title="Dictionary pack" description="External OALD10 assets.">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted">Status</dt>
        <dd className={status?.active ? "text-success" : "text-muted-2"}>
          {status?.active ? "Active" : "Not installed"}
        </dd>
        <dt className="text-muted">Entries</dt>
        <dd className="font-mono text-app">{status?.entryCount.toLocaleString() ?? "0"}</dd>
        <dt className="text-muted">Source</dt>
        <dd className="font-mono text-muted-2">{status?.sourceFile ?? "—"}</dd>
        <dt className="text-muted">Folder</dt>
        <dd className="break-all font-mono text-muted-2">{status?.packPath ?? "—"}</dd>
        {status?.files.length ? (
          <>
            <dt className="text-muted">Assets</dt>
            <dd className="text-muted-2">
              {status.files.map((file) => `${file.name} ${formatBytes(file.bytes)}`).join(", ")}
            </dd>
          </>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => selectMutation.mutate()}
          disabled={selectMutation.isPending}
        >
          {selectMutation.isPending ? "Selecting..." : "Select pack"}
        </Button>
        {status?.packPath ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            Clear path
          </Button>
        ) : null}
      </div>
      {selectMutation.isError ? (
        <p className="text-xs text-danger">
          {selectMutation.error instanceof Error
            ? selectMutation.error.message
            : "Could not select pack."}
        </p>
      ) : null}
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
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.status() });
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

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
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
          density="compact"
        />
        <PinInput
          aria-label="New PIN"
          value={next}
          onChange={(e) => setNext(e.target.value.slice(0, MAX_PIN))}
          placeholder="New PIN"
          disabled={busy}
          maxLength={MAX_PIN}
          density="compact"
          invalid={Boolean(error)}
        />
        <PinInput
          aria-label="Confirm new PIN"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.slice(0, MAX_PIN))}
          placeholder="Confirm new PIN"
          disabled={busy}
          maxLength={MAX_PIN}
          density="compact"
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
          size="sm"
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
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-sm",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted">{description}</p>
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </article>
  );
}

function PreferenceRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr] md:items-center">
      <h3 className="text-xs font-semibold uppercase text-muted-2">{title}</h3>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string; detail?: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-0 rounded-lg px-3 py-2 text-left transition-[background-color,color,box-shadow]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
              active ? "bg-surface-1 text-app shadow-sm" : "text-muted hover:text-app",
            )}
          >
            <span className="block truncate text-sm font-semibold">{option.label}</span>
            {option.detail ? (
              <span className="mt-0.5 block truncate text-[10px] uppercase text-muted-2">
                {option.detail}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Settings selects/toggles route through Material wrappers in tutor mode
 * so the entire form picks up M3 typography, focus rings, and ripples
 * from `@material/web`. The public shape of these helpers is preserved
 * so every call site keeps working without edits.
 */
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
    <MdSelectField
      label={label}
      value={value}
      disabled={disabled}
      options={options.map(([optionValue, optionLabel]) => ({
        value: optionValue,
        label: optionLabel,
      }))}
      onChange={onChange}
    />
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
  return <MdSwitchField label={label} checked={checked} disabled={disabled} onChange={onChange} />;
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
