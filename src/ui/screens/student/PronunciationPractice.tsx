import type { VocabEntry } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { EmptyState } from "@/ui/components/EmptyState";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { VocabularyPronunciation } from "@/ui/components/VocabularyPronunciation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MicButton } from "./pronunciation/MicButton";
import { MicrophonePermissionNotice } from "./pronunciation/MicrophonePermissionNotice";
import { PhonemeRail, PhraseRail } from "./pronunciation/PhraseRail";
import { usePronunciationRecorder } from "./pronunciation/usePronunciationRecorder";

type LabMode = "words" | "phrases";

type StudyTargetRow = Awaited<ReturnType<typeof api.progress.studyTargets>>["learning"][number];

type LabTargetEntry = Pick<
  VocabEntry,
  "id" | "lessonId" | "headword" | "pos" | "ipa" | "cefrLevel" | "audioRef"
> & { state?: StudyTargetRow["state"] };

interface LabTargetSection {
  kind: "learning" | "long_term" | "assigned";
  label: string;
  entries: LabTargetEntry[];
}

function rowToEntry(row: StudyTargetRow): LabTargetEntry {
  return {
    id: row.entryId,
    lessonId: row.lessonId,
    headword: row.headword,
    pos: row.pos as LabTargetEntry["pos"],
    ipa: row.ipa,
    cefrLevel: row.cefrLevel as LabTargetEntry["cefrLevel"],
    audioRef: row.audioRef,
    state: row.state,
  };
}

