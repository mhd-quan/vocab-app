import type { DictionaryEntry, DictionaryLessonEntry } from "@/data/dictionary";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

interface DictionaryLookupPanelProps {
  className?: string;
  density?: "page" | "popup";
  showYamlAction?: boolean;
  initialQuery?: string;
  studentId?: number | null;
}

export function DictionaryLookupPanel({
  className,
  density = "page",
  showYamlAction = false,
  initialQuery = "",
  studentId = null,
}: DictionaryLookupPanelProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(initialQuery);
  const [selectedTerm, setSelectedTerm] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query.trim(), 160);
  const [copied, setCopied] = useState(false);
  const loggedLookupRef = useRef<Set<string>>(new Set());
  const loggedMissRef = useRef<Set<string>>(new Set());

  const statusQ = useQuery({
    queryKey: queryKeys.dictionary.status(),
    queryFn: () => api.dictionary.status(),
  });

  const searchQ = useQuery({
    queryKey: queryKeys.dictionary.search(debouncedQuery, 14),
    queryFn: () => api.dictionary.search({ query: debouncedQuery, limit: 14 }),
    enabled: statusQ.data?.active === true && debouncedQuery.length > 0,
  });

  const entryQ = useQuery({
    queryKey: queryKeys.dictionary.lookup(selectedTerm),
    queryFn: () => api.dictionary.lookup({ term: selectedTerm }),
    enabled: statusQ.data?.active === true && selectedTerm.trim().length > 0,
  });

  const suggestions = searchQ.data ?? [];
  const entry = entryQ.data ?? null;
  const activeStudentId = Number.isFinite(studentId ?? Number.NaN) ? Number(studentId) : null;

  useEffect(() => {
    if (!selectedTerm && suggestions[0]?.exact) {
      setSelectedTerm(suggestions[0].key);
    }
  }, [selectedTerm, suggestions]);

  useEffect(() => {
    if (!activeStudentId || !entry) return;
    const logKey = `${activeStudentId}:${entry.key}`;
    if (loggedLookupRef.current.has(logKey)) return;
    loggedLookupRef.current.add(logKey);
    void api.dictionaryLearning
      .recordLookup({
        studentId: activeStudentId,
        query: query.trim() || entry.headword,
        dictionaryKey: entry.key,
      })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: ["dictionaryLearning"],
        }),
      )
      .catch((error) => console.error("[DictionaryLookupPanel] recordLookup failed", error));
  }, [activeStudentId, entry, query, queryClient]);

  useEffect(() => {
    if (!activeStudentId || !entryQ.isSuccess || entry || selectedTerm.trim().length === 0) return;
    const queryText = selectedTerm.trim();
    const logKey = `${activeStudentId}:${queryText}`;
    if (loggedMissRef.current.has(logKey)) return;
    loggedMissRef.current.add(logKey);
    void api.dictionaryLearning
      .recordSearch({ studentId: activeStudentId, query: queryText })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: ["dictionaryLearning"],
        }),
      )
      .catch((error) => console.error("[DictionaryLookupPanel] recordSearch failed", error));
  }, [activeStudentId, entry, entryQ.isSuccess, queryClient, selectedTerm]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const exact = suggestions.find((item) => item.exact);
    const first = exact ?? suggestions[0];
    setSelectedTerm(first?.key ?? query.trim());
    setCopied(false);
  }

  async function copyYaml() {
    if (!entry) return;
    await navigator.clipboard.writeText(toYamlSeed(entry));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (statusQ.isLoading) {
    return (
      <div className={cn("flex h-full items-center justify-center text-sm text-muted", className)}>
        Loading dictionary...
      </div>
    );
  }

  if (!statusQ.data?.active) {
    return (
      <div className={cn("flex h-full items-center justify-center p-6", className)}>
        <EmptyState
          title="Dictionary pack not installed"
          body="Select an external OALD10 pack in Tutor Settings to unlock dictionary search."
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid min-h-0 gap-0 overflow-hidden border border-border-subtle bg-surface-1",
        density === "page"
          ? "h-[calc(100vh-9rem)] grid-cols-[18rem_1fr] rounded-none border-x-0"
          : "h-[min(74vh,46rem)] grid-cols-[15rem_1fr] rounded-bento",
        className,
      )}
    >
      <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-surface-0/65">
        <form onSubmit={onSubmit} className="border-b border-border-subtle p-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-muted-2">Search word</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="achievement"
              spellCheck={false}
              className="h-11 rounded-xl border border-border-strong bg-surface-1 px-3 text-base text-app outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
          </label>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {searchQ.isFetching ? <p className="px-2 py-2 text-xs text-muted">Searching...</p> : null}
          {debouncedQuery.length === 0 ? (
            <p className="px-2 py-2 text-xs leading-5 text-muted">
              Type a word or phrase, then press Enter or pick a result.
            </p>
          ) : suggestions.length === 0 && !searchQ.isFetching ? (
            <p className="px-2 py-2 text-xs text-muted">No matches.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {suggestions.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTerm(item.key);
                      setQuery(item.label);
                      setCopied(false);
                    }}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                      selectedTerm === item.key
                        ? "bg-accent text-accent-fg"
                        : "text-muted hover:bg-surface-2 hover:text-app",
                    )}
                  >
                    <span className="block truncate font-medium">{item.label}</span>
                    {item.exact ? (
                      <span className="block text-[10px] uppercase opacity-75">Exact</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-y-auto bg-app">
        {entryQ.isFetching && !entry ? (
          <p className="p-6 text-sm text-muted">Loading entry...</p>
        ) : entry ? (
          <EntryDetail
            entry={entry}
            showYamlAction={showYamlAction}
            copied={copied}
            onCopy={copyYaml}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              title="No word selected"
              body="Search and select an entry to inspect definitions, examples, IPA, CEFR, and audio."
            />
          </div>
        )}
      </main>
    </div>
  );
}

