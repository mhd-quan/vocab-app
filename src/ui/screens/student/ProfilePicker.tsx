import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Avatar } from "@/ui/components/Avatar";
import { Button } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { PinInput } from "@/ui/components/PinInput";
import { markStudentUnlocked } from "@/ui/student/access";
import { MascotStill } from "@/ui/student/mascot";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;

export function StudentProfilePicker() {
  const navigate = useNavigate();
  const [lockedStudent, setLockedStudent] = useState<{
    id: number;
    name: string;
    avatarSeed: string | null;
    color: string | null;
  } | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.students.listActive(),
    queryFn: () => api.students.listActive(),
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-7">
      <header className="pb-1">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em]">
          Who’s practising?
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-5 text-muted">
          Choose a profile to open its learning path.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
          Failed to load students: {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      <ul className="grouped-list mx-auto w-full max-w-3xl divide-y divide-border-subtle">
        {isLoading
          ? ["sk-1", "sk-2", "sk-3"].map((key) => <SkeletonCard key={key} />)
          : (data ?? []).length === 0
            ? null
            : data?.map((student) => (
                <li key={student.id}>
                  <ProfileCard
                    student={{
                      id: student.id,
                      name: student.displayName ?? student.name,
                      avatarSeed: student.avatarSeed ?? null,
                      color: student.color ?? null,
                    }}
                    onUnlocked={(studentId) => {
                      markStudentUnlocked(studentId);
                      void navigate({
                        to: "/student/profile/$studentId",
                        params: { studentId: String(studentId) },
                      });
                    }}
                    onLocked={setLockedStudent}
                  />
                </li>
              ))}
      </ul>

      {lockedStudent ? (
        <StudentPinDialog
          student={lockedStudent}
          onCancel={() => setLockedStudent(null)}
          onUnlocked={(studentId) => {
            setLockedStudent(null);
            markStudentUnlocked(studentId);
            void navigate({
              to: "/student/profile/$studentId",
              params: { studentId: String(studentId) },
            });
          }}
        />
      ) : null}

      {!isLoading && (data ?? []).length === 0 ? (
        <div className="px-6 py-9 text-center">
          <MascotStill mascotId="1" expression="sad" className="mx-auto mb-3 h-16 w-16" />
          <h2 className="text-base font-semibold">No students yet</h2>
          <p className="mt-1 text-xs text-muted">
            Switch to tutor mode and add a student profile from{" "}
            <span className="text-app">Tutor - Students</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ProfileCard({
  student,
  onUnlocked,
  onLocked,
}: {
  student: { id: number; name: string; avatarSeed: string | null; color: string | null };
  onUnlocked: (studentId: number) => void;
  onLocked: (student: {
    id: number;
    name: string;
    avatarSeed: string | null;
    color: string | null;
  }) => void;
}) {
  const pinQ = useQuery({
    queryKey: queryKeys.students.hasPin(student.id),
    queryFn: () => api.students.hasPin({ studentId: student.id }),
  });
  const protectedProfile = pinQ.data === true;
  const checkingProfile = pinQ.data === undefined;
  const accessState = checkingProfile ? "checking" : protectedProfile ? "locked" : "ready";

  async function openProfile() {
    if (checkingProfile) return;
    if (protectedProfile) {
      onLocked(student);
      return;
    }
    onUnlocked(student.id);
  }

  return (
    <button
      type="button"
      data-state={accessState}
      aria-busy={checkingProfile || undefined}
      onClick={() => void openProfile()}
      disabled={checkingProfile}
      className={cn(
        "ui-focus-ring group relative flex min-h-[4.75rem] w-full items-center gap-3 bg-surface-1 py-3 pl-5 pr-3 text-left outline-offset-[-2px]",
        "transition-[background-color,box-shadow] duration-150 hover:bg-surface-2/65 active:bg-surface-3/60 active:shadow-[inset_0_0_0_1px_rgb(var(--color-border-subtle))]",
        checkingProfile && "cursor-wait opacity-70 hover:bg-surface-1",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-3 left-0 w-[3px] rounded-r-sm",
          checkingProfile ? "bg-border-strong" : protectedProfile ? "bg-warning" : "bg-accent",
        )}
      />
      <Avatar name={student.name} avatarSeed={student.avatarSeed} color={student.color} size="md" />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{student.name}</span>
        <p className="mt-0.5 text-xs text-muted">
          {checkingProfile
            ? "Checking access…"
            : protectedProfile
              ? "PIN required"
              : "Open learning path"}
        </p>
      </div>
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center text-muted transition-colors group-hover:text-accent"
      >
        {protectedProfile ? (
          <AppGlyph name="lock" className="h-[18px] w-[18px]" />
        ) : (
          <AppGlyph name="arrowRight" className="h-[18px] w-[18px]" />
        )}
      </span>
    </button>
  );
}

function StudentPinDialog({
  student,
  onCancel,
  onUnlocked,
}: {
  student: { id: number; name: string; avatarSeed: string | null; color: string | null };
  onCancel: () => void;
  onUnlocked: (studentId: number) => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN must be at least ${MIN_PIN_LENGTH} characters`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.students.verifyPin({ studentId: student.id, pin });
      if (result.ok) {
        onUnlocked(student.id);
      } else {
        setPin("");
        setError(result.reason === "no_pin" ? "No PIN is set" : "Incorrect PIN");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Unlock ${student.name}`}
      description="This profile is protected. Enter its PIN to continue."
      size="sm"
      initialFocusId="student-profile-password"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="student-pin-form"
            disabled={busy || pin.length < MIN_PIN_LENGTH}
          >
            {busy ? "Checking…" : "Unlock"}
          </Button>
        </>
      }
    >
      <form id="student-pin-form" onSubmit={onSubmit}>
        <div className="flex items-center gap-3">
          <Avatar
            name={student.name}
            avatarSeed={student.avatarSeed}
            color={student.color}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-xs text-muted">Protected profile</p>
            <p className="truncate text-sm font-semibold">{student.name}</p>
          </div>
        </div>
        <PinInput
          ref={inputRef}
          id="student-profile-password"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.slice(0, MAX_PIN_LENGTH));
            if (error) setError(null);
          }}
          aria-label={`${student.name} PIN`}
          maxLength={MAX_PIN_LENGTH}
          invalid={Boolean(error)}
          disabled={busy}
          className="mt-4"
        />
        {error ? (
          <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function SkeletonCard() {
  return <li className="h-[4.75rem] animate-pulse bg-surface-2/60 motion-reduce:animate-none" />;
}
