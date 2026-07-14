import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryClient, queryKeys } from "@/lib/queryClient";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field, TextInput, useFieldId } from "@/ui/components/Field";
import { PinInput } from "@/ui/components/PinInput";
import { PROFILE_COLORS } from "@/ui/design/profileColors";
import {
  MASCOTS,
  type MascotId,
  MascotStill,
  defaultMascotForSeed,
  isMascotId,
  mascotSettingKey,
} from "@/ui/student/mascot";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useState } from "react";

const BG_PRESETS = [
  { id: "none", label: "Paper", value: "" },
  { id: "parchment", label: "Parchment", value: "#eee9df" },
  { id: "sage", label: "Sage", value: "#e2e9e1" },
  { id: "sky", label: "Mist", value: "#e3ebef" },
  { id: "lavender", label: "Lavender", value: "#e9e5ed" },
  { id: "clay", label: "Clay", value: "#eee1dc" },
  { id: "slate", label: "Slate", value: "#e5e7e8" },
];
const BACKGROUND_MAX_EDGE = 1920;
const BACKGROUND_INLINE_LIMIT_BYTES = 1_500_000;
const BACKGROUND_JPEG_QUALITY = 0.82;
const BACKGROUND_SIZE_OPTIONS = [
  { id: "cover", label: "Fill screen", value: "cover" },
  { id: "contain", label: "Fit image", value: "contain" },
  { id: "auto", label: "Tile original", value: "auto" },
] as const;
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;
type BackgroundSizeMode = (typeof BACKGROUND_SIZE_OPTIONS)[number]["value"];

