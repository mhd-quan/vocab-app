import type { VocabEntry } from "@/data/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/queryClient";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { PronunciationControls } from "@/ui/components/PronunciationControls";
import { MascotIcon } from "@/ui/student/components/MascotIcon";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePronunciationRecorder } from "./pronunciation/usePronunciationRecorder";

export function StudentPronunciationPractice() {
  const { studentId } = useParams({ from: "/student/profile/$studentId/pronunciation" });
  const id = Number(studentId);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
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
  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(id),
    queryFn: () => api.students.getById({ id }),
    enabled: Number.isFinite(id) && id > 0,
  });
  const entriesQ = useQuery({
    queryKey: [
      "pronunciation",
      "studentTargets",
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

  const entries = entriesQ.data ?? [];
  const selected = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;
  const previewQ = useQuery({
    queryKey: selected
      ? queryKeys.pronunciation.preview(selected.headword, selected.ipa ?? "")
      : ["pronunciation", "preview", "none"],
    queryFn: () =>
      api.pronunciation.preview({ text: selected?.headword ?? "", ipa: selected?.ipa }),
    enabled: Boolean(selected),
  });
  const preview = previewQ.data;

  const startSession = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a word first.");
      const session = await api.progress.startSession({ studentId: id, mode: "pronunciation" });
      const result = await api.pronunciation.assess({
        studentId: id,
        sessionId: session.id,
        targetText: selected.headword,
        ipa: selected.ipa,
        audioPcm: recorder.recording?.audioPcm,
        sampleRate: recorder.recording?.sampleRate,
      });
      await api.progress.endSession({
        sessionId: session.id,
        summary: {
          kind: "pronunciation",
          targetText: selected.headword,
          modelReady: result.status.available,
          score: result.ok ? result.assessment.overallScore : null,
          reason: result.ok ? null : result.reason,
        },
      });
      return result;
    },
  });

  const audioRefs = useMemo(
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

      <BentoCard tone="sky" className="p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <MascotIcon
              mood="thinking"
              avatarSeed={studentQ.data?.avatarSeed ?? null}
              studentId={id}
              className="hidden h-24 w-24 shrink-0 sm:block"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="sky" uppercase>
                  Pronunciation
                </Badge>
                <Badge tone={statusQ.data?.available ? "success" : "warning"} uppercase>
                  {statusQ.data?.available ? statusQ.data.executionProvider : "model setup"}
                </Badge>
              </div>
              <h1 className="mt-3 text-3xl font-semibold leading-tight">Pronunciation lab</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                IPA and dictionary audio are ready. Acoustic scoring turns on automatically when the
                offline CAPT model bundle is installed.
              </p>
            </div>
          </div>
          <RuntimeCard status={statusQ.data ?? null} warmupActive={warmupActive} />
        </div>
      </BentoCard>

      {entriesQ.isLoading || booksQ.isLoading ? (
        <p className="text-sm text-muted">Loading pronunciation targets...</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No vocabulary targets"
          body="Ask your tutor to assign imported vocabulary units first."
        />
      ) : (
        <section className="grid gap-5 xl:grid-cols-[20rem_1fr]">
          <BentoCard className="p-4">
            <h2 className="text-sm font-semibold uppercase text-muted-2">Targets</h2>
            <ul className="mt-3 flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1">
              {entries.map((entry) => (
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
                      {entry.ipa ?? entry.pos}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </BentoCard>

          <BentoCard className="p-5">
            {selected ? (
              <TargetPanel
                entry={selected}
                audioRefs={audioRefs}
                preview={preview ?? null}
                recorder={recorder}
                assessing={startSession.isPending}
                result={startSession.data ?? null}
                onAssess={() => startSession.mutate()}
              />
            ) : null}
          </BentoCard>
        </section>
      )}
    </div>
  );
}

type PronunciationStatusView = Awaited<ReturnType<typeof api.pronunciation.status>>;
type PronunciationPreviewView = Awaited<ReturnType<typeof api.pronunciation.preview>>;
type PronunciationAssessView = Awaited<ReturnType<typeof api.pronunciation.assess>>;
type PronunciationRecorderView = ReturnType<typeof usePronunciationRecorder>;

function RuntimeCard({
  status,
  warmupActive,
}: {
  status: PronunciationStatusView | null;
  warmupActive: boolean;
}) {
  return (
    <div className="rounded-bento border border-border-subtle bg-surface-0/70 p-4 text-xs">
      <p className="font-semibold uppercase text-muted-2">Runtime</p>
      <p className="mt-1 font-mono text-lg text-app">
        {status
          ? `${status.modelFamily ?? "capt"} / ${status.backend} / ${status.executionProvider}`
          : "..."}
      </p>
      <p className="mt-1 max-w-xs leading-5 text-muted">
        {warmupActive
          ? "Warming up CAPT… first attempt will start in a moment."
          : (status?.reason ?? "Offline model ready.")}
      </p>
    </div>
  );
}

function TargetPanel({
  entry,
  audioRefs,
  preview,
  recorder,
  result,
  assessing,
  onAssess,
}: {
  entry: VocabEntry;
  audioRefs: Array<{ ref: string; label: string; accent: "uk" | "us" | "other" }>;
  preview: PronunciationPreviewView | null;
  recorder: PronunciationRecorderView;
  result: PronunciationAssessView | null;
  assessing: boolean;
  onAssess: () => void;
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
          <p className="mt-1 font-mono text-sm text-muted">{entry.ipa ?? "IPA unavailable"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PronunciationControls audioRefs={audioRefs} size="md" />
          {recorder.state === "recording" ? (
            <Button variant="secondary" onClick={() => void recorder.stop()}>
              Stop {formatDuration(recorder.durationMs)}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => void recorder.start()} disabled={assessing}>
              {recorder.recording ? "Record again" : "Record"}
            </Button>
          )}
          <Button onClick={onAssess} disabled={assessing}>
            {assessing ? "Checking..." : "Check attempt"}
          </Button>
        </div>
      </header>

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
              label="Stress"
              value={assessment.stressScore ?? 0}
              muted={assessment.stressScore === null}
            />
          </section>
          <PhonemeRail phonemes={assessment.phonemes} />
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

function PhonemeRail({
  phonemes,
}: {
  phonemes: Array<{
    phoneme: string;
    score: number;
    issue: string;
    detectedPhoneme: string | null;
  }>;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/70 p-4">
      <p className="text-xs font-semibold uppercase text-muted-2">Phoneme alignment</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {phonemes.map((phoneme, index) => (
          <span
            key={`${phoneme.phoneme}-${index}`}
            className={cn(
              "inline-flex min-w-12 flex-col items-center rounded-lg border px-2 py-2 font-mono text-xs",
              phoneme.issue === "ok"
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/35 bg-warning/10 text-warning",
            )}
          >
            /{phoneme.phoneme}/
            <span className="mt-1 text-[10px] text-muted-2">
              {phoneme.detectedPhoneme && phoneme.detectedPhoneme !== phoneme.phoneme
                ? `/${phoneme.detectedPhoneme}/`
                : phoneme.score}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