export function StudentPronunciationPractice() {
  const { studentId } = useParams({ from: "/student/profile/$studentId/pronunciation" });
  const id = Number(studentId);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [mode, setMode] = useState<LabMode>("words");
  const [phraseText, setPhraseText] = useState("");
  const [warmupActive, setWarmupActive] = useState(false);
  const warmupFiredFor = useRef<string | null>(null);
  const recorder = usePronunciationRecorder();

  const statusQ = useQuery({
    queryKey: queryKeys.pronunciation.status(),
    queryFn: () => api.pronunciation.status(),
  });

  // Preload the CAPT model in the utility process as soon as the screen
  // mounts and the runtime reports availability. Avoids the first-click
  // freeze on the Check button: the 360 MB ONNX session is paged into
  // the worker while the student is still picking a target.
  useEffect(() => {
    if (!statusQ.data?.available) return;
    const key = `${statusQ.data.modelId ?? "none"}:${statusQ.data.executionProvider}`;
    if (warmupFiredFor.current === key) return;
    warmupFiredFor.current = key;
    setWarmupActive(true);
    void api.pronunciation.warmup().finally(() => setWarmupActive(false));
  }, [statusQ.data?.available, statusQ.data?.modelId, statusQ.data?.executionProvider]);
  const booksQ = useQuery({
    queryKey: queryKeys.students.assignedBooks(id),
    queryFn: () => api.students.listAssignedBooks({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });
  const assignedEntriesQ = useQuery({
    queryKey: [
      "pronunciation",
      "assignedTargets",
      id,
      booksQ.data?.map((book) => book.id).join(",") ?? "",
    ],
    queryFn: async () => {
      const books = booksQ.data ?? [];
      const units = (
        await Promise.all(
          books.map((book) => api.students.listAssignedUnits({ studentId: id, bookId: book.id })),
        )
      ).flat();
      const lessons = (
        await Promise.all(
          units.map((unit) => api.curriculum.listLessonsByUnit({ unitId: unit.id })),
        )
      )
        .flat()
        .filter((lesson) => lesson.kind === "vocabulary");
      const entries = (
        await Promise.all(lessons.map((lesson) => api.vocab.listByLesson({ lessonId: lesson.id })))
      ).flat();
      return entries.slice(0, 60);
    },
    enabled: Number.isFinite(id) && id > 0 && Boolean(booksQ.data),
  });

  const studyTargetsQ = useQuery({
    queryKey: queryKeys.progress.studyTargets(id),
    queryFn: () => api.progress.studyTargets({ studentId: id }),
    enabled: Number.isFinite(id) && id > 0,
  });

  // Prefer student-progress-driven targets: words actively in the
  // learning / short-term track, plus a small long-term sample for
  // spot checks. Fall back to the broader assigned-units list when
  // the student hasn't accumulated progress yet.
  const labTargets = useMemo<LabTargetSection[]>(() => {
    const sections: LabTargetSection[] = [];
    if (studyTargetsQ.data) {
      const learning = studyTargetsQ.data.learning.map(rowToEntry);
      const longTerm = studyTargetsQ.data.longTermSample.map(rowToEntry);
      if (learning.length > 0)
        sections.push({ kind: "learning", label: "Currently learning", entries: learning });
      if (longTerm.length > 0)
        sections.push({ kind: "long_term", label: "Spot checks", entries: longTerm });
    }
    if (sections.length === 0 && assignedEntriesQ.data) {
      sections.push({
        kind: "assigned",
        label: "Assigned vocabulary",
        entries: assignedEntriesQ.data,
      });
    }
    return sections;
  }, [studyTargetsQ.data, assignedEntriesQ.data]);

  const entries = useMemo(() => labTargets.flatMap((section) => section.entries), [labTargets]);
  const entriesIsLoading =
    studyTargetsQ.isLoading || (entries.length === 0 && assignedEntriesQ.isLoading);
  const selected = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;

  // Some entries (phrasal verbs, idioms) ship without an authored IPA in
  // the dictionary YAML. Compose one from CMUdict in a single batched IPC
  // so the lab can render a real IPA string instead of "IPA unavailable".
  const composeIpaTexts = useMemo(() => {
    const needed = entries.filter((entry) => !entry.ipa).map((entry) => entry.headword);
    return Array.from(new Set(needed));
  }, [entries]);
  const composeIpaQ = useQuery({
    queryKey: queryKeys.pronunciation.composeIpa(composeIpaTexts),
    queryFn: () => api.pronunciation.composeIpa({ texts: composeIpaTexts }),
    enabled: composeIpaTexts.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const composedIpa = composeIpaQ.data ?? {};
  const ipaFor = (entry: LabTargetEntry | null): string | null =>
    entry?.ipa ?? composedIpa[entry?.headword ?? ""] ?? null;

  const examplesQ = useQuery({
    queryKey: selected
      ? queryKeys.vocab.examplesForHeadword(selected.headword)
      : ["vocab", "examplesForHeadword", "none"],
    queryFn: () => api.vocab.examplesForHeadword({ headword: selected?.headword ?? "" }),
    enabled: Boolean(selected) && mode === "phrases",
  });

  const phraseTrimmed = phraseText.trim();
  const phraseReady = phraseTrimmed.length > 0;
  const previewText = mode === "phrases" ? phraseTrimmed : (selected?.headword ?? "");
  const previewIpa = mode === "phrases" ? null : (selected?.ipa ?? null);

  const previewQ = useQuery({
    queryKey: queryKeys.pronunciation.preview(previewText, previewIpa ?? ""),
    queryFn: () => api.pronunciation.preview({ text: previewText, ipa: previewIpa }),
    enabled: previewText.length > 0,
  });
  const preview = previewQ.data;

  const startSession = useMutation({
    mutationFn: async (audio: { audioPcm: Float32Array; sampleRate: number }) => {
      let targetText: string;
      let ipa: string | null;
      if (mode === "phrases") {
        if (!phraseReady) throw new Error("Type a phrase first.");
        targetText = phraseTrimmed;
        ipa = null;
      } else {
        if (!selected) throw new Error("Select a word first.");
        targetText = selected.headword;
        ipa = selected.ipa;
      }
      const session = await api.progress.startSession({ studentId: id, mode: "pronunciation" });
      const result = await api.pronunciation.assess({
        studentId: id,
        sessionId: session.id,
        targetText,
        ipa,
        audioPcm: audio.audioPcm,
        sampleRate: audio.sampleRate,
      });
      await api.progress.endSession({
        sessionId: session.id,
        summary: {
          kind: "pronunciation",
          targetText,
          modelReady: result.status.available,
          score: result.ok ? result.assessment.overallScore : null,
          reason: result.ok ? null : result.reason,
        },
      });
      return result;
    },
  });

  const handleMic = async () => {
    if (recorder.state === "recording") {
      const recorded = await recorder.stop();
      if (recorded) {
        startSession.mutate({ audioPcm: recorded.audioPcm, sampleRate: recorded.sampleRate });
      }
      return;
    }
    await recorder.start();
  };

  const micState: "idle" | "recording" | "ready" | "assessing" = startSession.isPending
    ? "assessing"
    : recorder.state === "recording"
      ? "recording"
      : recorder.recording
        ? "ready"
        : "idle";

  // Reset phrase + result when the selected entry or mode changes so stale
  // scores never leak across targets. `startSession.reset` is referentially
  // stable per react-query, so we exclude it from the dep list to keep the
  // effect from re-firing every render.
  const resetSession = startSession.reset;
  // biome-ignore lint/correctness/useExhaustiveDependencies: selected?.id is the trigger we want to react to even though it's not read in the body.
  useEffect(() => {
    resetSession();
    if (mode === "phrases") setPhraseText("");
  }, [mode, selected?.id, resetSession]);

  const audioFallback = useMemo(
    () =>
      selected?.audioRef
        ? [{ ref: selected.audioRef, label: "Audio", accent: "other" as const }]
        : [],
    [selected?.audioRef],
  );

  if (!Number.isFinite(id) || id <= 0) {
    return <p className="px-6 py-10 text-sm text-danger">Invalid student.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-title font-semibold">Pronunciation</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Listen, record, then inspect the sounds that need another try.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ScoringStatus
            loading={statusQ.isLoading}
            available={statusQ.data?.available ?? false}
            warmingUp={warmupActive}
          />
          {!entriesIsLoading && !booksQ.isLoading && entries.length > 0 ? (
            <ModeTabs mode={mode} onChange={setMode} />
          ) : null}
        </div>
      </header>

      {entriesIsLoading || booksQ.isLoading ? (
        <section className="object-surface learning-trace px-5 py-10" aria-live="polite">
          <p className="text-sm text-muted">Loading practice targets…</p>
        </section>
      ) : entries.length === 0 ? (
        <section className="object-surface learning-trace">
          <EmptyState
            title="No vocabulary targets"
            body="Complete a vocabulary practice first and your current words will appear here."
          />
        </section>
      ) : (
        <section
          className="object-surface learning-trace overflow-hidden lg:h-[calc(100dvh-9.5rem)] lg:min-h-[34rem]"
          aria-label="Pronunciation practice workspace"
        >
          <div className="grid h-full min-h-0 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-b border-border-subtle bg-surface-2/[0.35] lg:border-b-0 lg:border-r">
              <div className="flex min-h-12 items-center justify-between border-b border-border-subtle px-4">
                <h2 className="font-semibold">Practice targets</h2>
                <span className="tabular-figure text-xs text-muted">{entries.length}</span>
              </div>
              <nav
                aria-label="Pronunciation targets"
                className="max-h-56 min-h-0 overflow-y-auto py-2 lg:max-h-none lg:flex-1"
              >
                {labTargets.map((section) => (
                  <section key={section.kind} aria-labelledby={`target-section-${section.kind}`}>
                    <div className="flex items-center justify-between px-4 pb-1 pt-2">
                      <h3 id={`target-section-${section.kind}`} className="text-xs text-muted">
                        {section.label}
                      </h3>
                      <span className="tabular-figure text-xs text-muted-2">
                        {section.entries.length}
                      </span>
                    </div>
                    <ul>
                      {section.entries.map((entry) => {
                        const isSelected = selected?.id === entry.id;
                        return (
                          <li key={entry.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedEntryId(entry.id)}
                              aria-current={isSelected ? "true" : undefined}
                              className={cn(
                                "ui-focus-ring min-h-11 w-full border-l-2 px-4 py-2 text-left transition-colors duration-fast",
                                isSelected
                                  ? "border-accent bg-surface-1 text-app"
                                  : "border-transparent text-muted hover:bg-surface-2 hover:text-app",
                              )}
                            >
                              <span className="ui-lexical block truncate text-[15px] font-semibold">
                                {entry.headword}
                              </span>
                              <span className="block truncate text-xs text-muted-2">
                                {entry.ipa ?? composedIpa[entry.headword] ?? entry.pos}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </nav>
            </aside>

            <div
              id="pronunciation-practice-panel"
              role="tabpanel"
              aria-labelledby={`pronunciation-mode-${mode}`}
              className="min-h-0 overflow-y-auto"
            >
              {selected ? (
                mode === "words" ? (
                  <TargetPanel
                    entry={selected}
                    displayIpa={ipaFor(selected)}
                    audioFallback={audioFallback}
                    preview={preview ?? null}
                    recorder={recorder}
                    micState={micState}
                    onMic={handleMic}
                    result={startSession.data ?? null}
                    error={startSession.error}
                  />
                ) : (
                  <PhraseTargetPanel
                    entry={selected}
                    displayIpa={ipaFor(selected)}
                    phraseText={phraseText}
                    onPhraseChange={setPhraseText}
                    examples={examplesQ.data ?? []}
                    examplesLoading={examplesQ.isLoading}
                    preview={preview ?? null}
                    recorder={recorder}
                    micState={micState}
                    onMic={handleMic}
                    result={startSession.data ?? null}
                    error={startSession.error}
                    phraseReady={phraseReady}
                  />
                )
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

type PronunciationPreviewView = Awaited<ReturnType<typeof api.pronunciation.preview>>;
type PronunciationAssessView = Awaited<ReturnType<typeof api.pronunciation.assess>>;
type PronunciationRecorderView = ReturnType<typeof usePronunciationRecorder>;
type PronunciationAssessmentView = Extract<PronunciationAssessView, { ok: true }>["assessment"];

function ScoringStatus({
  loading,
  available,
  warmingUp,
}: {
  loading: boolean;
  available: boolean;
  warmingUp: boolean;
}) {
  const pending = loading || warmingUp;
  const label = loading
    ? "Checking scoring…"
    : warmingUp
      ? "Preparing scoring…"
      : available
        ? "Scoring ready"
        : "Scoring unavailable";

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        pending ? "text-muted" : available ? "text-success" : "text-warning",
      )}
    >
      <AppGlyph
        name={pending ? "spinner" : available ? "check" : "warning"}
        size="sm"
        className={pending ? "animate-spin motion-reduce:animate-none" : undefined}
      />
      {label}
    </span>
  );
}

function TargetPanel({
  entry,
  displayIpa,
  audioFallback,
  preview,
  recorder,
  result,
  error,
  micState,
  onMic,
}: {
  entry: LabTargetEntry;
  displayIpa: string | null;
  audioFallback: Array<{ ref: string; label: string; accent: "uk" | "us" | "other" }>;
  preview: PronunciationPreviewView | null;
  recorder: PronunciationRecorderView;
  result: PronunciationAssessView | null;
  error: Error | null;
  micState: "idle" | "recording" | "ready" | "assessing";
  onMic: () => void;
}) {
  const assessment = result?.ok ? result.assessment : null;

  return (
    <article className="flex min-h-full flex-col">
      <section className="px-5 py-5 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center">
          <header className="min-w-0">
            <p className="text-xs text-muted">
              {partOfSpeechLabel(entry.pos)}
              {entry.cefrLevel ? ` · ${entry.cefrLevel}` : ""}
            </p>
            <h2 className="ui-lexical mt-1 text-4xl font-semibold leading-tight">
              {entry.headword}
            </h2>
            <p className="mt-1 font-mono text-sm text-muted">
              {displayIpa ?? "Pronunciation guide unavailable"}
            </p>
            <VocabularyPronunciation
              headword={entry.headword}
              fallbackRefs={audioFallback}
              preferredAccent="uk"
              size="md"
              className="mt-3"
            />
          </header>

          <MicButton
            state={micState}
            durationMs={recorder.durationMs}
            maxDurationMs={recorder.maxDurationMs}
            onClick={onMic}
          />
        </div>

        <PracticeNotices recorder={recorder} result={result} error={error} />
      </section>

      {assessment ? (
        <AssessmentEvidence assessment={assessment} />
      ) : preview ? (
        <SoundGuide assessment={preview} />
      ) : (
        <p
          className="border-t border-border-subtle px-6 py-5 text-sm text-muted"
          aria-live="polite"
        >
          Preparing the sound guide…
        </p>
      )}
    </article>
  );
}

function AttemptOutcome({
  assessment,
}: {
  assessment: PronunciationAssessmentView;
}) {
  const passed = !assessment.retryRequired;

  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 px-5 py-4 sm:px-6",
        passed ? "bg-success/[0.08]" : "bg-warning/[0.08]",
      )}
    >
      <AppGlyph
        name={passed ? "check" : "warning"}
        size="lg"
        className={passed ? "text-success" : "text-warning"}
      />
      <div className="min-w-0">
        <p className={cn("font-semibold", passed ? "text-success" : "text-warning")}>
          {passed ? "Target met" : "Try once more"}
        </p>
        <p className="mt-0.5 text-sm leading-5 text-muted">
          {Math.round(assessment.overallScore)}/100 · target {assessment.passingScore}+
          {assessment.guardrails[0] ? ` · ${assessment.guardrails[0].message}` : ""}
        </p>
      </div>
    </div>
  );
}

function PracticeNotices({
  recorder,
  result,
  error,
}: {
  recorder: PronunciationRecorderView;
  result: PronunciationAssessView | null;
  error: Error | null;
}) {
  if (recorder.error) {
    return <MicrophonePermissionNotice message={recorder.error} permission={recorder.permission} />;
  }

  if (error) {
    return (
      <p role="alert" className="mt-4 rounded-control bg-warning/10 px-4 py-3 text-sm text-warning">
        {error.message || "Could not check that attempt."}
      </p>
    );
  }

  if (result && !result.ok) {
    return (
      <p role="alert" className="mt-4 rounded-control bg-warning/10 px-4 py-3 text-sm text-warning">
        {result.reason}
      </p>
    );
  }

  return null;
}

function AssessmentEvidence({ assessment }: { assessment: PronunciationAssessmentView }) {
  return (
    <section className="border-t border-border-subtle" aria-label="Attempt feedback">
      <AttemptOutcome assessment={assessment} />
      <dl className="grid border-t border-border-subtle sm:grid-cols-3 sm:divide-x sm:divide-border-subtle">
        <ScoreCell label="Overall" value={assessment.overallScore} />
        <ScoreCell label="Phonemes" value={assessment.phonemeScore} />
        <ScoreCell
          label={(assessment.target.words?.length ?? 0) > 1 ? "Word stress" : "Stress"}
          value={assessment.stressScore ?? 0}
          muted={assessment.stressScore === null}
        />
      </dl>
      <div className="border-t border-border-subtle px-5 py-4 sm:px-6">
        {(assessment.target.words?.length ?? 0) > 1 ? (
          <PhraseRail phonemes={assessment.phonemes} target={assessment.target} />
        ) : (
          <PhonemeRail phonemes={assessment.phonemes} />
        )}
      </div>
      {assessment.feedback.length > 0 ? (
        <section className="border-t border-border-subtle px-5 py-4 sm:px-6">
          <h3 className="text-xs font-semibold text-muted-2">What to adjust</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-5 text-muted">
            {assessment.feedback.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function SoundGuide({ assessment }: { assessment: PronunciationPreviewView }) {
  return (
    <section className="border-t border-border-subtle px-5 py-4 sm:px-6" aria-label="Sound guide">
      <div className="mb-3">
        <h3 className="font-semibold">Sound guide</h3>
        <p className="mt-0.5 text-xs text-muted">
          Listen to the reference, then use this sequence while you speak.
        </p>
      </div>
      {(assessment.target.words?.length ?? 0) > 1 ? (
        <PhraseRail phonemes={assessment.phonemes} target={assessment.target} variant="guide" />
      ) : (
        <PhonemeRail phonemes={assessment.phonemes} variant="guide" />
      )}
    </section>
  );
}

function ScoreCell({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="px-5 py-3.5 sm:px-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        data-tabular
        className={cn("mt-0.5 text-2xl font-semibold", muted ? "text-muted-2" : "text-app")}
      >
        {muted ? "—" : Math.round(value)}
      </dd>
      <ProgressMeter
        value={muted ? 0 : value}
        max={100}
        label={`${label} score`}
        tone={value >= 80 ? "success" : value >= 65 ? "accent" : "warning"}
        className="mt-2"
      />
    </div>
  );
}

function partOfSpeechLabel(pos: LabTargetEntry["pos"]): string {
  return String(pos).replaceAll("_", " ");
}

function ModeTabs({ mode, onChange }: { mode: LabMode; onChange: (mode: LabMode) => void }) {
  const wordsRef = useRef<HTMLButtonElement>(null);
  const phrasesRef = useRef<HTMLButtonElement>(null);

  function moveTo(next: LabMode) {
    onChange(next);
    (next === "words" ? wordsRef : phrasesRef).current?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Pronunciation practice mode"
      className="inline-flex h-8 w-fit items-stretch border-b border-border-subtle text-xs font-medium"
    >
      <TabButton
        buttonRef={wordsRef}
        id="pronunciation-mode-words"
        active={mode === "words"}
        onClick={() => onChange("words")}
        onMove={() => moveTo("phrases")}
      >
        Words
      </TabButton>
      <TabButton
        buttonRef={phrasesRef}
        id="pronunciation-mode-phrases"
        active={mode === "phrases"}
        onClick={() => onChange("phrases")}
        onMove={() => moveTo("words")}
      >
        Phrases
      </TabButton>
    </div>
  );
}

function TabButton({
  buttonRef,
  id,
  active,
  onClick,
  onMove,
  children,
}: {
  buttonRef: React.RefObject<HTMLButtonElement>;
  id: string;
  active: boolean;
  onClick: () => void;
  onMove: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls="pronunciation-practice-panel"
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          onMove();
        }
      }}
      className={cn(
        "ui-focus-ring border-b-2 px-3 transition-colors duration-fast",
        active
          ? "border-accent text-app"
          : "border-transparent text-muted hover:border-border-strong hover:text-app",
      )}
    >
      {children}
    </button>
  );
}

interface PhraseExample {
  text: string;
  translation: string | null;
}

function PhraseTargetPanel({
  entry,
  displayIpa,
  phraseText,
  onPhraseChange,
  examples,
  examplesLoading,
  preview,
  recorder,
  result,
  error,
  micState,
  onMic,
  phraseReady,
}: {
  entry: LabTargetEntry;
  displayIpa: string | null;
  phraseText: string;
  onPhraseChange: (next: string) => void;
  examples: PhraseExample[];
  examplesLoading: boolean;
  preview: PronunciationPreviewView | null;
  recorder: PronunciationRecorderView;
  result: PronunciationAssessView | null;
  error: Error | null;
  micState: "idle" | "recording" | "ready" | "assessing";
  onMic: () => void;
  phraseReady: boolean;
}) {
  const assessment =
    result?.ok && result.assessment.target.text === phraseText.trim() ? result.assessment : null;

  return (
    <article className="flex min-h-full flex-col">
      <section className="px-5 py-5 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
          <div className="min-w-0">
            <header>
              <h2 className="ui-lexical text-3xl font-semibold leading-tight">{entry.headword}</h2>
              <p className="mt-1 text-sm text-muted">
                Use this word in a phrase, then record the complete thought.
                {displayIpa ? <span className="font-mono"> {displayIpa}</span> : null}
              </p>
            </header>

            <label className="mt-4 block text-xs font-semibold text-muted-2">
              Phrase or sentence
              <textarea
                value={phraseText}
                onChange={(event) => onPhraseChange(event.target.value)}
                maxLength={320}
                rows={2}
                placeholder="I want to ride a bike."
                className="mt-1.5 w-full resize-none rounded-control border border-border-strong bg-surface-1 px-3 py-2.5 text-sm leading-5 text-app transition-colors duration-fast focus:border-accent"
              />
            </label>
            <SuggestionRail examples={examples} loading={examplesLoading} onPick={onPhraseChange} />
          </div>

          <div>
            <MicButton
              state={micState}
              durationMs={recorder.durationMs}
              maxDurationMs={recorder.maxDurationMs}
              disabled={!phraseReady && micState === "idle"}
              disabledReason="Enter a phrase to enable recording."
              onClick={onMic}
            />
          </div>
        </div>

        <PracticeNotices recorder={recorder} result={result} error={error} />
      </section>

      {assessment ? (
        <AssessmentEvidence assessment={assessment} />
      ) : preview ? (
        <SoundGuide assessment={preview} />
      ) : phraseReady ? (
        <p
          className="border-t border-border-subtle px-6 py-5 text-sm text-muted"
          aria-live="polite"
        >
          Preparing the phrase sound guide…
        </p>
      ) : null}
    </article>
  );
}

function SuggestionRail({
  examples,
  loading,
  onPick,
}: {
  examples: PhraseExample[];
  loading: boolean;
  onPick: (text: string) => void;
}) {
  if (loading) {
    return <p className="text-xs text-muted-2">Loading example phrases…</p>;
  }
  if (examples.length === 0) {
    return <p className="mt-2 text-xs text-muted-2">No example phrases for this word yet.</p>;
  }
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-semibold text-muted-2">Example phrases</p>
      <ul className="max-h-36 divide-y divide-border-subtle overflow-y-auto rounded-control border border-border-subtle bg-surface-2/[0.35]">
        {examples.map((example) => (
          <li key={example.text}>
            <button
              type="button"
              onClick={() => onPick(example.text)}
              className="ui-focus-ring w-full px-3 py-2 text-left transition-colors duration-fast hover:bg-surface-2"
            >
              <span className="block text-sm text-app">{example.text}</span>
              {example.translation ? (
                <span className="mt-0.5 block text-xs text-muted">{example.translation}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
