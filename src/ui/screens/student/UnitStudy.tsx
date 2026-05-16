import type { DictionaryLearningItemView } from "@/data/dictionaryLearning";
import type { Lesson, Unit } from "@/data/types";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { LessonIcon } from "@/ui/components/LearningIcons";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import type { VocabEntryFull } from "../../../../electron/db/repositories/vocab";

export function StudentUnitStudy() {
  const { studentId, unitId } = useParams({ from: "/student/profile/$studentId/unit/$unitId" });
  const studentIdNum = Number(studentId);
  const unitIdNum = Number(unitId);
  const navigate = useNavigate();

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

  const prepareQ = useQuery({
    queryKey: vocabLesson
      ? queryKeys.dictionaryLearning.lessonPrepare(studentIdNum, vocabLesson.id)
      : ["dictionaryLearning", "lessonPrepare", "none"],
    queryFn: () =>
      api.dictionaryLearning.prepareUnitLesson({
        studentId: studentIdNum,
        lessonId: vocabLesson?.id ?? 0,
      }),
    enabled:
      Number.isFinite(studentIdNum) &&
      studentIdNum > 0 &&
      Boolean(vocabLesson) &&
      Number.isFinite(vocabLesson?.id),
  });

  const summaryQ = useQuery({
    queryKey: vocabLesson
      ? queryKeys.dictionaryLearning.lessonSummary(studentIdNum, vocabLesson.id)
      : ["dictionaryLearning", "lessonSummary", "none"],
    queryFn: () =>
      api.dictionaryLearning.lessonSummary({
        studentId: studentIdNum,
        lessonId: vocabLesson?.id ?? 0,
      }),
    enabled: Number.isFinite(studentIdNum) && studentIdNum > 0 && Boolean(vocabLesson),
  });

  const entriesQ = useQuery({
    queryKey: vocabLesson ? queryKeys.vocab.full(vocabLesson.id) : ["vocab", "full", "none"],
    queryFn: () => api.vocab.listFullByLesson({ lessonId: vocabLesson?.id ?? 0 }),
    enabled: Boolean(vocabLesson),
  });

  const learningItemsQ = useQuery({
    queryKey: vocabLesson
      ? queryKeys.dictionaryLearning.lessonItems(studentIdNum, vocabLesson.id)
      : ["dictionaryLearning", "lessonItems", "none"],
    queryFn: () =>
      api.dictionaryLearning.lessonItems({
        studentId: studentIdNum,
        lessonId: vocabLesson?.id ?? 0,
      }),
    enabled: prepareQ.isSuccess && Number.isFinite(studentIdNum) && studentIdNum > 0,
  });

  const startVocab = () => {
    if (!vocabLesson) return;
    void navigate({
      to: "/student/profile/$studentId/session/$lessonId",
      params: { studentId: String(studentIdNum), lessonId: String(vocabLesson.id) },
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
    return <p className="px-6 py-10 text-sm text-muted">Loading unit...</p>;
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

      <UnitHeader unit={unit} />

      {lessons.length === 0 ? (
        <EmptyState
          title="No lessons in this unit"
          body="Ask your tutor to import content first."
        />
      ) : null}

      {vocabLesson ? (
        <VocabularyTrack
          lesson={vocabLesson}
          entries={entriesQ.data ?? []}
          items={learningItemsQ.data ?? []}
          loading={entriesQ.isLoading || prepareQ.isLoading || learningItemsQ.isLoading}
          summary={
            summaryQ.data ?? {
              total: entriesQ.data?.length ?? 0,
              due: 0,
              new: entriesQ.data?.length ?? 0,
              learning: 0,
              shortTerm: 0,
              longTerm: 0,
              averageScore: 0,
            }
          }
          onStart={startVocab}
        />
      ) : null}

      {grammarLessons.length > 0 ? (
        <GrammarLessonList lessons={grammarLessons} studentId={studentIdNum} />
      ) : null}
    </div>
  );
}

function UnitHeader({ unit }: { unit: Unit | null | undefined }) {
  return (
    <BentoCard tone="focus" className="grid gap-5 p-6 lg:grid-cols-[1.2fr_auto] lg:items-center">
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
      <LessonIcon className="h-12 w-12 text-focus" />
    </BentoCard>
  );
}

function VocabularyTrack({
  lesson,
  entries,
  items,
  loading,
  summary,
  onStart,
}: {
  lesson: Lesson;
  entries: VocabEntryFull[];
  items: DictionaryLearningItemView[];
  loading: boolean;
  summary: {
    total: number;
    due: number;
    new?: number;
    learning: number;
    shortTerm: number;
    longTerm: number;
    averageScore: number;
  };
  onStart: () => void;
}) {
  const newCount = summary.new ?? 0;
  const reviewCount = summary.due + newCount;
  const completedCount = Math.max(summary.total - reviewCount, 0);
  return (
    <BentoCard className="flex flex-col gap-5 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone={reviewCount > 0 ? "warning" : "success"} uppercase>
            Vocabulary SRS
          </Badge>
          <h2 className="mt-2 text-2xl font-semibold">{lesson.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Unit words now use the same flashcard, choice, cloze, typing, and retention cycle as
            dictionary learning.
          </p>
        </div>
        <Button onClick={onStart} disabled={entries.length === 0 || loading}>
          Start unit review
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-5">
        <Metric label="Words" value={summary.total} />
        <Metric label="Due" value={summary.due} tone={summary.due > 0 ? "warning" : "success"} />
        <Metric label="New" value={newCount} />
        <Metric label="Short" value={summary.shortTerm} />
        <Metric label="Long" value={summary.longTerm} tone="success" />
      </section>

      <ProgressMeter
        value={completedCount}
        max={summary.total}
        label={`${lesson.title} SRS progress`}
        tone={reviewCount > 0 ? "warning" : "success"}
      />

      {loading ? (
        <p className="text-sm text-muted">Preparing dictionary enrichment...</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No vocabulary cards"
          body="This vocabulary lesson has no imported entries yet."
        />
      ) : (
        <VocabularyWordList entries={entries} items={items} />
      )}
    </BentoCard>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "success";
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/65 px-3 py-3">
      <dt className="text-[10px] font-semibold uppercase text-muted-2">{label}</dt>
      <dd
        className={
          tone === "warning"
            ? "mt-1 font-mono text-2xl text-warning"
            : "mt-1 font-mono text-2xl text-app"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function VocabularyWordList({
  entries,
  items,
}: {
  entries: VocabEntryFull[];
  items: DictionaryLearningItemView[];
}) {
  const itemByKey = new Map(
    items.map((item) => [unitVocabDictionaryKey(item.dictionaryKey), item]),
  );
  return (
    <ul className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
      {entries.map((entry) => {
        const item = itemByKey.get(String(entry.id));
        const definitionVi = entry.senses.find((sense) => sense.definitionVi)?.definitionVi;
        const definitionEn =
          item?.definitionEn ?? entry.senses.find((sense) => sense.definitionEn)?.definitionEn;
        return (
          <li
            key={entry.id}
            className="rounded-bento border border-border-subtle bg-surface-0/65 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item ? statusTone(item.status) : "muted"} uppercase>
                {item ? statusLabel(item.status) : "New"}
              </Badge>
              <Badge tone="muted" uppercase>
                {entry.pos}
              </Badge>
              {entry.cefrLevel ? (
                <Badge tone="xp" uppercase>
                  {entry.cefrLevel}
                </Badge>
              ) : null}
            </div>
            <h3 className="mt-3 truncate text-xl font-semibold">{entry.headword}</h3>
            {definitionVi ? (
              <p className="mt-2 text-sm leading-6 text-app">{definitionVi}</p>
            ) : null}
            {definitionEn ? (
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{definitionEn}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function GrammarLessonList({ lessons, studentId }: { lessons: Lesson[]; studentId: number }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {lessons.map((lesson) => (
        <Link
          key={lesson.id}
          to="/student/profile/$studentId/session/$lessonId"
          params={{ studentId: String(studentId), lessonId: String(lesson.id) }}
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
  );
}

function unitVocabDictionaryKey(dictionaryKey: string): string {
  return dictionaryKey.replace(/^unit:vocab:/, "");
}

function statusLabel(status: DictionaryLearningItemView["status"]): string {
  if (status === "short_term") return "Short-term";
  if (status === "long_term") return "Long-term";
  return "Learning";
}

function statusTone(status: DictionaryLearningItemView["status"]): "focus" | "xp" | "success" {
  if (status === "short_term") return "xp";
  if (status === "long_term") return "success";
  return "focus";
}
