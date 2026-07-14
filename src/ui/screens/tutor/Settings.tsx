import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import {
  type ExerciseSessionMode,
  exerciseSessionModeOptions,
} from "@/modules/exercises/sessionModes";
import { DEFAULT_PRONUNCIATION_POLICY } from "@/modules/pronunciation";
import { SETTINGS_KEYS } from "@/modules/settings/keys";
import { useAppMode } from "@/providers/AppModeProvider";
import {
  DISPLAY_PREFERENCE_SETTING_KEYS,
  type DisplayFontSize,
  type PronunciationAccentPreference,
  useDisplayPreferences,
} from "@/providers/DisplayPreferencesProvider";
import { THEME_SETTING_KEY, type ThemePreference, useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/ui/components/Button";
import { PageHeader } from "@/ui/components/PageHeader";
import { PinInput } from "@/ui/components/PinInput";
import {
  TutorSegmentedControl,
  TutorSelectField,
  TutorSwitchField,
  TutorTextField,
} from "@/ui/tutor/components/Material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

const MIN_PIN = 4;
const MAX_PIN = 12;

const SOUND_KEY = "rewards_sound_enabled";
const SETTINGS = {
  dictionaryPackPath: "dictionary_pack_path",
  sessionCount: "session_default_count",
  sessionMode: "session_default_mode",
  sessionShuffle: "session_shuffle",
  unitReviewExcludeSpeaking: SETTINGS_KEYS.unitReviewExcludeSpeaking,
  definitionPriority: "definition_priority",
  cameraCheckinsEnabled: "session_camera_checkins_enabled",
  screenshotsEnabled: SETTINGS_KEYS.screenshotsEnabled,
  idleTimeout: "idle_timeout_minutes",
  lockOnClose: "lock_on_close",
  fsrsShortTermDays: "fsrs_short_term_days",
  fsrsLongTermDays: "fsrs_long_term_days",
} as const;

const LEGACY_SETTING_KEYS = ["display_compact", "locale"] as const;
const RESETTABLE_KEYS = [
  THEME_SETTING_KEY,
  SOUND_KEY,
  ...Object.values(DISPLAY_PREFERENCE_SETTING_KEYS),
  ...Object.values(SETTINGS),
  SETTINGS_KEYS.pronunciationMaxErrorRate,
  SETTINGS_KEYS.pronunciationMinDurationMs,
  SETTINGS_KEYS.pronunciationMinRms,
  ...LEGACY_SETTING_KEYS,
];

export function TutorSettings() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure tutor access, the learning experience, and local data sources."
      />
      <section className="grid max-w-[90rem] grid-cols-1 gap-6 px-6 pb-12 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <header className="px-1">
            <h2 className="text-sm font-semibold text-app">Access and storage</h2>
            <p className="mt-1 text-xs text-muted">Tutor security and data kept on this device.</p>
          </header>
          <div className="grouped-list [&>section:last-child]:border-b-0">
            <ChangePinCard />
            <AutoLockCard />
            <DictionaryPackCard />
            <AboutCard />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <header className="px-1">
            <h2 className="text-sm font-semibold text-app">Learning experience</h2>
            <p className="mt-1 text-xs text-muted">
              Defaults shared by student sessions and pronunciation review.
            </p>
          </header>
          <div className="grouped-list [&>section:last-child]:border-b-0">
            <PreferencesCard />
            <SessionDefaultsCard />
            <SrsThresholdsCard />
            <PronunciationPolicyCard />
          </div>
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
  const {
    fontSize,
    setFontSize,
    pronunciationAutoplay,
    setPronunciationAutoplay,
    pronunciationAccent,
    setPronunciationAccent,
  } = useDisplayPreferences();
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
      <div className="grouped-list divide-y divide-border-subtle bg-surface-2">
        <PreferenceRow title="Theme">
          <TutorSegmentedControl
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
            label="Reward sounds"
            description={
              soundEnabled ? "Achievement chimes are enabled." : "Achievement chimes are muted."
            }
            checked={soundEnabled}
            disabled={sound.loading || sound.saving}
            onChange={sound.setValue}
          />
        </PreferenceRow>

        <PreferenceRow title="Pronunciation">
          <div className="grid gap-3 lg:grid-cols-[1fr_12rem]">
            <SettingToggle
              label="Autoplay headword audio"
              description={
                pronunciationAutoplay
                  ? "Cards play pronunciation when they appear."
                  : "Students tap the audio button manually."
              }
              checked={pronunciationAutoplay}
              onChange={setPronunciationAutoplay}
            />
            <SettingSelect
              label="Default accent"
              value={pronunciationAccent}
              options={[
                ["uk", "UK"],
                ["us", "US"],
                ["any", "Any available"],
              ]}
              onChange={(value) => setPronunciationAccent(value as PronunciationAccentPreference)}
            />
          </div>
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
  const mode = useSetting<ExerciseSessionMode>(SETTINGS.sessionMode, "mixed");
  const shuffle = useSetting<boolean>(SETTINGS.sessionShuffle, true);
  const excludeSpeaking = useSetting<boolean>(SETTINGS.unitReviewExcludeSpeaking, false);
  const cameraCheckins = useSetting<boolean>(SETTINGS.cameraCheckinsEnabled, false);
  const screenshots = useSetting<boolean>(SETTINGS.screenshotsEnabled, false);

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
          options={exerciseSessionModeOptions.map((option) => [option.value, option.label])}
          onChange={(value) => mode.setValue(value as ExerciseSessionMode)}
        />
        <SettingToggle
          label="Shuffle"
          checked={shuffle.value === true}
          disabled={shuffle.loading || shuffle.saving}
          description="Randomize eligible cards in each deck."
          onChange={shuffle.setValue}
        />
      </div>
      <SettingToggle
        label="Exclude speaking in unit review"
        checked={excludeSpeaking.value === true}
        disabled={excludeSpeaking.loading || excludeSpeaking.saving}
        description={
          excludeSpeaking.value === true
            ? "Unit review decks skip pronunciation cards."
            : "Unit review decks can include pronunciation cards."
        }
        onChange={excludeSpeaking.setValue}
      />
      <SettingToggle
        label="Camera check-ins"
        checked={cameraCheckins.value === true}
        disabled={cameraCheckins.loading || cameraCheckins.saving}
        description={
          cameraCheckins.value === true
            ? "Student sessions start camera check-ins automatically after OS permission is available."
            : "Student sessions track timing and focus only."
        }
        onChange={cameraCheckins.setValue}
      />
      <SettingToggle
        label="Allow screenshots"
        checked={screenshots.value === true}
        disabled={screenshots.loading || screenshots.saving}
        description={
          screenshots.value === true
            ? "Students can capture student-session windows."
            : "Student-session windows ask the OS to block screen capture where supported."
        }
        onChange={screenshots.setValue}
      />
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
        <SettingNumberInput
          label="Short-term (days)"
          value={shortTerm.value}
          disabled={shortTerm.loading || shortTerm.saving}
          min={0.5}
          max={30}
          step={0.5}
          supportingText="Default: 1 day"
          onCommit={shortTerm.setValue}
        />
        <SettingNumberInput
          label="Long-term (days)"
          value={longTerm.value}
          disabled={longTerm.loading || longTerm.saving}
          min={1}
          max={365}
          step={1}
          supportingText="Default: 21 days"
          onCommit={longTerm.setValue}
        />
      </div>
    </SettingsCard>
  );
}

