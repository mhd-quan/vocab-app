import type { VocabEntry } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { EmptyState } from "@/ui/components/EmptyState";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { VocabularyPronunciation } from "@/ui/components/VocabularyPronunciation";
import { Mascot } from "@/ui/student/mascot";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MicButton } from "./pronunciation/MicButton";
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-10">
      <Link
        to="/student/profile/$studentId"
        params={{ studentId: String(id) }}
        className="self-start text-xs font-medium text-muted hover:text-app"
      >
        Back to units
      </Link>

      <BentoCard tone="sky" className="relative overflow-hidden p-6">
        <div className="flex items-start gap-5 pr-32 sm:pr-44">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sky" uppercase>
                Pronunciation
              </Badge>
              <Badge tone={statusQ.data?.available ? "success" : "warning"} uppercase>
                {warmupActive
                  ? "Warming up"
                  : statusQ.data?.available
                    ? "Model ready"
                    : "Model setup"}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">Pronunciation lab</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              IPA and dictionary audio are ready. Acoustic scoring turns on automatically when the
              offline CAPT model bundle is installed.
            </p>
          </div>
        </div>
        <Mascot
          variant="focus"
          studentId={id}
          className="pointer-events-none absolute -bottom-4 right-2 hidden h-40 w-40 select-none sm:block lg:h-48 lg:w-48"
        />
      </BentoCard>

      {entriesIsLoading || booksQ.isLoading ? (
        <p className="text-sm text-muted">Loading pronunciation targets...</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No vocabulary targets"
          body="Practice a vocab unit first so the lab can surface what you're learning."
        />
      ) : (
        <>
          <ModeTabs mode={mode} onChange={setMode} />
          <section className="grid gap-5 xl:grid-cols-[20rem_1fr]">
            <BentoCard className="p-4">
              <h2 className="text-sm font-semibold uppercase text-muted-2">Targets</h2>
              <div
                className={cn(
                  "mt-3 flex max-h-[34rem] flex-col gap-4 overflow-y-auto pr-1 pb-6",
                  "[mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]",
                  "[-webkit-mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]",
                )}
              >
                {labTargets.map((section) => (
                  <div key={section.kind} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-2">
                        {section.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted-2">
                        {section.entries.length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {section.entries.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedEntryId(entry.id)}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2 text-left transition",
                              selected?.id === entry.id
                                ? "border-sky/45 bg-sky/10"
                                : "border-border-subtle bg-surface-0/70 hover:border-border-strong",
                            )}
                          >
                            <span className="block truncate text-sm font-semibold text-app">
                              {entry.headword}
                            </span>
                            <span className="font-mono text-[11px] text-muted-2">
                              {entry.ipa ?? composedIpa[entry.headword] ?? entry.pos}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </BentoCard>

            <BentoCard className="p-5">
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
                    phraseReady={phraseReady}
                  />
                )
              ) : null}
            </BentoCard>
          </section>
        </>
      )}
    </div>
  );
}

type PronunciationPreviewView = Awaited<ReturnType<typeof api.pronunciation.preview>>;
type PronunciationAssessView = Awaited<ReturnType<typeof api.pronunciation.assess>>;
type PronunciationRecorderView = ReturnType<typeof usePronunciationRecorder>;

