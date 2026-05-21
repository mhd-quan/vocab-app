import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import {
  type VocabStudySectionId,
  countVocabSections,
  encodeStudySectionParam,
  filterVocabEntriesBySections,
  vocabStudySections,
} from "@/modules/studySections";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { EmptyState } from "@/ui/components/EmptyState";
import { LessonIcon } from "@/ui/components/LearningIcons";
import { MascotIcon } from "@/ui/student/components/MascotIcon";
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

  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(studentIdNum),
    queryFn: () => api.students.getById({ id: studentIdNum }),
    enabled: Number.isFinite(studentIdNum) && studentIdNum > 0,
  });

  const lessons = lessonsQ.data ?? [];
  const vocabLesson = lessons.find((lesson) => lesson.kind === "vocabulary") ?? null;
  const grammarLessons = lessons.filter((lesson) => lesson.kind === "grammar");

  const entriesQ = useQuery({
    queryKey: vocabLesson ? queryKeys.vocab.list(vocabLesson.id) : ["vocab", "list", "none"],
    queryFn: () => api.vocab.listByLesson({ lessonId: vocabLesson?.id ?? 0 }),
    enabled: Boolean(vocabLesson),
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
      search: { sections: encodeStudySectionParam(selected) },
    });
  };

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

  const unit = unitQ.data;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-10">
      <Link
        to="/student/profile/$studentId"
        params={{ studentId: String(studentIdNum) }}
        className="self-start text-xs font-medium text-muted hover:text-app"
      >
        Back to units
      </Link>

      <BentoCard
        tone="focus"
        className="grid gap-5 p-6 lg:grid-cols-[1.2fr_auto_auto] lg:items-center"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="focus" uppercase>
              {unit?.code ?? "Unit"}
            </Badge>
            <Badge tone="muted" uppercase>
              Study plan
            </Badge>
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            {unit?.title ?? "Unknown unit"}
          </h1>
          {unit?.summaryMd ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{unit.summaryMd}</p>
          ) : null}
        </div>
        <MascotIcon
          mood="thinking"
          avatarSeed={studentQ.data?.avatarSeed ?? null}
          studentId={studentIdNum}
          className="hidden h-24 w-24 shrink-0 text-focus lg:block"
        />
        <div className="rounded-bento border border-border-subtle bg-surface-0/70 p-4">
          <p className="text-xs font-semibold uppercase text-muted-2">Selected cards</p>
          <p className="mt-1 font-mono text-3xl text-app">{selectedEntries.length}</p>
        </div>
      </BentoCard>

      {lessons.length === 0 ? (
        <EmptyState
          title="No lessons in this unit"
          body="Ask your tutor to import content first."
        />
      ) : null}

      {vocabLesson ? (
        <BentoCard className="flex flex-col gap-5 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge tone="xp" uppercase>
                Vocabulary
              </Badge>
              <h2 className="mt-2 text-2xl font-semibold">{vocabLesson.title}</h2>
              <p className="mt-1 text-sm text-muted">
                Pick one or more sections. Practice will only use matching cards.
              </p>
            </div>
            <PressButton size="md" onClick={startVocab} disabled={selectedEntries.length === 0}>
              Start {selectedEntries.length} cards
            </PressButton>
          </header>

          {entriesQ.isLoading ? (
            <p className="text-sm text-muted">Loading sections…</p>
          ) : availableSections.length === 0 ? (
            <EmptyState
              title="No vocabulary cards"
              body="This vocabulary lesson has no imported entries yet."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availableSections.map((section) => {
                const active = selected.includes(section.id);
                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      "motion-card rounded-bento border p-4 text-left transition-[background-color,border-color,box-shadow,transform]",
                      active
                        ? "border-accent/50 bg-accent/10 shadow-glow"
                        : "border-border-subtle bg-surface-1 hover:-translate-y-1 hover:border-border-strong hover:bg-surface-2",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Badge tone={section.tone} uppercase>
                        {section.label}
                      </Badge>
                      <span className="font-mono text-sm text-muted">
                        {sectionCounts[section.id]}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{section.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </BentoCard>
      ) : null}

      {grammarLessons.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {grammarLessons.map((lesson) => (
            <Link
              key={lesson.id}
              to="/student/profile/$studentId/session/$lessonId"
              params={{ studentId: String(studentIdNum), lessonId: String(lesson.id) }}
              className="motion-card group rounded-bento border border-focus/30 bg-focus/10 p-5 shadow-card transition hover:-translate-y-1 hover:border-focus/50 hover:shadow-lift"
            >
              <div className="flex items-center justify-between gap-3">
                <Badge tone="focus" uppercase>
                  Grammar
                </Badge>
                <LessonIcon className="h-8 w-8 text-focus" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">{lesson.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Review the rule overview, then complete the interactive practice set.
              </p>
              <span className="mt-4 inline-flex text-xs font-semibold text-focus group-hover:text-app">
                Start grammar
              </span>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
