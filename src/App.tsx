export function App() {
  const platform = window.api?.app.platform ?? "unknown";
  const version = window.api?.app.version ?? "?";

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 px-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full border border-border-subtle bg-surface-1 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted">
          v{version} · scaffold
        </span>
        <h1 className="text-5xl font-semibold tracking-tight">Vocab App</h1>
        <p className="max-w-xl text-balance text-base text-muted">
          Interactive vocabulary &amp; grammar tutor for Destination B1/B2. Foundation ready —
          content layer arrives in PR #2.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Pill label="Platform" value={platform} />
        <Pill label="Renderer" value="React 18" />
        <Pill label="Bridge" value={window.api ? "ok" : "missing"} />
      </div>
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
