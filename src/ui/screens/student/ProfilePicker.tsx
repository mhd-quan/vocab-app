import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { Button } from "@/ui/components/Button";
import { PinInput } from "@/ui/components/PinInput";
import { markStudentUnlocked } from "@/ui/student/access";
import { MascotStill } from "@/ui/student/mascot";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";

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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-8 py-12">
      <header className="flex flex-col gap-3">
        <Badge tone="xp" uppercase className="w-fit">
          Student practice
        </Badge>
        <div className="grid gap-3 md:grid-cols-[1fr_18rem] md:items-end">
          <div>
            <h1 className="text-4xl font-semibold leading-tight">Who's practising?</h1>
            <p className="mt-2 max-w-xl text-base text-muted">
              Pick a profile and jump straight back into the next vocabulary session.
            </p>
          </div>
          <FleetSnapshotCard />
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs text-danger"
        >
          Failed to load students: {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
        <div className="rounded-bento border border-dashed border-border-subtle bg-surface-1 px-6 py-8 text-center">
          <MascotStill mascotId="1" expression="sad" className="mx-auto mb-3 h-20 w-20" />
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
      onClick={() => void openProfile()}
      disabled={checkingProfile}
      className={cn(
        "group flex min-h-44 w-full flex-col justify-between rounded-bento border border-border-subtle bg-surface-1 p-5 text-left shadow-card transition-[background-color,border-color,box-shadow,transform]",
        "shadow-press hover:translate-y-0 hover:border-accent/40 hover:bg-surface-2 hover:shadow-lift active:translate-y-[3px] active:shadow-press-active",
        checkingProfile && "cursor-wait opacity-70 hover:border-border-subtle hover:bg-surface-1",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Avatar
          name={student.name}
          avatarSeed={student.avatarSeed}
          color={student.color}
          size="lg"
        />
        <span
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-full border border-border-subtle text-muted transition-colors group-hover:border-accent/40 group-hover:text-accent"
        >
          {protectedProfile ? (
            <AppGlyph name="lock" className="h-5 w-5" />
          ) : (
            <AppGlyph name="arrowRight" className="h-5 w-5" />
          )}
        </span>
      </div>
      <div>
        <span className="text-lg font-semibold">{student.name}</span>
        <p className="mt-1 text-sm text-muted">
          {checkingProfile
            ? "Checking profile"
            : protectedProfile
              ? "Password required"
              : "Ready to practise"}
        </p>
      </div>
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pin.length < MIN_PIN_LENGTH) {
      setError(`Password must be at least ${MIN_PIN_LENGTH} characters`);
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
        setError(result.reason === "no_pin" ? "No password is set" : "Incorrect password");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-pin-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-6 backdrop-blur-sm"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-bento border border-border-subtle bg-surface-1 p-5 shadow-lift"
      >
        <div className="flex items-center gap-3">
          <Avatar
            name={student.name}
            avatarSeed={student.avatarSeed}
            color={student.color}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-2">Protected profile</p>
            <h2 id="student-pin-title" className="truncate text-lg font-semibold">
              {student.name}
            </h2>
          </div>
        </div>
        <PinInput
          ref={inputRef}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.slice(0, MAX_PIN_LENGTH));
            if (error) setError(null);
          }}
          aria-label={`${student.name} password`}
          maxLength={MAX_PIN_LENGTH}
          invalid={Boolean(error)}
          disabled={busy}
          className="mt-4"
        />
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || pin.length < MIN_PIN_LENGTH}>
            {busy ? "Checking..." : "Unlock"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SkeletonCard() {
  return (
    <li className="min-h-44 animate-pulse rounded-bento border border-border-subtle bg-surface-1 shadow-card" />
  );
}

function FleetSnapshotCard() {
  const snapshotQ = useQuery({
    queryKey: queryKeys.progress.fleetSnapshot(),
    queryFn: () => api.progress.fleetSnapshot(),
    staleTime: 60_000,
  });
  const data = snapshotQ.data;

  if (snapshotQ.isLoading || !data) {
    return (
      <BentoCard as="div" tone="focus" className="flex items-center gap-3 p-4">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-focus/15" />
        <div className="min-w-0 space-y-1.5">
          <span className="block h-2.5 w-24 animate-pulse rounded-full bg-focus/15" />
          <span className="block h-2 w-32 animate-pulse rounded-full bg-focus/10" />
        </div>
      </BentoCard>
    );
  }

  if (data.activeCount === 0) {
    return (
      <BentoCard as="div" tone="focus" className="flex items-center gap-3 p-4">
        <MascotStill mascotId="2" expression="adorable" className="h-12 w-12 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-focus">Welcome back</p>
          <p className="mt-1 text-sm text-muted">Add a student profile to get started.</p>
        </div>
      </BentoCard>
    );
  }

  return (
    <BentoCard as="div" tone="focus" className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-focus">Fleet snapshot</p>
        <Badge tone={data.totalDue > 0 ? "warning" : "muted"} uppercase>
          {data.activeCount} active
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <FleetMetric
          label="Due"
          value={data.totalDue.toString()}
          tone={data.totalDue > 0 ? "warning" : "muted"}
        />
        <FleetMetric
          label="Top XP"
          value={data.topXp ? `${data.topXp.name} · ${data.topXp.xp}` : "—"}
        />
        <FleetMetric
          label="Streak"
          value={data.topStreak ? `${data.topStreak.name} · ${data.topStreak.streak}d` : "—"}
          className="col-span-2"
        />
      </dl>
    </BentoCard>
  );
}

function FleetMetric({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: "warning" | "muted";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-surface-0/65 px-2.5 py-1.5",
        className,
      )}
    >
      <dt className="text-[10px] font-semibold uppercase text-muted-2">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate font-mono text-sm text-app",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-muted-2",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