function EntryDetail({
  entry,
  showYamlAction,
  copied,
  onCopy,
}: {
  entry: DictionaryEntry;
  showYamlAction: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const [playingRef, setPlayingRef] = useState<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioQueries = useQueries({
    queries: entry.audio.map((audio) => ({
      queryKey: queryKeys.dictionary.audio(audio.ref),
      queryFn: () => api.dictionary.audio({ ref: audio.ref }),
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });
  const definitions = useMemo(
    () => entry.senses.filter((sense) => sense.definitionEn.trim().length > 0),
    [entry.senses],
  );
  const curriculumBadges = useMemo(() => curriculumTags(entry), [entry]);

  async function play(ref: string, dataUrl: string | undefined) {
    if (!dataUrl) return;
    audioElementRef.current?.pause();
    const player = new Audio(dataUrl);
    audioElementRef.current = player;
    setPlayingRef(ref);
    player.onended = () => setPlayingRef(null);
    player.onerror = () => setPlayingRef(null);
    await player.play().catch(() => setPlayingRef(null));
  }

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-6">
      <header className="rounded-bento border border-border-subtle bg-surface-1 p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="muted" uppercase>
                {entry.posLabel ?? entry.posKey}
              </Badge>
              {entry.cefr ? (
                <Badge tone="focus" uppercase>
                  {entry.cefr}
                </Badge>
              ) : null}
              {curriculumBadges.map((tag) => (
                <Badge key={tag} tone="xp" uppercase>
                  {tag}
                </Badge>
              ))}
            </div>
            <h2 className="mt-3 break-words text-4xl font-semibold leading-tight">
              {entry.headword}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-muted">
              {entry.ipaUk ? <span>UK {entry.ipaUk}</span> : null}
              {entry.ipaUs ? <span>US {entry.ipaUs}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {entry.audio.map((audio, index) => {
              const asset = audioQueries[index]?.data;
              const loading = audioQueries[index]?.isLoading;
              return (
                <Button
                  key={audio.ref}
                  variant="secondary"
                  size="sm"
                  onClick={() => void play(audio.ref, asset?.dataUrl)}
                  disabled={!asset || playingRef === audio.ref}
                >
                  {playingRef === audio.ref ? "Playing..." : loading ? "Loading" : audio.label}
                </Button>
              );
            })}
            {showYamlAction ? (
              <Button variant="secondary" size="sm" onClick={onCopy}>
                {copied ? "Copied" : "Copy YAML seed"}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {entry.lessonEntries.length > 0 ? <LessonEntries entries={entry.lessonEntries} /> : null}

      <section className="rounded-bento border border-border-subtle bg-surface-1 p-5">
        <h3 className="text-sm font-semibold uppercase text-muted-2">Definitions</h3>
        {definitions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No parsed definitions.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            {definitions.map((sense, index) => (
              <li key={`${sense.definitionEn}-${index}`} className="grid gap-2">
                <p className="text-base leading-7 text-app">
                  <span className="mr-2 font-mono text-xs text-muted-2">{index + 1}</span>
                  {sense.definitionEn}
                </p>
                {sense.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sense.labels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-border-subtle bg-surface-0 px-2 py-0.5 text-[11px] text-muted"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {sense.examples.length > 0 ? (
                  <ul className="ml-6 list-disc text-sm leading-6 text-muted">
                    {sense.examples.map((example) => (
                      <li key={example}>{example}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-bento border border-border-subtle bg-surface-1 p-5">
        <h3 className="text-sm font-semibold uppercase text-muted-2">Examples</h3>
        {entry.examples.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No parsed examples.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {entry.examples.map((example) => (
              <li
                key={example}
                className="rounded-xl border border-border-subtle bg-surface-0/75 px-3 py-2 text-sm leading-6 text-app"
              >
                {example}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function LessonEntries({ entries }: { entries: DictionaryLessonEntry[] }) {
  return (
    <section className="rounded-bento border border-border-subtle bg-surface-1 p-5">
      <h3 className="text-sm font-semibold uppercase text-muted-2">Lesson entries</h3>
      <div className="mt-4 grid gap-3">
        {entries.map((entry) => {
          const viDefinitions = entry.senses
            .map((sense) => sense.definitionVi)
            .filter((text): text is string => Boolean(text?.trim()));
          const viExamples = entry.examples
            .map((example) => example.translation)
            .filter((text): text is string => Boolean(text?.trim()));
          return (
            <article
              key={entry.id}
              className="rounded-xl border border-border-subtle bg-surface-0/75 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="xp" uppercase>
                  {entry.bookTitle}
                </Badge>
                <Badge tone="focus" uppercase>
                  Unit {entry.unitOrdinal}
                </Badge>
                <Badge tone="muted" uppercase>
                  {entry.pos}
                </Badge>
                {entry.cefrLevel ? (
                  <Badge tone="focus" uppercase>
                    {entry.cefrLevel}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <p className="text-lg font-semibold text-app">{entry.headword}</p>
                <p className="text-xs text-muted">
                  {entry.unitTitle} / {entry.lessonTitle}
                </p>
              </div>
              {viDefinitions.length > 0 ? (
                <ul className="mt-3 grid gap-1 text-sm leading-6 text-app">
                  {viDefinitions.map((definition) => (
                    <li key={definition}>{definition}</li>
                  ))}
                </ul>
              ) : null}
              {viExamples.length > 0 ? (
                <ul className="mt-3 list-disc pl-5 text-sm leading-6 text-muted">
                  {viExamples.map((translation) => (
                    <li key={translation}>{translation}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function curriculumTags(entry: DictionaryEntry): string[] {
  const out = new Set<string>();
  for (const lessonEntry of entry.lessonEntries) {
    out.add(lessonEntry.bookTitle);
    out.add(`Unit ${lessonEntry.unitOrdinal}`);
    if (out.size >= 4) break;
  }
  return [...out];
}

function toYamlSeed(entry: DictionaryEntry): string {
  const id = `${slug(entry.headword)}-${entry.posKey}`;
  const audioRef = entry.audio[0]?.ref ?? null;
  const lines = [
    `- id: ${id}`,
    `  headword: ${quoteYaml(entry.headword)}`,
    `  pos: ${entry.posKey}`,
  ];
  if (entry.ipaUk ?? entry.ipaUs)
    lines.push(`  ipa: ${quoteYaml(entry.ipaUk ?? entry.ipaUs ?? "")}`);
  if (entry.cefr) lines.push(`  cefr: ${entry.cefr}`);
  if (audioRef) lines.push(`  audio_ref: ${quoteYaml(audioRef)}`);
  lines.push(
    "  metadata:",
    "    dictionary_source: oald10",
    `    dictionary_key: ${quoteYaml(entry.key)}`,
  );
  if (entry.senses.length > 0) {
    lines.push("  senses:");
    for (const sense of entry.senses.slice(0, 3)) {
      lines.push(`    - definition_en: ${quoteYaml(sense.definitionEn)}`);
    }
  }
  if (entry.examples.length > 0) {
    lines.push("  examples:");
    for (const example of entry.examples.slice(0, 4)) {
      lines.push(`    - text: ${quoteYaml(example)}`, "      source_ref: oald10");
    }
  }
  return `${lines.join("\n")}\n`;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "entry"
  );
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