export function StudentSettings() {
  const { studentId } = useParams({ from: "/student/profile/$studentId/settings" });
  const id = Number(studentId);
  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(id),
    queryFn: () => api.students.getById({ id }),
    enabled: Number.isFinite(id) && id > 0,
  });
  const bgQ = useQuery({
    queryKey: queryKeys.studentPrefs.studyBackground(id),
    queryFn: () => api.settings.get<string>({ key: bgKey(id) }),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const pinQ = useQuery({
    queryKey: queryKeys.students.hasPin(id),
    queryFn: () => api.students.hasPin({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });
  const [nickname, setNickname] = useState<string | null>(null);
  const [backgroundSize, setBackgroundSize] = useState<BackgroundSizeMode>("cover");
  const nicknameId = useFieldId("student-nickname");
  const student = studentQ.data;
  const display = nickname ?? student?.displayName ?? student?.name ?? "";
  const saveStudent = useMutation({
    mutationFn: (patch: { displayName?: string | null; color?: string | null }) =>
      api.students.update({ id, patch }),
    onSuccess: (updated, patch) => {
      queryClient.setQueryData(queryKeys.students.byId(id), updated);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      if (patch.displayName !== undefined) setNickname(null);
    },
  });
  const saveBg = useMutation({
    mutationFn: (value: string) => api.settings.set({ key: bgKey(id), value }),
    onSuccess: (_result, value) =>
      queryClient.setQueryData(queryKeys.studentPrefs.studyBackground(id), value),
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
      <header className="flex items-center gap-3">
        <Avatar
          name={display || "?"}
          avatarSeed={student?.avatarSeed ?? null}
          color={student?.color}
          size="md"
        />
        <div>
          <h1 className="text-title font-semibold">Profile settings</h1>
          <p className="mt-0.5 text-sm text-muted">Identity, workspace, and profile access.</p>
        </div>
      </header>

      <div className="grouped-list divide-y divide-border-subtle">
        <StudentSettingsSection title="Nickname">
          <div className="flex max-w-xl items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Nickname" htmlFor={nicknameId}>
                <TextInput
                  id={nicknameId}
                  value={nickname ?? student?.displayName ?? ""}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={80}
                />
              </Field>
            </div>
            <Button
              onClick={() =>
                saveStudent.mutate({
                  displayName: (nickname ?? student?.displayName ?? "").trim() || null,
                })
              }
              disabled={saveStudent.isPending || nickname === null}
            >
              Save
            </Button>
          </div>
        </StudentSettingsSection>

        <StudentSettingsSection title="Profile color">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Profile color">
            {PROFILE_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={cn(
                  "ui-focus-ring h-9 w-9 rounded-full border-[3px] border-paper outline outline-1 transition-[outline-color]",
                  student?.color === color.value
                    ? "outline-2 outline-accent"
                    : "outline-border-subtle hover:outline-border-strong",
                )}
                style={{ backgroundColor: color.value }}
                onClick={() => saveStudent.mutate({ color: color.value })}
                aria-label={color.name}
                aria-pressed={student?.color === color.value}
              />
            ))}
          </div>
        </StudentSettingsSection>

        <MascotCard studentId={id} />

        <PasswordCard studentId={id} hasPin={pinQ.data === true} />

        <StudentSettingsSection title="Study background">
          <p className="mt-1 text-sm text-muted">
            Keep the reading surfaces clear while choosing the canvas around them.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {BG_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={(bgQ.data ?? "") === preset.value}
                className={cn(
                  "ui-focus-ring h-20 rounded-object border bg-paper p-3 text-left text-xs font-semibold transition-colors",
                  (bgQ.data ?? "") === preset.value
                    ? "border-accent ring-1 ring-accent/20"
                    : "border-border-subtle hover:border-border-strong",
                )}
                style={{ backgroundColor: preset.value || "rgb(var(--color-surface-1))" }}
                onClick={() => saveBg.mutate(preset.value)}
              >
                <span className="inline-flex rounded-control border border-black/10 bg-[#fcfcfa]/90 px-2 py-1 text-[#222220]">
                  {preset.label}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {BACKGROUND_SIZE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={backgroundSize === option.value}
                className={cn(
                  "ui-focus-ring rounded-control border px-3 py-2 text-xs font-medium transition-[background-color,border-color,color]",
                  backgroundSize === option.value
                    ? "border-accent bg-accent/10 text-app"
                    : "border-border-subtle bg-surface-1 text-muted hover:border-accent/40 hover:text-app",
                )}
                onClick={() => setBackgroundSize(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="mt-4 inline-flex h-[var(--size-control-lg)] cursor-pointer items-center gap-2 rounded-control border border-border-subtle px-4 text-[13px] font-medium hover:bg-surface-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
            Upload background image
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) =>
                readBackgroundImage(e.currentTarget.files?.[0], (src) =>
                  saveBg.mutate(backgroundCss(src, backgroundSize)),
                )
              }
            />
          </label>
          {bgQ.data ? (
            <Button variant="secondary" className="ml-3" onClick={() => saveBg.mutate("")}>
              Reset background
            </Button>
          ) : null}
        </StudentSettingsSection>
      </div>
    </div>
  );
}

function PasswordCard({ studentId, hasPin }: { studentId: number; hasPin: boolean }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentPinId = useFieldId("student-current-pin");
  const newPinId = useFieldId("student-new-pin");
  const confirmPinId = useFieldId("student-confirm-pin");
  const feedbackId = useFieldId("student-pin-feedback");

  const mutation = useMutation({
    mutationFn: async () => {
      if (newPin.length < MIN_PIN_LENGTH) {
        throw new Error(`PIN must be at least ${MIN_PIN_LENGTH} characters`);
      }
      if (newPin !== confirmPin) throw new Error("PINs do not match");
      if (hasPin) {
        if (currentPin.length < MIN_PIN_LENGTH) throw new Error("Current PIN is required");
        return api.students.changePin({ studentId, currentPin, newPin });
      }
      return api.students.setupPin({ studentId, pin: newPin });
    },
    onSuccess: () => {
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setError(null);
      setMessage(hasPin ? "PIN changed." : "PIN enabled.");
      queryClient.setQueryData(queryKeys.students.hasPin(studentId), true);
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Could not save PIN");
    },
  });

  const clear = useMutation({
    mutationFn: () => api.students.clearPin({ studentId }),
    onSuccess: () => {
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setError(null);
      setMessage("PIN removed.");
      queryClient.setQueryData(queryKeys.students.hasPin(studentId), false);
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Could not remove PIN");
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <StudentSettingsSection title="Personal PIN">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mt-1 text-sm text-muted">
            Protect this student profile when multiple learners share the same Windows laptop.
          </p>
        </div>
        <Badge tone={hasPin ? "success" : "muted"}>{hasPin ? "Enabled" : "Optional"}</Badge>
      </div>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-3">
        {hasPin ? (
          <Field label="Current PIN" htmlFor={currentPinId}>
            <PinInput
              id={currentPinId}
              density="compact"
              value={currentPin}
              maxLength={MAX_PIN_LENGTH}
              aria-describedby={error || message ? feedbackId : undefined}
              aria-invalid={Boolean(error)}
              onChange={(e) => setCurrentPin(e.target.value.slice(0, MAX_PIN_LENGTH))}
            />
          </Field>
        ) : null}
        <Field label={hasPin ? "New PIN" : "PIN"} htmlFor={newPinId}>
          <PinInput
            id={newPinId}
            density="compact"
            value={newPin}
            maxLength={MAX_PIN_LENGTH}
            aria-describedby={error || message ? feedbackId : undefined}
            aria-invalid={Boolean(error)}
            onChange={(e) => setNewPin(e.target.value.slice(0, MAX_PIN_LENGTH))}
          />
        </Field>
        <Field label="Confirm PIN" htmlFor={confirmPinId}>
          <PinInput
            id={confirmPinId}
            density="compact"
            value={confirmPin}
            maxLength={MAX_PIN_LENGTH}
            aria-describedby={error || message ? feedbackId : undefined}
            aria-invalid={Boolean(error)}
            onChange={(e) => setConfirmPin(e.target.value.slice(0, MAX_PIN_LENGTH))}
          />
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            <AppGlyph name="lock" className="h-4 w-4" />
            {mutation.isPending ? "Saving..." : hasPin ? "Change" : "Enable"}
          </Button>
          {hasPin ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => clear.mutate()}
              disabled={clear.isPending}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </form>
      {message ? (
        <p id={feedbackId} role="status" className="mt-3 text-sm text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          id={feedbackId}
          role="alert"
          className="mt-3 rounded-control bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      ) : null}
    </StudentSettingsSection>
  );
}

function bgKey(studentId: number): string {
  return `student_profile:${studentId}:study_background`;
}

function MascotCard({ studentId }: { studentId: number }) {
  const settingKey = mascotSettingKey(studentId);
  const mascotQ = useQuery({
    queryKey: queryKeys.studentPrefs.mascot(studentId),
    queryFn: () => api.settings.get<string>({ key: settingKey }),
    enabled: Number.isFinite(studentId) && studentId > 0,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const save = useMutation({
    mutationFn: (value: MascotId) => api.settings.set({ key: settingKey, value }),
    onSuccess: (_result, value) =>
      queryClient.setQueryData(queryKeys.studentPrefs.mascot(studentId), value),
  });
  const selected: MascotId = isMascotId(mascotQ.data)
    ? mascotQ.data
    : defaultMascotForSeed(studentId);

  return (
    <StudentSettingsSection title="Study mascot">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mt-1 text-sm text-muted">
            Pick the buddy that cheers you on across every lesson and session summary.
          </p>
        </div>
        <Badge tone="focus">
          {selected === defaultMascotForSeed(studentId) && !isMascotId(mascotQ.data)
            ? "Auto"
            : "Chosen"}
        </Badge>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {MASCOTS.map((mascot) => {
          const isSelected = mascot.id === selected;
          return (
            <li key={mascot.id}>
              <button
                type="button"
                onClick={() => save.mutate(mascot.id)}
                aria-pressed={isSelected}
                className={cn(
                  "ui-focus-ring flex w-full flex-col items-center gap-2 rounded-object bg-surface-2 p-3 text-center transition-[background-color,box-shadow]",
                  isSelected ? "bg-accent/10 ring-2 ring-accent/35" : "hover:bg-surface-3",
                )}
              >
                <div
                  className={cn(
                    "mask-squircle grid h-20 w-20 place-items-center p-1",
                    isSelected ? "bg-accent/10" : "bg-surface-2",
                  )}
                >
                  <MascotStill
                    mascotId={mascot.id}
                    className="h-full w-full"
                    alt={`${mascot.name} mascot`}
                  />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-app">{mascot.name}</span>
                  <span className="block text-[11px] text-muted">{mascot.tagline}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </StudentSettingsSection>
  );
}

function StudentSettingsSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("px-5 py-4", className)}>
      <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function backgroundCss(src: string, size: BackgroundSizeMode): string {
  const repeat = size === "auto" ? "repeat" : "no-repeat";
  return `url(${src}) center / ${size} ${repeat}`;
}

function readImage(file: File | undefined, done: (src: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") done(reader.result);
  };
  reader.readAsDataURL(file);
}

function readBackgroundImage(file: File | undefined, done: (src: string) => void) {
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  let settled = false;

  const fallback = () => {
    if (settled) return;
    settled = true;
    URL.revokeObjectURL(objectUrl);
    readImage(file, done);
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    try {
      const { width, height } = scaledBackgroundSize(image.naturalWidth, image.naturalHeight);
      if (width <= 0 || height <= 0) {
        URL.revokeObjectURL(objectUrl);
        readImage(file, done);
        return;
      }
      if (
        file.size <= BACKGROUND_INLINE_LIMIT_BYTES &&
        width === image.naturalWidth &&
        height === image.naturalHeight
      ) {
        URL.revokeObjectURL(objectUrl);
        readImage(file, done);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        readImage(file, done);
        return;
      }
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      done(canvas.toDataURL("image/jpeg", BACKGROUND_JPEG_QUALITY));
    } catch {
      readImage(file, done);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  image.onload = finish;
  image.onerror = fallback;
  image.src = objectUrl;
  const decodePromise = image.decode?.();
  if (decodePromise) void decodePromise.then(finish, fallback);
}

function scaledBackgroundSize(width: number, height: number): { width: number; height: number } {
  const edge = Math.max(width, height);
  if (!Number.isFinite(edge) || edge <= 0) return { width: 0, height: 0 };
  if (edge <= BACKGROUND_MAX_EDGE) return { width, height };
  const scale = BACKGROUND_MAX_EDGE / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
