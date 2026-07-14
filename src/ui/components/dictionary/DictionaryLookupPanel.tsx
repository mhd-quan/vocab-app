import type { DictionaryEntry, DictionaryLessonEntry } from "@/data/dictionary";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { PronunciationControls } from "@/ui/components/PronunciationControls";
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
        "grid min-h-0 gap-0 overflow-hidden border border-border-subtle bg-paper",
        density === "page"
          ? "h-full flex-1 grid-cols-[18rem_minmax(0,1fr)] rounded-none border-x-0"
          : "h-full grid-cols-[17rem_minmax(0,1fr)] border-0",
        className,
      )}
    >
      <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-ground/70">
        <form onSubmit={onSubmit} className="border-b border-border-subtle p-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">Search word</span>
            <div className="relative">
              <input
                data-dictionary-search
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the dictionary"
                spellCheck={false}
                className="ui-focus-ring h-9 w-full rounded-control border border-border-strong/70 bg-paper px-3 pr-9 text-[13px] text-app transition-[border-color,box-shadow] focus:border-accent"
              />
              {query.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedTerm("");
                    setCopied(false);
                  }}
                  aria-label="Clear search"
                  className="ui-focus-ring absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-control text-base leading-none text-muted transition-colors hover:bg-surface-2 hover:text-app"
                >
                  <AppGlyph name="x" className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </label>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {entry?.related.length ? (
            <WordFamilyList
              items={entry.related}
              selectedKey={selectedTerm}
              onSelect={(item) => {
                setSelectedTerm(item.key);
                setQuery(item.label);
                setCopied(false);
              }}
            />
          ) : null}
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
                      "ui-focus-ring w-full rounded-control px-2.5 py-2 text-left text-sm transition-colors",
                      selectedTerm === item.key
                        ? "bg-accent text-accent-fg"
                        : "text-muted hover:bg-surface-2 hover:text-app",
                    )}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{item.label}</span>
                      <PosMeta active={selectedTerm === item.key} label={posLabel(item)} />
                    </span>
                    {item.exact ? (
                      <span className="block text-[10px] opacity-75">Exact</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section aria-label="Dictionary entry" className="min-h-0 overflow-y-auto bg-paper">
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
          <DictionaryEmptyPrompt
            hasQuery={debouncedQuery.length > 0}
            onLookup={(term) => {
              setQuery(term);
              setSelectedTerm(term);
              setCopied(false);
            }}
          />
        )}
      </section>
    </div>
  );
}

