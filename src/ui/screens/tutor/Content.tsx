import type { Book, GrammarTopic, Lesson, Unit } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Badge } from "@/ui/components/Badge";
import { ClozeText } from "@/ui/components/ClozeText";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";
import { EditIcon } from "@/ui/shell/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { VocabEntryFull } from "../../../../electron/db/repositories/vocab";

type ContentSelection = { kind: "vocabulary"; id: number } | { kind: "grammar"; id: number } | null;

export function TutorContent() {
  // Deep-link entry-points: analytics weak-word rows pass `?entry=` (and
  // optionally `?book=`) so the browser opens scrolled to that word.
  const search = useSearch({ from: "/tutor/content" });
  const [selectedBookId, setSelectedBookId] = useState<number | null>(search.book ?? null);
  const [selection, setSelection] = useState<ContentSelection>(
    search.entry ? { kind: "vocabulary", id: search.entry } : null,
  );

  const booksQ = useQuery({
    queryKey: queryKeys.curriculum.books(),
    queryFn: () => api.curriculum.listBooks(),
  });

  // Sync state with incoming search params; navigating between two weak
  // words on the same screen swaps both fields atomically.
  useEffect(() => {
    if (search.book !== undefined) setSelectedBookId(search.book);
    if (search.entry !== undefined) setSelection({ kind: "vocabulary", id: search.entry });
  }, [search.book, search.entry]);

  // Auto-select the first book once data lands — only when nothing was
  // pinned via the search params.
  useEffect(() => {
    if (selectedBookId === null && booksQ.data && booksQ.data.length > 0) {
      const first = booksQ.data[0];
      if (first) setSelectedBookId(first.id);
    }
  }, [booksQ.data, selectedBookId]);

  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Content browser"
        subtitle="Books → units → lessons → vocab entries and grammar topics. Read-only — author content via YAML and `npm run import`."
      />

      <div className="grid h-[calc(100vh_-_var(--tutor-header-height))] grid-cols-[16rem_minmax(0,1fr)_minmax(22rem,28rem)] border-t border-border-subtle bg-[color:var(--md-sys-color-surface-container-low)]">
        <BooksPane
          books={booksQ.data ?? []}
          loading={booksQ.isLoading}
          selectedId={selectedBookId}
          onSelect={(id) => {
            setSelectedBookId(id);
            setSelection(null);
          }}
        />

        <LessonsPane bookId={selectedBookId} selection={selection} onSelectContent={setSelection} />

        <DetailPane selection={selection} />
      </div>
    </>
  );
}

