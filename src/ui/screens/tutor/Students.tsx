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
import {
  TutorSegmentedControl,
  TutorTextAreaField,
  TutorTextField,
} from "@/ui/tutor/components/Material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "active" | "archived";

const COLOR_OPTIONS = [
  "#7c9cff", // accent
  "#41cadc", // xp
  "#ff9e4a", // ember
  "#f584c2", // pink
  "#9dd85c", // lime
  "#db82ee", // epic
  "#57b5ff", // sky
  "#ff8079", // coral
  "#f8c852", // mastery
  "#2dd4b7", // focus
];

const EMOJI_OPTIONS = ["⭐", "🔥", "⚡", "🚀", "🎯", "🧠", "📚", "🌈", "🍀", "💎", "🎮", "🏆"];
const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_SEED_CHARS = 180_000;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function TutorStudents() {
  const [tab, setTab] = useState<Tab>("active");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

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
        eyebrow="Tutor"
        title="Students"
        subtitle="Profiles your learners use in student practice mode. Create one per child you tutor."
        actions={<Button onClick={openCreate}>+ Add student</Button>}
      />

      <div className="border-b border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)] px-8 py-3">
        <TutorSegmentedControl
          value={tab}
          options={[
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
          ]}
          onChange={(value) => setTab(value as Tab)}
          className="max-w-xs"
        />
      </div>

      <section className="px-8 py-6">
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
                  + Add student
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    <li className="motion-card motion-enter flex items-center gap-4 rounded-[var(--shape-corner-xl)] border border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)] p-4 shadow-card transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-1 hover:border-accent/30 hover:bg-[color:var(--md-sys-color-surface-container-low)] hover:shadow-lift">
      <Avatar
        name={student.displayName ?? student.name}
        avatarSeed={student.avatarSeed}
        color={student.color}
        size="lg"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {archived ? (
            nameNode
          ) : (
            <Link
              to="/tutor/students/$studentId"
              params={{ studentId: String(student.id) }}
              className="truncate text-sm font-semibold transition-colors hover:text-accent"
            >
              {student.displayName ?? student.name}
            </Link>
          )}
          {archived ? (
            <Badge tone="muted" uppercase>
              archived
            </Badge>
          ) : null}
        </div>
        {student.displayName && student.displayName !== student.name ? (
          <p className="truncate text-xs text-muted-2">{student.name}</p>
        ) : null}
        {student.notes ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted">{student.notes}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
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
      setColor(COLOR_OPTIONS[0] ?? null);
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
          <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-0/70 p-4">
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
                      "grid h-9 w-9 place-items-center rounded-full border text-lg leading-none transition-[background-color,border-color,box-shadow,transform]",
                      selected
                        ? "border-accent bg-accent/10 shadow-[0_0_0_4px_rgb(var(--color-accent)/0.12)]"
                        : "border-border-subtle bg-surface-1 hover:-translate-y-0.5 hover:border-accent/40",
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
            className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
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
          "h-8 w-8 rounded-full border-2 bg-surface-2 text-xs text-muted-2",
          value === null ? "border-accent" : "border-border-subtle hover:border-border-strong",
        )}
      >
        None
      </button>
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={cn(
            "h-8 w-8 rounded-full border-2",
            value === c ? "border-app" : "border-transparent hover:border-border-strong",
          )}
          style={{ backgroundColor: c }}
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
