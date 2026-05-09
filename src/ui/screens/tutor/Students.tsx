import type { Student } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field, TextArea, TextInput, useFieldId } from "@/ui/components/Field";
import { Modal } from "@/ui/components/Modal";
import { PageHeader } from "@/ui/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "active" | "archived";

const COLOR_OPTIONS = [
  "#7c9cff", // accent
  "#7ee2c4",
  "#f6c177",
  "#ea9aaa",
  "#c4a7e7",
  "#9ccfd8",
  "#a3be8c",
  "#bf616a",
];

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

      <div className="flex items-center gap-1 border-b border-border-subtle px-8">
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          Active
        </TabButton>
        <TabButton active={tab === "archived"} onClick={() => setTab("archived")}>
          Archived
        </TabButton>
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
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-3 py-3 text-sm font-medium transition-colors",
        active ? "border-accent text-app" : "border-transparent text-muted hover:text-app",
      )}
    >
      {children}
    </button>
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

  return (
    <li className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
      <Avatar name={student.displayName ?? student.name} color={student.color} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {student.displayName ?? student.name}
          </span>
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
  const [color, setColor] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nameId = useFieldId("name");
  const displayId = useFieldId("display");
  const notesId = useFieldId("notes");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDisplayName(editing.displayName ?? "");
      setColor(editing.color ?? null);
      setNotes(editing.notes ?? "");
    } else {
      setName("");
      setDisplayName("");
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
          color: color || null,
          notes: notes.trim() || null,
        },
      });
    } else {
      create.mutate({
        name: trimmedName,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        ...(color ? { color } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
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
        <Field label="Name" htmlFor={nameId} hint="Full name. Required.">
          <TextInput
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-required="true"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Display name"
          htmlFor={displayId}
          hint="Shown in the picker if you'd like a nickname instead."
        >
          <TextInput
            id={displayId}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            autoComplete="off"
          />
        </Field>
        <Field label="Avatar color">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>
        <Field label="Notes" htmlFor={notesId} hint="Private — only you see these.">
          <TextArea
            id={notesId}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={3}
          />
        </Field>
        {error ? (
          <p
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
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
        ∅
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
