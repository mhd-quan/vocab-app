import type { Student } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field, useFieldId } from "@/ui/components/Field";
import { Modal } from "@/ui/components/Modal";
import { PageHeader } from "@/ui/components/PageHeader";
import { StudentHistoryImportButton } from "@/ui/components/StudentHistoryImportButton";
import { PROFILE_COLORS } from "@/ui/design/profileColors";
import {
  TutorSegmentedControl,
  TutorTextAreaField,
  TutorTextField,
} from "@/ui/tutor/components/Material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "active" | "archived";

const EMOJI_OPTIONS = ["⭐", "🔥", "⚡", "🚀", "🎯", "🧠", "📚", "🌈", "🍀", "💎", "🎮", "🏆"];
const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_SEED_CHARS = 180_000;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function TutorStudents() {
  const [tab, setTab] = useState<Tab>("active");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [lastImport, setLastImport] = useState<Awaited<
    ReturnType<typeof api.evidence.importStudentData>
  > | null>(null);

  const allQ = useQuery({
    queryKey: queryKeys.students.listAll(),
    queryFn: () => api.students.listAll(),
  });

  const filtered = useMemo(() => {
    const all = allQ.data ?? [];
    return tab === "active"
      ? all.filter((s) => s.archivedAt === null)
      : all.filter((s) => s.archivedAt !== null);
  }, [allQ.data, tab]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(student: Student) {
    setEditing(student);
    setEditorOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Manage the learner profiles, histories, and access used in practice mode."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StudentHistoryImportButton onImported={setLastImport} />
            <Button onClick={openCreate}>Add student</Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-4 px-6 pb-4">
        <TutorSegmentedControl
          value={tab}
          options={[
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
          ]}
          onChange={(value) => setTab(value as Tab)}
          className="max-w-[15rem]"
        />
        <p className="text-xs tabular-nums text-muted">
          {filtered.length} {tab === "active" ? "active" : "archived"}
        </p>
      </div>

      {lastImport?.imported && lastImport.studentId && lastImport.stats ? (
        <div
          role="status"
          className="mx-6 mb-4 flex min-h-[var(--size-row)] items-center border-y border-border-subtle bg-success/5 px-4 py-2.5"
        >
          <div className="flex w-full flex-col gap-2 text-sm text-success sm:flex-row sm:items-center sm:justify-between">
            <p>
              Imported student history: {lastImport.stats.sessionsInserted} new sessions,{" "}
              {lastImport.stats.sessionsUpdated} updated, {lastImport.stats.learningEventsInserted}{" "}
              answers.
            </p>
            <Link
              to="/tutor/students/$studentId"
              params={{ studentId: String(lastImport.studentId) }}
              className="ui-focus-ring rounded-control text-xs font-semibold text-success hover:text-app"
            >
              Open student
            </Link>
          </div>
        </div>
      ) : null}

      <section className="max-w-5xl px-6 pb-10">
        {allQ.isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={tab === "active" ? "No active students" : "No archived students"}
            body={
              tab === "active"
                ? "Add a profile to let a learner pick it from student practice mode."
                : "Archived profiles show up here. Restore them to use again."
            }
            action={
              tab === "active" ? (
                <Button size="sm" onClick={openCreate}>
                  Add student
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="grouped-list">
            {filtered.map((student) => (
              <StudentRow key={student.id} student={student} onEdit={() => openEdit(student)} />
            ))}
          </ul>
        )}
      </section>

      <StudentEditor open={editorOpen} onClose={() => setEditorOpen(false)} editing={editing} />
    </>
  );
}

function StudentRow({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const queryClient = useQueryClient();

  const archive = useMutation({
    mutationFn: () => api.students.archive({ id: student.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });
  const restore = useMutation({
    mutationFn: () => api.students.restore({ id: student.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });

  const archived = student.archivedAt !== null;

  const nameNode = (
    <span className="truncate text-sm font-semibold">{student.displayName ?? student.name}</span>
  );

  return (
    <li className="motion-enter flex min-h-[var(--size-row-comfortable)] items-center gap-3 border-b border-border-subtle px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2/55">
      <Avatar
        name={student.displayName ?? student.name}
        avatarSeed={student.avatarSeed}
        color={student.color}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {archived ? (
            nameNode
          ) : (
            <Link
              to="/tutor/students/$studentId"
              params={{ studentId: String(student.id) }}
              className="ui-focus-ring truncate rounded-control text-sm font-semibold transition-colors hover:text-accent"
            >
              {student.displayName ?? student.name}
            </Link>
          )}
          {archived ? <Badge tone="muted">archived</Badge> : null}
        </div>
        {student.displayName && student.displayName !== student.name ? (
          <p className="truncate text-xs text-muted-2">{student.name}</p>
        ) : null}
        {student.notes ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted">{student.notes}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        {archived ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => restore.mutate()}
            disabled={restore.isPending}
          >
            Restore
          </Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => archive.mutate()}
              disabled={archive.isPending}
              className="text-muted hover:text-danger"
            >
              Archive
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

interface StudentEditorProps {
  open: boolean;
  onClose: () => void;
  editing: Student | null;
}

function StudentEditor({ open, onClose, editing }: StudentEditorProps) {
  const queryClient = useQueryClient();
  const isEdit = editing !== null;
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nameId = useFieldId("name");
  const displayId = useFieldId("display");
  const notesId = useFieldId("notes");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDisplayName(editing.displayName ?? "");
      setAvatarSeed(editing.avatarSeed ?? null);
      setColor(editing.color ?? null);
      setNotes(editing.notes ?? "");
    } else {
      setName("");
      setDisplayName("");
      setAvatarSeed(null);
      setColor(PROFILE_COLORS[0]?.value ?? null);
      setNotes("");
    }
    setError(null);
  }, [open, editing]);

  const create = useMutation({
    // Wrap so TanStack's mutation context isn't passed through to the IPC.
    mutationFn: (input: Parameters<typeof api.students.create>[0]) => api.students.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create"),
  });

  const update = useMutation({
    mutationFn: (input: Parameters<typeof api.students.update>[0]) => api.students.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to update"),
  });

  const busy = create.isPending || update.isPending;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    if (color && !HEX_RE.test(color)) {
      setError("Color must be a 6-digit hex like #1a2b3c");
      return;
    }
    if (isEdit && editing) {
      update.mutate({
        id: editing.id,
        patch: {
          name: trimmedName,
          displayName: displayName.trim() || null,
          avatarSeed,
          color: color || null,
          notes: notes.trim() || null,
        },
      });
    } else {
      create.mutate({
        name: trimmedName,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        ...(avatarSeed ? { avatarSeed } : {}),
        ...(color ? { color } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    }
  }

  async function onAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Avatar must be an image file");
      return;
    }
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setError("Avatar image must be 5 MB or smaller");
      return;
    }
    setAvatarBusy(true);
    try {
      setAvatarSeed(await fileToAvatarSeed(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load avatar image");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit student" : "Add student"}
      description={
        isEdit
          ? "Update profile details. Archived profiles can be restored from the Archived tab."
          : "Profiles show up in student practice mode for the learner to pick."
      }
      initialFocusId={nameId}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create student"}
          </Button>
        </>
      }
    >
      <form id="student-form" className="flex flex-col gap-4" onSubmit={onSubmit}>
        <Field label="Avatar">
          <div className="object-surface flex flex-col gap-3 p-4">
            <div className="flex items-center gap-4">
              <Avatar
                name={displayName.trim() || name.trim() || "Student"}
                avatarSeed={avatarSeed}
                color={color}
                size="lg"
                className="h-16 w-16 text-xl"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarBusy}
                >
                  {avatarBusy ? "Loading..." : "Upload photo"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarSeed(null)}>
                  Initials
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={onAvatarFile}
              />
            </div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {EMOJI_OPTIONS.map((emoji) => {
                const seed = `emoji:${emoji}`;
                const selected = avatarSeed === seed;
                return (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Avatar ${emoji}`}
                    aria-pressed={selected}
                    onClick={() => setAvatarSeed(seed)}
                    className={cn(
                      "ui-focus-ring grid h-9 w-9 place-items-center rounded-full border text-lg leading-none transition-[background-color,border-color]",
                      selected
                        ? "border-accent bg-accent/10 ring-2 ring-accent/15"
                        : "border-border-subtle bg-surface-1 hover:border-accent/40",
                    )}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
        </Field>
        <TutorTextField
          id={nameId}
          label="Name"
          supportingText="Full name. Required."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          aria-required="true"
          autoComplete="off"
        />
        <TutorTextField
          label="Display name"
          id={displayId}
          supportingText="Shown in the picker if you'd like a nickname instead."
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          autoComplete="off"
        />
        <Field label="Avatar color">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>
        <TutorTextAreaField
          id={notesId}
          label="Notes"
          supportingText="Private - only you see these."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
        />
        {error ? (
          <p
            className="border-l-2 border-danger bg-danger/8 px-3 py-2 text-xs text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label="No color"
        aria-pressed={value === null}
        className={cn(
          "ui-focus-ring h-8 w-8 rounded-full border-2 bg-surface-2 text-[9px] text-muted-2",
          value === null ? "border-accent" : "border-border-subtle hover:border-border-strong",
        )}
      >
        None
      </button>
      {PROFILE_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          aria-label={color.name}
          aria-pressed={value === color.value}
          onClick={() => onChange(color.value)}
          className={cn(
            "ui-focus-ring h-8 w-8 rounded-full border-2",
            value === color.value ? "border-app" : "border-transparent hover:border-border-strong",
          )}
          style={{ backgroundColor: color.value }}
        />
      ))}
    </div>
  );
}

async function fileToAvatarSeed(file: File): Promise<string> {
  const source = await readFileAsDataUrl(file);
  const img = await loadImage(source);
  const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const sx = ((img.naturalWidth || img.width) - side) / 2;
  const sy = ((img.naturalHeight || img.height) - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare avatar image");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
  const dataUrl = canvas.toDataURL("image/webp", 0.86);
  const seed = `image:${dataUrl}`;
  if (seed.length > MAX_AVATAR_SEED_CHARS) {
    throw new Error("Avatar image is too large after resizing");
  }
  return seed;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read avatar image"));
    };
    reader.onerror = () => reject(new Error("Could not read avatar image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load avatar image"));
    img.src = src;
  });
}
