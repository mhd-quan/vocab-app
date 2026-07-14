import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { SETTINGS_KEYS } from "@/modules/settings/keys";
import {
  type VocabStudySectionId,
  countVocabSections,
  encodeStudySectionParam,
  filterVocabEntriesBySections,
  vocabStudySections,
} from "@/modules/studySections";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { LessonIcon } from "@/ui/components/LearningIcons";
import { PressButton } from "@/ui/student/components/PressButton";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export function StudentUnitStudy() {
  const { studentId, unitId } = useParams({ from: "/student/profile/$studentId/unit/$unitId" });
  const studentIdNum = Number(studentId);
  const unitIdNum = Number(unitId);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<VocabStudySectionId[]>([]);
  const [skipSpeaking, setSkipSpeaking] = useState(false);

  const unitQ = useQuery({
    queryKey: ["curriculum", "unit", unitIdNum],
    queryFn: () => api.curriculum.getUnitById({ id: unitIdNum }),
    enabled: Number.isFinite(unitIdNum) && unitIdNum > 0,
  });

  const lessonsQ = useQuery({
    queryKey: queryKeys.curriculum.lessons(unitIdNum),
    queryFn: () => api.curriculum.listLessonsByUnit({ unitId: unitIdNum }),
    enabled: Number.isFinite(unitIdNum) && unitIdNum > 0,
  });

  const lessons = lessonsQ.data ?? [];
  const vocabLesson = lessons.find((lesson) => lesson.kind === "vocabulary") ?? null;
  const grammarLessons = lessons.filter((lesson) => lesson.kind === "grammar");

  const entriesQ = useQuery({
    queryKey: vocabLesson ? queryKeys.vocab.list(vocabLesson.id) : ["vocab", "list", "none"],
    queryFn: () => api.vocab.listByLesson({ lessonId: vocabLesson?.id ?? 0 }),
    enabled: Boolean(vocabLesson),
  });

  const excludeSpeakingQ = useQuery({
    queryKey: ["settings", "get", SETTINGS_KEYS.unitReviewExcludeSpeaking],
    queryFn: () => api.settings.get<boolean>({ key: SETTINGS_KEYS.unitReviewExcludeSpeaking }),
  });

  const entries = entriesQ.data ?? [];
  const sectionCounts = useMemo(() => countVocabSections(entries), [entries]);
  const availableSections = useMemo(
    () => vocabStudySections.filter((section) => sectionCounts[section.id] > 0),
    [sectionCounts],
  );
  const selectedEntries = useMemo(
    () => filterVocabEntriesBySections(entries, selected),
    [entries, selected],
  );

  useEffect(() => {
    if (availableSections.length === 0) return;
    setSelected((prev) => {
      const availableIds = new Set(availableSections.map((section) => section.id));
      const retained = prev.filter((id) => availableIds.has(id));
      return retained.length > 0 ? retained : availableSections.map((section) => section.id);
    });
  }, [availableSections]);

  const toggleSection = (sectionId: VocabStudySectionId) => {
    setSelected((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  const startVocab = () => {
    if (!vocabLesson || selectedEntries.length === 0) return;
    void navigate({
      to: "/student/profile/$studentId/session/$lessonId",
      params: { studentId: String(studentIdNum), lessonId: String(vocabLesson.id) },
      search: {
        sections: encodeStudySectionParam(selected),
        skipSpeaking: effectiveSkipSpeaking ? true : undefined,
      },
    });
  };

  const tutorExcludesSpeaking = excludeSpeakingQ.data === true;
  const effectiveSkipSpeaking = tutorExcludesSpeaking || skipSpeaking;

  if (!Number.isFinite(studentIdNum) || !Number.isFinite(unitIdNum)) {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-center">
        <p className="text-sm text-danger">Invalid unit.</p>
      </div>
    );
  }

  if (unitQ.isLoading || lessonsQ.isLoading) {
    return <p className="px-6 py-10 text-sm text-muted">Loading unit…</p>;
  }

  if (unitQ.isError || lessonsQ.isError) {
    return (
      <section role="alert" className="mx-auto max-w-md px-6 py-10 text-center">
        <h1 className="text-base font-semibold text-app">This unit is temporarily unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          The learning path is still safe. Try loading this unit again.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            void unitQ.refetch();
            void lessonsQ.refetch();
          }}
        >
          Retry
        </Button>
      </section>
    );
  }

  const unit = unitQ.data;

  if (!unit) {
    return (
      <EmptyState
        title="Unit not found"
        body="It may have been removed or is no longer assigned to this learning path."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-7">
      <header className="max-w-3xl pb-1">
        <p className="text-xs font-medium text-accent">{unit?.code ?? "Unit"}</p>
        <h1 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
          {unit?.title ?? "Unknown unit"}
        </h1>
        {unit?.summaryMd ? (
          <p className="mt-2 text-sm leading-6 text-muted">{unit.summaryMd}</p>
        ) : null}
      </header>

      {lessons.length === 0 ? (
        <EmptyState
          title="No lessons in this unit"
          body="Ask your tutor to import content first."
        />
      ) : null}

      {vocabLesson ? (
        <section data-testid="vocabulary-study-object" className="ui-group bg-surface-1">
          <header className="border-b border-border-subtle px-5 py-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.012em]">{vocabLesson.title}</h2>
            <p className="mt-1 text-[13px] leading-5 text-muted">
              Choose the sections you want in this practice round.
            </p>
          </header>

          {entriesQ.isLoading ? (
            <p className="px-5 py-6 text-sm text-muted">Loading sections…</p>
          ) : entriesQ.isError ? (
            <div role="alert" className="px-5 py-6">
              <p className="text-sm font-medium text-app">Vocabulary cards are unavailable</p>
              <p className="mt-1 text-xs text-muted">Try loading this section again.</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => entriesQ.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : availableSections.length === 0 ? (
            <EmptyState
              title="No vocabulary cards"
              body="This vocabulary lesson has no imported entries yet."
            />
          ) : (
            <div data-testid="vocabulary-section-list">
              {availableSections.map((section) => {
                const active = selected.includes(section.id);
                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      "ui-focus-ring flex min-h-14 w-full items-center gap-3 border-b border-border-subtle px-5 py-3 text-left outline-offset-[-2px] transition-colors last:border-b-0",
                      active ? "bg-accent/[0.07]" : "bg-surface-1 hover:bg-surface-2/70",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-sm border text-[10px]",
                        active
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-border-strong bg-surface-1",
                      )}
                    >
                      {active ? "✓" : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-app">
                        {section.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted">
                        {section.description}
                      </span>
                    </span>
                    <span data-tabular className="shrink-0 text-xs text-muted">
                      {sectionCounts[section.id]} cards
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <footer
            data-testid="vocabulary-study-actions"
            className="flex flex-col gap-3 border-t border-border-subtle bg-surface-2/35 px-5 py-4 sm:flex-row sm:items-center"
          >
            <label className="flex min-w-0 items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                checked={effectiveSkipSpeaking}
                disabled={tutorExcludesSpeaking || excludeSpeakingQ.isLoading}
                onChange={(event) => setSkipSpeaking(event.currentTarget.checked)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-app">Skip speaking</span>
                <span className="block text-xs leading-4 text-muted">
                  {tutorExcludesSpeaking
                    ? "Speaking is turned off by your tutor."
                    : "Use written and listening exercises only."}
                </span>
              </span>
            </label>
            <div className="ml-auto flex items-center gap-3">
              <span aria-live="polite" data-tabular className="text-xs text-muted">
                {selectedEntries.length} {selectedEntries.length === 1 ? "card" : "cards"} selected
              </span>
              <PressButton size="md" onClick={startVocab} disabled={selectedEntries.length === 0}>
                Start {selectedEntries.length} {selectedEntries.length === 1 ? "card" : "cards"}
              </PressButton>
            </div>
          </footer>
        </section>
      ) : null}

      {grammarLessons.length > 0 ? (
        <section aria-labelledby="grammar-practice-title">
          <h2 id="grammar-practice-title" className="mb-3 text-[15px] font-semibold">
            Grammar practice
          </h2>
          <div className="ui-group bg-surface-1">
            {grammarLessons.map((lesson) => (
              <Link
                key={lesson.id}
                to="/student/profile/$studentId/session/$lessonId"
                params={{ studentId: String(studentIdNum), lessonId: String(lesson.id) }}
                className="ui-focus-ring group grid min-h-24 gap-4 border-b border-border-subtle px-5 py-4 outline-offset-[-2px] transition-colors last:border-b-0 hover:bg-surface-2/65 active:bg-surface-3/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <LessonIcon className="h-[18px] w-[18px] text-accent" />
                    <h3 className="truncate text-[15px] font-semibold">{lesson.title}</h3>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-5 text-muted">
                    Review the rule, then apply it in a focused practice set.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-xs font-medium text-accent group-hover:text-app">
                  Start grammar
                  <AppGlyph name="arrowRight" className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
