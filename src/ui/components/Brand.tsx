import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-6 w-6 shrink-0", className)}
    >
      <path
        d="M4.75 5.4c2.5-.92 4.62-.48 7.25 1.2v12.05c-2.63-1.68-4.75-2.12-7.25-1.2V5.4Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M19.25 5.4c-2.5-.92-4.62-.48-7.25 1.2v12.05c2.63-1.68 4.75-2.12 7.25-1.2V5.4Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M8 8.4h1.7M14.3 8.4H16" stroke="currentColor" strokeWidth="1.55" />
    </svg>
  );
}

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-app", className)}>
      <BrandMark className="text-accent" />
      {!compact ? (
        <span className="truncate text-[15px] font-semibold tracking-[-0.012em]">Vocab</span>
      ) : null}
    </span>
  );
}