function TargetPanel({
  entry,
  displayIpa,
  audioFallback,
  preview,
  recorder,
  result,
  micState,
  onMic,
}: {
  entry: LabTargetEntry;
  displayIpa: string | null;
  audioFallback: Array<{ ref: string; label: string; accent: "uk" | "us" | "other" }>;
  preview: PronunciationPreviewView | null;
  recorder: PronunciationRecorderView;
  result: PronunciationAssessView | null;
  micState: "idle" | "recording" | "ready" | "assessing";
  onMic: () => void;
}) {
  const assessment = result?.ok ? result.assessment : preview;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sky" uppercase>
              {entry.pos}
            </Badge>
            {entry.cefrLevel ? (
              <Badge tone="xp" uppercase>
                {entry.cefrLevel}
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">{entry.headword}</h2>
          <p className="mt-1 font-mono text-sm text-muted">{displayIpa ?? "IPA unavailable"}</p>
          <div className="mt-3">
            <VocabularyPronunciation
              headword={entry.headword}
              fallbackRefs={audioFallback}
              preferredAccent="uk"
              size="md"
            />
          </div>
        </div>
      </header>

      <div className="flex justify-center">
        <MicButton
          state={micState}
          durationMs={recorder.durationMs}
          maxDurationMs={recorder.maxDurationMs}
          onClick={onMic}
        />
      </div>

      <RecorderStatus recorder={recorder} />

      {result && !result.ok ? (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          {result.reason}
        </div>
      ) : null}

      {assessment ? (
        <>
          {result?.ok ? <AttemptOutcome assessment={assessment} /> : null}
          <section className="grid gap-3 sm:grid-cols-3">
            <ScoreCard label="Overall" value={assessment.overallScore} />
            <ScoreCard label="Phonemes" value={assessment.phonemeScore} />
            <ScoreCard
              label={(assessment.target.words?.length ?? 0) > 1 ? "Stress · word-level" : "Stress"}
              value={assessment.stressScore ?? 0}
              muted={assessment.stressScore === null}
            />
          </section>
          {(assessment.target.words?.length ?? 0) > 1 ? (
            <PhraseRail phonemes={assessment.phonemes} target={assessment.target} />
          ) : (
            <PhonemeRail phonemes={assessment.phonemes} />
          )}
          <div className="rounded-xl border border-border-subtle bg-surface-0/70 p-4">
            <p className="text-xs font-semibold uppercase text-muted-2">Feedback</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm leading-6 text-muted">
              {assessment.feedback.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
      {/* MicButton reflects assessing via micState */}
    </div>
  );
}

function AttemptOutcome({
  assessment,
}: {
  assessment: Extract<PronunciationAssessView, { ok: true }>["assessment"];
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        assessment.retryRequired
          ? "border-warning/35 bg-warning/10 text-warning"
          : "border-success/30 bg-success/10 text-success",
      )}
    >
      <p className="font-semibold">
        {assessment.retryRequired ? "Retry this word" : "Pronunciation target passed"}
      </p>
      <p className="mt-1 leading-6">
        Score {assessment.overallScore}/{assessment.passingScore}
        {assessment.guardrails.length > 0 ? ` · ${assessment.guardrails[0]?.message}` : ""}
      </p>
    </div>
  );
}

function RecorderStatus({ recorder }: { recorder: PronunciationRecorderView }) {
  if (recorder.state === "recording") {
    return (
      <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
        Recording microphone input... {formatDuration(recorder.durationMs)} /{" "}
        {formatDuration(recorder.maxDurationMs)}
      </div>
    );
  }

  if (recorder.recording) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        Recorded {formatDuration(recorder.recording.durationMs)} at {recorder.recording.sampleRate}
        Hz. The next check will use this attempt.
      </div>
    );
  }

  if (recorder.error) {
    return (
      <div className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
        {recorder.error}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/70 px-4 py-3 text-sm text-muted">
      Record a short attempt before checking. Without audio, this screen can only show the alignment
      preview and model readiness.
    </div>
  );
}

function formatDuration(ms: number): string {
  return `${Math.max(0, Math.round(ms / 100) / 10).toFixed(1)}s`;
}

function ScoreCard({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/70 p-4">
      <p className="text-xs font-semibold uppercase text-muted-2">{label}</p>
      <p className={cn("mt-1 font-mono text-3xl", muted ? "text-muted-2" : "text-app")}>
        {muted ? "—" : value}
      </p>
      <ProgressMeter
        value={muted ? 0 : value}
        max={100}
        label={`${label} score`}
        tone={value >= 80 ? "success" : value >= 65 ? "accent" : "warning"}
        className="mt-3"
      />
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: LabMode; onChange: (mode: LabMode) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Pronunciation lab mode"
      className="inline-flex w-fit rounded-full border border-border-subtle bg-surface-1 p-1 text-xs font-semibold"
    >
      <TabButton active={mode === "words"} onClick={() => onChange("words")}>
        Words
      </TabButton>
      <TabButton active={mode === "phrases"} onClick={() => onChange("phrases")}>
        Phrases
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 transition",
        active ? "bg-sky/15 text-sky" : "text-muted hover:text-app",
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
  micState: "idle" | "recording" | "ready" | "assessing";
  onMic: () => void;
  phraseReady: boolean;
}) {
  const assessment = result?.ok ? result.assessment : preview;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="lime" uppercase>
              Phrase
            </Badge>
            <Badge tone="muted" uppercase>
              from {entry.headword}
            </Badge>
            {displayIpa ? <span className="font-mono text-xs text-muted">{displayIpa}</span> : null}
          </div>
          <p className="mt-2 text-xs text-muted">
            Type or pick a phrase, then tap the mic. Stop the recording to auto-check. Stress is
            reported at the word level only.
          </p>
        </div>
        <label className="flex flex-col gap-2 text-xs text-muted">
          <span className="font-semibold uppercase text-muted-2">Phrase or sentence</span>
          <textarea
            value={phraseText}
            onChange={(event) => onPhraseChange(event.target.value)}
            maxLength={320}
            rows={2}
            placeholder="e.g. I want to ride a bike"
            className="resize-none rounded-xl border border-border-subtle bg-surface-0/70 px-3 py-2 font-mono text-sm text-app focus:border-sky/50 focus:outline-none"
          />
        </label>
        <SuggestionRail examples={examples} loading={examplesLoading} onPick={onPhraseChange} />
      </header>

      <div className="flex justify-center">
        <MicButton
          state={micState}
          durationMs={recorder.durationMs}
          maxDurationMs={recorder.maxDurationMs}
          disabled={!phraseReady && micState === "idle"}
          onClick={onMic}
        />
      </div>

      <RecorderStatus recorder={recorder} />

      {result && !result.ok ? (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          {result.reason}
        </div>
      ) : null}

      {assessment ? (
        <>
          {result?.ok ? <AttemptOutcome assessment={assessment} /> : null}
          <section className="grid gap-3 sm:grid-cols-3">
            <ScoreCard label="Overall" value={assessment.overallScore} />
            <ScoreCard label="Phonemes" value={assessment.phonemeScore} />
            <ScoreCard
              label={(assessment.target.words?.length ?? 0) > 1 ? "Stress · word-level" : "Stress"}
              value={assessment.stressScore ?? 0}
              muted={assessment.stressScore === null}
            />
          </section>
          {(assessment.target.words?.length ?? 0) > 1 ? (
            <PhraseRail phonemes={assessment.phonemes} target={assessment.target} />
          ) : (
            <PhonemeRail phonemes={assessment.phonemes} />
          )}
          <div className="rounded-xl border border-border-subtle bg-surface-0/70 p-4">
            <p className="text-xs font-semibold uppercase text-muted-2">Feedback</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm leading-6 text-muted">
              {assessment.feedback.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
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
    return <p className="text-xs text-muted-2">No example phrases for this word yet.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase text-muted-2">Suggestions</span>
      <div className="flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example.text}
            type="button"
            onClick={() => onPick(example.text)}
            title={example.translation ?? undefined}
            className="rounded-full border border-sky/30 bg-sky/10 px-3 py-1 text-xs font-medium text-sky hover:bg-sky/15"
          >
            {example.text}
          </button>
        ))}
      </div>
    </div>
  );
}