function DictionaryEmptyPrompt({
  hasQuery,
  onLookup,
}: {
  hasQuery: boolean;
  onLookup: (term: string) => void;
}) {
  return (
    <div className="flex h-full items-center justify-center px-8 py-12 text-center">
      <div className="max-w-sm">
        <AppGlyph name="dictionary" className="mx-auto h-8 w-8 text-muted-2" />
        <h2 className="mt-4 text-base font-semibold">
          {hasQuery ? "Choose a result" : "Look up any word"}
        </h2>
        <p className="mt-1.5 text-[13px] leading-5 text-muted">
          {hasQuery
            ? "Select a match on the left to see pronunciation, definitions, examples, and level."
            : "Search by a word or phrase. The dictionary includes pronunciation, usage, CEFR level, and audio."}
        </p>
        {!hasQuery ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Suggested words">
            {["achievement", "practice", "focus"].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onLookup(term)}
                className="ui-focus-ring h-8 rounded-control border border-border-subtle bg-paper px-3 text-xs text-muted transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-app"
              >
                {term}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WordFamilyList({
  items,
  selectedKey,
  onSelect,
}: {
  items: DictionaryEntry["related"];
  selectedKey: string;
  onSelect: (item: DictionaryEntry["related"][number]) => void;
}) {
  return (
    <section className="mb-2 border-b border-border-subtle pb-2">
      <p className="px-2 pb-1.5 pt-1 text-[11px] font-medium text-muted">Word family</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "ui-focus-ring flex w-full min-w-0 items-center justify-between gap-2 rounded-control px-2 py-1.5 text-left text-xs transition-colors",
                selectedKey === item.key
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-surface-2 hover:text-app",
              )}
            >
              <span className="min-w-0 truncate font-medium">{item.label}</span>
              <PosMeta active={selectedKey === item.key} label={posLabel(item)} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PosMeta({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 text-right text-[10px]",
        active ? "text-current opacity-80" : "text-muted-2",
      )}
    >
      {label}
    </span>
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
  const imageQueries = useQueries({
    queries: entry.images.map((image) => ({
      queryKey: queryKeys.dictionary.asset(image.ref),
      queryFn: () => api.dictionary.asset({ ref: image.ref }),
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });
  const definitions = useMemo(
    () => entry.senses.filter((sense) => sense.definitionEn.trim().length > 0),
    [entry.senses],
  );
  const curriculumBadges = useMemo(() => curriculumTags(entry), [entry]);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
      <header className="learning-trace pl-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="muted">{entry.posLabel ?? entry.posKey}</Badge>
              {entry.cefr ? <Badge tone="focus">{entry.cefr}</Badge> : null}
            </div>
            <h2 className="ui-lexical mt-3 break-words text-[34px] font-semibold leading-tight">
              {entry.headword}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-muted">
              {entry.ipaUk ? <span>UK {entry.ipaUk}</span> : null}
              {entry.ipaUs ? <span>US {entry.ipaUs}</span> : null}
            </div>
            {curriculumBadges.length > 0 ? (
              <p className="mt-3 text-xs text-muted">Appears in {curriculumBadges.join(" · ")}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PronunciationControls audioRefs={entry.audio} size="sm" />
            {showYamlAction ? (
              <Button variant="secondary" size="sm" onClick={onCopy}>
                {copied ? "Copied" : "Copy YAML seed"}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="border-t border-border-subtle pt-5" aria-labelledby="definitions-title">
        <h3 id="definitions-title" className="text-sm font-semibold">
          Definitions
        </h3>
        {definitions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No parsed definitions.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border-subtle">
            {definitions.map((sense, index) => (
              <li
                key={`${sense.definitionEn}-${index}`}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span className="tabular-figure pt-0.5 text-xs text-muted-2">{index + 1}</span>
                <div>
                  <p className="ui-lexical text-base leading-7 text-app">{sense.definitionEn}</p>
                  {sense.labels.length > 0 ? (
                    <p className="mt-1.5 text-xs text-muted">{sense.labels.join(" · ")}</p>
                  ) : null}
                  {sense.examples.length > 0 ? (
                    <ul className="ui-lexical mt-2 border-l-2 border-border-subtle pl-3 text-sm leading-6 text-muted">
                      {sense.examples.map((example) => (
                        <li key={example}>{example}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {entry.lessonEntries.length > 0 ? <LessonEntries entries={entry.lessonEntries} /> : null}

      {entry.images.length > 0 ? (
        <EntryImages images={entry.images} assets={imageQueries.map((query) => query.data)} />
      ) : null}

      <section className="border-t border-border-subtle pt-5" aria-labelledby="examples-title">
        <h3 id="examples-title" className="text-sm font-semibold">
          Examples
        </h3>
        {entry.examples.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No parsed examples.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border-subtle">
            {entry.examples.map((example) => (
              <li
                key={example}
                className="ui-lexical py-2.5 text-sm leading-6 text-app first:pt-0 last:pb-0"
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

function EntryImages({
  images,
  assets,
}: {
  images: DictionaryEntry["images"];
  assets: Array<{ dataUrl: string; mime: string } | null | undefined>;
}) {
  const ready = images
    .map((image, index) => ({ image, asset: assets[index] }))
    .filter((item) => item.asset?.dataUrl);
  if (ready.length === 0) return null;

  return (
    <section className="border-t border-border-subtle pt-5" aria-labelledby="visuals-title">
      <h3 id="visuals-title" className="text-sm font-semibold">
        Visuals
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ready.map(({ image, asset }) => (
          <figure key={image.ref} className="object-surface overflow-hidden bg-ground">
            <img
              src={asset?.dataUrl}
              alt={image.alt ?? ""}
              className="h-52 w-full object-contain p-3"
            />
            {image.alt ? (
              <figcaption className="border-t border-border-subtle px-3 py-2 text-xs text-muted">
                {image.alt}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

function LessonEntries({ entries }: { entries: DictionaryLessonEntry[] }) {
  return (
    <section className="border-t border-border-subtle pt-5" aria-labelledby="lesson-entries-title">
      <h3 id="lesson-entries-title" className="text-sm font-semibold">
        In your lessons
      </h3>
      <div className="grouped-list mt-3 divide-y divide-border-subtle bg-ground/70">
        {entries.map((entry) => {
          const viDefinitions = entry.senses
            .map((sense) => sense.definitionVi)
            .filter((text): text is string => Boolean(text?.trim()));
          const viExamples = entry.examples
            .map((example) => example.translation)
            .filter((text): text is string => Boolean(text?.trim()));
          return (
            <article key={entry.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="ui-lexical text-lg font-semibold text-app">{entry.headword}</p>
                <p className="text-xs text-muted">
                  {entry.pos}
                  {entry.cefrLevel ? ` · ${entry.cefrLevel}` : ""}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {entry.bookTitle} · Unit {entry.unitOrdinal} · {entry.unitTitle} /{" "}
                {entry.lessonTitle}
              </p>
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

const POS_LABELS: Record<string, string> = {
  adjective: "adj",
  adverb: "adv",
  auxiliary: "aux",
  conjunction: "conj",
  determiner: "det",
  interjection: "intj",
  modal: "modal",
  noun: "noun",
  phrasal_verb: "phrv",
  phrase: "phr",
  preposition: "prep",
  pronoun: "pron",
  verb: "verb",
};

function posLabel(item: { posLabel: string | null; posKey: string }): string {
  return POS_LABELS[item.posKey] ?? item.posLabel?.trim().slice(0, 6) ?? "phr";
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