function BooksPane({
  books,
  loading,
  selectedId,
  onSelect,
}: {
  books: Book[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <aside className="tutor-scrollbar flex h-full flex-col overflow-y-auto border-r border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)]">
      <div className="border-b border-border-subtle bg-[color:var(--md-sys-color-surface-container)] px-4 py-3">
        <h2 className="text-[10px] font-medium uppercase text-muted">Books</h2>
      </div>
      {loading ? (
        <p className="px-4 py-3 text-xs text-muted">Loading…</p>
      ) : books.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No books yet"
            body="Add a YAML file in content/books/ and run npm run import."
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 py-2">
          {books.map((book) => (
            <BookRow
              key={book.id}
              book={book}
              selected={selectedId === book.id}
              onSelect={() => onSelect(book.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

function BookRow({
  book,
  selected,
  onSelect,
}: {
  book: Book;
  selected: boolean;
  onSelect: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(book.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setTitle(book.title);
  }, [book.title, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save(nextTitle: string) {
    const trimmed = nextTitle.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    if (trimmed === book.title) {
      setEditing(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.curriculum.updateBookTitle({ id: book.id, title: trimmed });
      await queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.books() });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update title.");
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void save(title);
  }

  if (editing) {
    return (
      <li>
        <form
          className={cn(
            "rounded-[var(--shape-corner-lg)] border px-2 py-2",
            selected
              ? "border-accent bg-accent/10"
              : "border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)]",
          )}
          onSubmit={onSubmit}
        >
          <input
            ref={inputRef}
            value={title}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (!saving) void save(title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setTitle(book.title);
                setError(null);
                setEditing(false);
              }
            }}
            aria-label={`Edit title for ${book.code}`}
            className="w-full rounded-[var(--shape-corner-sm)] border border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)] px-2 py-1 text-sm font-medium text-app outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <span className="mt-1 block truncate font-mono text-[10px] text-muted-2">
            {book.code}
          </span>
          {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
        </form>
      </li>
    );
  }

  return (
    <li>
      <div
        className={cn(
          "group grid grid-cols-[1fr_auto] items-center rounded-[var(--shape-corner-lg)] border transition-colors",
          selected
            ? "border-transparent bg-[color:var(--md-sys-color-secondary-container)] text-[color:var(--md-sys-color-on-secondary-container)]"
            : "border-transparent text-muted hover:border-border-subtle hover:bg-accent/[var(--state-hover)] hover:text-app",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
          className="min-w-0 px-3 py-2 text-left text-sm"
        >
          <span className="block truncate font-medium">{book.title}</span>
          <span className="block truncate font-mono text-[10px] text-muted-2">{book.code}</span>
        </button>
        <button
          type="button"
          aria-label={`Edit ${book.title}`}
          onClick={() => setEditing(true)}
          className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-2 opacity-70 transition hover:bg-[color:var(--md-sys-color-surface-container-lowest)] hover:text-app group-hover:opacity-100"
        >
          <EditIcon />
        </button>
      </div>
    </li>
  );
}

function LessonsPane({
  bookId,
  selection,
  onSelectContent,
}: {
  bookId: number | null;
  selection: ContentSelection;
  onSelectContent: (selection: ContentSelection) => void;
}) {
  const unitsQ = useQuery({
    queryKey: queryKeys.curriculum.units(bookId ?? -1),
    queryFn: () => api.curriculum.listUnitsByBook({ bookId: bookId as number }),
    enabled: bookId !== null,
  });
  const units = unitsQ.data ?? [];

  if (bookId === null) {
    return (
      <div className="flex items-center justify-center bg-app">
        <p className="text-sm text-muted">Pick a book to browse units &amp; entries.</p>
      </div>
    );
  }

  if (unitsQ.isLoading) {
    return <p className="px-6 py-4 text-sm text-muted">Loading units…</p>;
  }

  if (units.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No units in this book"
          body="Vocab and grammar YAML files create unit + lesson rows on import."
        />
      </div>
    );
  }

  return (
    <div className="tutor-scrollbar flex h-full flex-col overflow-y-auto bg-[color:var(--md-sys-color-surface)]">
      <ul className="flex flex-col">
        {units.map((unit) => (
          <UnitGroupRow
            key={unit.id}
            unit={unit}
            selection={selection}
            onSelectContent={onSelectContent}
          />
        ))}
      </ul>
    </div>
  );
}

function UnitGroupRow({
  unit,
  selection,
  onSelectContent,
}: {
  unit: Unit;
  selection: ContentSelection;
  onSelectContent: (selection: ContentSelection) => void;
}) {
  const lessonsQ = useQuery({
    queryKey: queryKeys.curriculum.lessons(unit.id),
    queryFn: () => api.curriculum.listLessonsByUnit({ unitId: unit.id }),
  });
  const lessons = lessonsQ.data ?? [];
  return (
    <li className="border-b border-border-subtle last:border-b-0">
      <header className="flex items-baseline gap-2 px-6 py-3">
        <span className="font-mono text-[11px] text-muted-2">{unit.code}</span>
        <h3 className="text-sm font-semibold">{unit.title}</h3>
      </header>
      <div className="flex flex-col gap-3 pb-4">
        {lessons.length === 0 ? (
          <p className="px-6 text-xs text-muted-2">No lessons in this unit.</p>
        ) : (
          lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              selection={selection}
              onSelectContent={onSelectContent}
            />
          ))
        )}
      </div>
    </li>
  );
}

function LessonRow({
  lesson,
  selection,
  onSelectContent,
}: {
  lesson: Lesson;
  selection: ContentSelection;
  onSelectContent: (selection: ContentSelection) => void;
}) {
  const entriesQ = useQuery({
    queryKey: queryKeys.vocab.list(lesson.id),
    queryFn: () => api.vocab.listByLesson({ lessonId: lesson.id }),
    enabled: lesson.kind === "vocabulary",
  });
  const topicsQ = useQuery({
    queryKey: queryKeys.grammar.list(lesson.id),
    queryFn: () => api.grammar.listByLesson({ lessonId: lesson.id }),
    enabled: lesson.kind === "grammar",
  });
  const entries = entriesQ.data ?? [];
  const topics = topicsQ.data ?? [];
  const count = lesson.kind === "grammar" ? topics.length : entries.length;
  return (
    <section className="px-6">
      <header className="mb-2 flex items-center gap-2">
        <Badge tone={lesson.kind === "vocabulary" ? "accent" : "focus"} uppercase>
          {lesson.kind}
        </Badge>
        <h4 className="text-xs font-medium text-app">{lesson.title}</h4>
        <span className="text-[10px] text-muted-2">({count})</span>
      </header>
      {lesson.kind === "vocabulary" && entriesQ.isLoading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : lesson.kind === "grammar" && topicsQ.isLoading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : lesson.kind === "vocabulary" && entries.length === 0 ? (
        <p className="text-xs text-muted-2">No entries imported for this lesson yet.</p>
      ) : lesson.kind === "grammar" && topics.length === 0 ? (
        <p className="text-xs text-muted-2">No grammar topics imported for this lesson yet.</p>
      ) : lesson.kind === "vocabulary" ? (
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <EntryButton
                entry={entry}
                selected={selection?.kind === "vocabulary" && selection.id === entry.id}
                onClick={() => onSelectContent({ kind: "vocabulary", id: entry.id })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-1 gap-1">
          {topics.map((topic) => (
            <li key={topic.id}>
              <TopicButton
                topic={topic}
                selected={selection?.kind === "grammar" && selection.id === topic.id}
                onClick={() => onSelectContent({ kind: "grammar", id: topic.id })}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EntryButton({
  entry,
  selected,
  onClick,
}: {
  entry: { id: number; headword: string; pos: string };
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected && typeof ref.current?.scrollIntoView === "function") {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-baseline gap-2 rounded-[var(--shape-corner-lg)] border px-3 py-2 text-left transition-[background-color,border-color,box-shadow]",
        selected
          ? "border-accent bg-accent/10 shadow-[var(--md-sys-elevation-1)]"
          : "border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)] hover:border-accent/40 hover:bg-accent/[var(--state-hover)]",
      )}
    >
      <span className="truncate text-sm font-medium">{entry.headword}</span>
      <span className="font-mono text-[10px] text-muted-2">{entry.pos}</span>
    </button>
  );
}

function TopicButton({
  topic,
  selected,
  onClick,
}: {
  topic: GrammarTopic;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected && typeof ref.current?.scrollIntoView === "function") {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-baseline gap-2 rounded-[var(--shape-corner-lg)] border px-3 py-2 text-left transition-[background-color,border-color,box-shadow]",
        selected
          ? "border-focus bg-focus/10 shadow-[var(--md-sys-elevation-1)]"
          : "border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)] hover:border-focus/40 hover:bg-focus/[var(--state-hover)]",
      )}
    >
      <span className="truncate text-sm font-medium">{topic.title}</span>
      {topic.difficulty ? (
        <span className="font-mono text-[10px] text-muted-2">L{topic.difficulty}</span>
      ) : null}
    </button>
  );
}

function DetailPane({ selection }: { selection: ContentSelection }) {
  const entryId = selection?.kind === "vocabulary" ? selection.id : null;
  const topicId = selection?.kind === "grammar" ? selection.id : null;
  const entryQ = useQuery({
    queryKey: ["vocab", "byId", entryId ?? -1],
    queryFn: () => api.vocab.getById({ id: entryId as number }),
    enabled: entryId !== null,
  });
  const topicQ = useQuery({
    queryKey: queryKeys.grammar.byId(topicId ?? -1),
    queryFn: () => api.grammar.getById({ id: topicId as number }),
    enabled: topicId !== null,
  });

  return (
    <aside className="tutor-scrollbar h-full overflow-y-auto border-l border-border-subtle bg-[color:var(--md-sys-color-surface-container-lowest)]">
      {selection === null ? (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-xs text-muted">Pick a vocab entry or grammar topic to see details.</p>
        </div>
      ) : selection.kind === "vocabulary" && entryQ.isLoading ? (
        <p className="px-6 py-4 text-xs text-muted">Loading entry…</p>
      ) : selection.kind === "grammar" && topicQ.isLoading ? (
        <p className="px-6 py-4 text-xs text-muted">Loading topic…</p>
      ) : selection.kind === "vocabulary" && !entryQ.data ? (
        <p className="px-6 py-4 text-xs text-danger">Entry not found.</p>
      ) : selection.kind === "grammar" && !topicQ.data ? (
        <p className="px-6 py-4 text-xs text-danger">Topic not found.</p>
      ) : selection.kind === "vocabulary" && entryQ.data ? (
        <EntryDetail entry={entryQ.data} />
      ) : topicQ.data ? (
        <GrammarTopicDetail topic={topicQ.data} />
      ) : null}
    </aside>
  );
}

function EntryDetail({ entry }: { entry: VocabEntryFull }) {
  return (
    <article className="flex flex-col gap-5 px-5 py-5">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-2xl font-semibold">{entry.headword}</h3>
          <span className="font-mono text-xs text-muted">{entry.pos}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {entry.ipa ? <span className="font-mono text-xs text-muted">{entry.ipa}</span> : null}
          {entry.cefrLevel ? (
            <Badge tone="accent" uppercase>
              {entry.cefrLevel}
            </Badge>
          ) : null}
          {(entry.tags ?? []).map((tag) => (
            <Badge key={tag} tone="muted">
              #{tag}
            </Badge>
          ))}
        </div>
      </header>

      {entry.senses.length > 0 ? (
        <Section title="Senses">
          <ol className="flex flex-col gap-2">
            {entry.senses
              .slice()
              .sort((a, b) => a.ordinal - b.ordinal)
              .map((sense, i) => (
                <li key={sense.id} className="flex gap-3 text-sm">
                  <span className="font-mono text-xs text-muted-2">{i + 1}.</span>
                  <div className="flex flex-1 flex-col gap-0.5">
                    {sense.definitionEn ? (
                      <span className="text-app">{sense.definitionEn}</span>
                    ) : null}
                    {sense.definitionVi ? (
                      <span className="text-xs text-muted">{sense.definitionVi}</span>
                    ) : null}
                    {sense.register ? (
                      <span className="text-[10px] uppercase text-muted-2">{sense.register}</span>
                    ) : null}
                  </div>
                </li>
              ))}
          </ol>
        </Section>
      ) : null}

      {entry.examples.length > 0 ? (
        <Section title="Examples">
          <ul className="flex flex-col gap-3">
            {entry.examples
              .slice()
              .sort((a, b) => a.ordinal - b.ordinal)
              .map((ex) => (
                <li
                  key={ex.id}
                  className="rounded-xl border border-border-subtle bg-surface-0/50 px-3 py-2"
                >
                  <ClozeText text={ex.text} className="text-sm" />
                  {ex.translation ? (
                    <p className="mt-1 text-xs text-muted">{ex.translation}</p>
                  ) : null}
                  {ex.clozeHint ? (
                    <p className="mt-1 font-mono text-[10px] text-muted-2">hint: {ex.clozeHint}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        </Section>
      ) : null}

      {entry.forms.length > 0 ? (
        <Section title="Forms">
          <ul className="flex flex-wrap gap-2">
            {entry.forms.map((form) => (
              <li
                key={form.id}
                className="flex flex-col rounded-xl border border-border-subtle bg-surface-0/50 px-3 py-1.5 text-xs"
              >
                <span className="text-[10px] uppercase text-muted-2">
                  {form.kind.replace(/_/g, " ")}
                </span>
                <span className="font-medium">{form.formText}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {entry.collocations.length > 0 ? (
        <Section title="Collocations">
          <ul className="flex flex-col gap-1.5">
            {entry.collocations.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-app">{c.collocation}</span>
                {c.pattern ? (
                  <span className="font-mono text-[10px] text-muted-2">{c.pattern}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {entry.relations.length > 0 ? (
        <Section title="Related">
          <ul className="flex flex-wrap gap-1.5">
            {entry.relations.map((r) => (
              <li key={r.id}>
                <Badge tone={r.relation === "antonym" ? "warning" : "accent"} uppercase>
                  {r.relation}
                </Badge>{" "}
                <span className="text-xs text-app">{r.relatedText}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </article>
  );
}

function GrammarTopicDetail({ topic }: { topic: GrammarTopic }) {
  const metadata = topic.metadata ?? {};
  const patterns = readPatternList(metadata.patterns);
  const examples = readExampleList(metadata.examples);
  const mistakes = readMistakeList(metadata.common_mistakes);
  const checks = readCheckList(metadata.checks);

  return (
    <article className="flex flex-col gap-5 px-5 py-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-2xl font-semibold">{topic.title}</h3>
          <span className="font-mono text-xs text-muted">{topic.slug}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {topic.difficulty ? (
            <Badge tone="focus" uppercase>
              Level {topic.difficulty}
            </Badge>
          ) : null}
          {(topic.tags ?? []).map((tag) => (
            <Badge key={tag} tone="muted">
              #{tag}
            </Badge>
          ))}
        </div>
      </header>

      {topic.summaryMd ? (
        <Section title="Summary">
          <p className="text-sm text-app">{topic.summaryMd}</p>
        </Section>
      ) : null}

      {topic.explanationMd ? (
        <Section title="Explanation">
          <div className="whitespace-pre-wrap text-sm leading-6 text-app">
            {topic.explanationMd}
          </div>
        </Section>
      ) : null}

      {patterns.length > 0 ? (
        <Section title="Patterns">
          <ul className="flex flex-col gap-2">
            {patterns.map((pattern, i) => (
              <li
                key={`${pattern.form}-${i}`}
                className="rounded-xl border border-border-subtle bg-surface-0/50 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  {pattern.label ? (
                    <span className="text-[10px] font-semibold uppercase text-muted-2">
                      {pattern.label}
                    </span>
                  ) : null}
                  <span className="font-mono text-app">{pattern.form}</span>
                </div>
                {pattern.use ? <p className="mt-1 text-xs text-muted">{pattern.use}</p> : null}
                {pattern.examples.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {pattern.examples.map((example) => (
                      <li key={example} className="text-xs text-muted">
                        {example}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {examples.length > 0 ? (
        <Section title="Examples">
          <ul className="flex flex-col gap-2">
            {examples.map((example, i) => (
              <li
                key={`${example.text}-${i}`}
                className="rounded-xl border border-border-subtle bg-surface-0/50 px-3 py-2"
              >
                <p className="text-sm text-app">{example.text}</p>
                {example.translation ? (
                  <p className="mt-1 text-xs text-muted">{example.translation}</p>
                ) : null}
                {example.explanation ? (
                  <p className="mt-1 text-xs text-muted-2">{example.explanation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {mistakes.length > 0 ? (
        <Section title="Common Mistakes">
          <ul className="flex flex-col gap-2">
            {mistakes.map((mistake, i) => (
              <li key={`${mistake.wrong}-${i}`} className="text-sm">
                <p className="text-danger">{mistake.wrong}</p>
                <p className="text-success">{mistake.correct}</p>
                {mistake.note ? <p className="text-xs text-muted">{mistake.note}</p> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {checks.length > 0 ? (
        <Section title="Checks">
          <ul className="flex flex-col gap-2">
            {checks.map((check, i) => (
              <li key={`${check.prompt}-${i}`} className="rounded-xl bg-surface-0/50 px-3 py-2">
                <p className="text-sm text-app">{check.prompt}</p>
                <p className="mt-1 text-xs text-success">{check.answer}</p>
                {check.explanation ? (
                  <p className="mt-1 text-xs text-muted">{check.explanation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-[10px] font-medium uppercase text-muted">{title}</h4>
      {children}
    </section>
  );
}

interface PatternView {
  label: string | null;
  form: string;
  use: string | null;
  examples: string[];
}

interface ExampleView {
  text: string;
  translation: string | null;
  explanation: string | null;
}

interface MistakeView {
  wrong: string;
  correct: string;
  note: string | null;
}

interface CheckView {
  prompt: string;
  answer: string;
  explanation: string | null;
}

function readPatternList(value: unknown): PatternView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): PatternView[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.form !== "string") return [];
    return [
      {
        label: typeof row.label === "string" ? row.label : null,
        form: row.form,
        use: typeof row.use === "string" ? row.use : null,
        examples: Array.isArray(row.examples)
          ? row.examples.filter((example): example is string => typeof example === "string")
          : [],
      },
    ];
  });
}

function readExampleList(value: unknown): ExampleView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ExampleView[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.text !== "string") return [];
    return [
      {
        text: row.text,
        translation: typeof row.translation === "string" ? row.translation : null,
        explanation: typeof row.explanation === "string" ? row.explanation : null,
      },
    ];
  });
}

function readMistakeList(value: unknown): MistakeView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): MistakeView[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.wrong !== "string" || typeof row.correct !== "string") return [];
    return [
      {
        wrong: row.wrong,
        correct: row.correct,
        note: typeof row.note === "string" ? row.note : null,
      },
    ];
  });
}

function readCheckList(value: unknown): CheckView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): CheckView[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.prompt !== "string" || typeof row.answer !== "string") return [];
    return [
      {
        prompt: row.prompt,
        answer: row.answer,
        explanation: typeof row.explanation === "string" ? row.explanation : null,
      },
    ];
  });
}
