import { useEffect, useState } from "react";

interface BridgeStatus {
  ping: string | null;
  bookCount: number | null;
  studentCount: number | null;
  error: string | null;
}

const initialStatus: BridgeStatus = {
  ping: null,
  bookCount: null,
  studentCount: null,
  error: null,
};

export function App() {
  const platform = window.api?.app.platform ?? "unknown";
  const version = window.api?.app.version ?? "?";
  const [status, setStatus] = useState<BridgeStatus>(initialStatus);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (!window.api) {
        setStatus({ ...initialStatus, error: "preload bridge missing" });
        return;
      }
      try {
        const [ping, books, students] = await Promise.all([
          window.api.meta.ping(),
          window.api.curriculum.listBooks(),
          window.api.students.listActive(),
        ]);
        if (cancelled) return;
        setStatus({
          ping,
          bookCount: books.length,
          studentCount: students.length,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ ...initialStatus, error: message });
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 px-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full border border-border-subtle bg-surface-1 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted">
          v{version} · scaffold
        </span>
        <h1 className="text-5xl font-semibold tracking-tight">Vocab App</h1>
        <p className="max-w-xl text-balance text-base text-muted">
          Interactive vocabulary &amp; grammar tutor for Destination B1/B2. Bridge wired up —
          content import lands in PR #4.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
        <Pill label="Platform" value={platform} />
        <Pill label="Renderer" value="React 18" />
        <Pill label="Bridge" value={window.api ? "ok" : "missing"} />
        <Pill label="Ping" value={status.ping ?? "…"} />
        <Pill label="Books" value={status.bookCount === null ? "…" : String(status.bookCount)} />
        <Pill
          label="Students"
          value={status.studentCount === null ? "…" : String(status.studentCount)}
        />
      </div>
      {status.error ? (
        <p className="max-w-xl rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs text-danger">
          {status.error}
        </p>
      ) : null}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-border-subtle bg-surface-1 px-2.5 py-1 font-mono">
      <span className="text-muted-2">{label}</span>
      <span className="mx-1.5 text-muted-2">·</span>
      <span className="text-app">{value}</span>
    </span>
  );
}