function PronunciationPolicyCard() {
  // CAPT scoring policy lives in app_settings; the backend reads these on every
  // assess call via electron/ipc/procedures/pronunciation.ts and clamps them in
  // normalizePronunciationPolicy. Pass threshold is derived from max-error rate.
  const maxErrorRate = useSetting<number>(
    SETTINGS_KEYS.pronunciationMaxErrorRate,
    DEFAULT_PRONUNCIATION_POLICY.maxErrorRate,
  );
  const minDuration = useSetting<number>(
    SETTINGS_KEYS.pronunciationMinDurationMs,
    DEFAULT_PRONUNCIATION_POLICY.minDurationMs,
  );
  const minRms = useSetting<number>(
    SETTINGS_KEYS.pronunciationMinRms,
    DEFAULT_PRONUNCIATION_POLICY.minRms,
  );
  const percent = Math.round(maxErrorRate.value * 100);
  const passThreshold = Math.round((1 - maxErrorRate.value) * 100);

  return (
    <SettingsCard
      title="Pronunciation policy"
      description="Retry thresholds the HuBERT scorer uses for student attempts."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <SettingNumberInput
          label="Max error rate (%)"
          value={percent}
          disabled={maxErrorRate.loading || maxErrorRate.saving}
          min={5}
          max={80}
          step={1}
          supportingText={`Pass threshold: ${passThreshold}/100`}
          onCommit={(next) => maxErrorRate.setValue(next / 100)}
        />
        <SettingNumberInput
          label="Min recording (ms)"
          value={minDuration.value}
          disabled={minDuration.loading || minDuration.saving}
          min={200}
          max={3000}
          step={100}
          supportingText={`Default: ${DEFAULT_PRONUNCIATION_POLICY.minDurationMs} ms`}
          onCommit={minDuration.setValue}
        />
      </div>
      <SettingNumberInput
        label="Min microphone level (RMS)"
        value={minRms.value}
        disabled={minRms.loading || minRms.saving}
        min={0.001}
        max={0.08}
        step={0.001}
        supportingText={`Default: ${DEFAULT_PRONUNCIATION_POLICY.minRms} · raise to reject quieter takes`}
        onCommit={minRms.setValue}
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
        <dd className="tabular-nums text-app">{status?.entryCount.toLocaleString() ?? "0"}</dd>
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
  const { resetTheme } = useTheme();
  const { resetDisplayPreferences } = useDisplayPreferences();
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
      resetTheme();
      resetDisplayPreferences();
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
            className="border-l-2 border-danger bg-danger/8 px-3 py-2 text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <output className="block border-l-2 border-success bg-success/8 px-3 py-2 text-xs text-success">
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
    <section className={`border-b border-border-subtle px-5 py-5 ${className ?? ""}`}>
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-app">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      </header>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </section>
  );
}

function PreferenceRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_minmax(0,1fr)] md:items-center">
      <h3 className="text-xs font-semibold text-muted-2">{title}</h3>
      <div className="min-w-0">{children}</div>
    </section>
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
    <TutorSelectField
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

function SettingNumberInput({
  label,
  value,
  min,
  max,
  step,
  disabled,
  supportingText,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  supportingText?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = useCallback(() => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setDraft(String(value));
      return;
    }
    onCommit(parsed);
  }, [draft, max, min, onCommit, value]);

  return (
    <TutorTextField
      label={label}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft}
      disabled={disabled}
      supportingText={supportingText}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function SettingToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <TutorSwitchField
      label={label}
      description={description}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
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
