/**
 * Pronunciation card — speak the headword, CAPT scores it.
 *
 * Lifecycle:
 *   - Idle → record → assess (IPC `pronunciation.assess`) → ready.
 *   - When the engine reports `outcome.needsRetry`, the parent re-mounts
 *     the card (key bump in SessionPlayer) so a fresh attempt is possible.
 *   - Each call to `onAnswer` packs the assessment into a
 *     `PronunciationAttempt` discriminator — the engine's plugin reads
 *     only that subset; the inline feedback below shows the full result.
 *
 * The card disables the mic until `studentId` and `sessionId` are real
 * — the assess IPC needs both to attribute the attempt + open the
 * `learning_events` row.
 */
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type {
  GradeOutcome,
  PronunciationAttempt,
  PronunciationExercise,
} from "@/modules/exercises";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { ProgressMeter } from "@/ui/components/ProgressMeter";
import { VocabularyPronunciation } from "@/ui/components/VocabularyPronunciation";
import { MicButton } from "@/ui/screens/student/pronunciation/MicButton";
import { usePronunciationRecorder } from "@/ui/screens/student/pronunciation/usePronunciationRecorder";
import { useMutation } from "@tanstack/react-query";

type AssessResult = Awaited<ReturnType<typeof api.pronunciation.assess>>;

export interface PronunciationCardProps {
  exercise: PronunciationExercise;
  outcome: GradeOutcome | null;
  studentId: number;
  sessionId: number | null;
  preferredAccent?: "uk" | "us" | "any";
  onAnswer: (attempt: PronunciationAttempt) => void;
}

export function PronunciationCard({
  exercise,
  outcome,
  studentId,
  sessionId,
  preferredAccent = "uk",
  onAnswer,
}: PronunciationCardProps) {
  const recorder = usePronunciationRecorder();
  const { headword, ipa, referenceAudio, passingScore } = exercise.payload;

  const assess = useMutation({
    mutationFn: async (audio: { audioPcm: Float32Array; sampleRate: number }) => {
      if (sessionId === null) throw new Error("Session is not open yet.");
      return api.pronunciation.assess({
        studentId,
        sessionId,
        targetText: headword,
        ipa,
        audioPcm: audio.audioPcm,
        sampleRate: audio.sampleRate,
      });
    },
    onSuccess: (result: AssessResult) => {
      if (result.ok) onAnswer(toAttempt(result, passingScore));
    },
  });

  const micState = micStateOf(recorder.state, assess.isPending, Boolean(recorder.recording));

  async function handleMic() {
    if (recorder.state === "recording") {
      const recorded = await recorder.stop();
      if (recorded) assess.mutate({ audioPcm: recorded.audioPcm, sampleRate: recorded.sampleRate });
      return;
    }
    await recorder.start();
  }

  const failed = outcome?.needsRetry === true;
  const passed = outcome?.correct === true;
  const assessment = assess.data?.ok ? assess.data.assessment : null;
  const fallbackRefs = referenceAudio.map((audio) => ({
    ref: audio.ref,
    label: audio.label,
    accent: audio.accent,
  }));

  return (
    <BentoCard className="motion-enter mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <Badge tone="sky" uppercase>
          Pronunciation
        </Badge>
        <h2 className="text-4xl font-semibold leading-tight">{headword}</h2>
        {ipa ? <p className="font-mono text-sm text-muted">{ipa}</p> : null}
        <VocabularyPronunciation
          headword={headword}
          fallbackRefs={fallbackRefs}
          preferredAccent={preferredAccent}
          size="md"
          className="justify-center"
        />
      </header>

      <div className="flex justify-center">
        <MicButton
          state={micState}
          durationMs={recorder.durationMs}
          maxDurationMs={recorder.maxDurationMs}
          disabled={sessionId === null}
          onClick={handleMic}
        />
      </div>

      {sessionId === null ? (
        <p className="text-center text-xs text-muted-2">Opening practice session…</p>
      ) : null}

      {recorder.error ? (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          {recorder.error}
        </div>
      ) : null}

      {assess.error ? (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          {assess.error instanceof Error ? assess.error.message : "Could not score that attempt."}
        </div>
      ) : null}

      {assess.data && !assess.data.ok ? (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          {assess.data.reason}
        </div>
      ) : null}

      {assessment ? (
        <>
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              passed
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/35 bg-warning/10 text-warning",
            )}
          >
            <p className="font-semibold">
              {passed
                ? `Nice — ${Math.round(assessment.overallScore)}/100.`
                : `Try again — ${Math.round(assessment.overallScore)}/100 (need ${passingScore}+).`}
            </p>
            {assessment.guardrails[0] ? (
              <p className="mt-1 leading-6">{assessment.guardrails[0].message}</p>
            ) : null}
          </div>
          <section className="grid gap-3 sm:grid-cols-3">
            <ScoreCell label="Overall" value={assessment.overallScore} />
            <ScoreCell label="Phonemes" value={assessment.phonemeScore} />
            <ScoreCell
              label="Stress"
              value={assessment.stressScore ?? 0}
              muted={assessment.stressScore === null}
            />
          </section>
          {assessment.feedback.length > 0 ? (
            <div className="rounded-xl border border-border-subtle bg-surface-0/70 p-4">
              <p className="text-xs font-semibold uppercase text-muted-2">Feedback</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm leading-6 text-muted">
                {assessment.feedback.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {failed ? (
            <p className="text-center text-xs text-muted">Tap the mic to try this word again.</p>
          ) : null}
        </>
      ) : null}
    </BentoCard>
  );
}

function ScoreCell({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/70 p-3">
      <p className="text-xs font-semibold uppercase text-muted-2">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl", muted ? "text-muted-2" : "text-app")}>
        {muted ? "—" : Math.round(value)}
      </p>
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

function micStateOf(
  recorderState: ReturnType<typeof usePronunciationRecorder>["state"],
  assessing: boolean,
  hasRecording: boolean,
): "idle" | "recording" | "ready" | "assessing" {
  if (assessing) return "assessing";
  if (recorderState === "recording") return "recording";
  if (hasRecording) return "ready";
  return "idle";
}

function toAttempt(
  result: Extract<AssessResult, { ok: true }>,
  passingScore: number,
): PronunciationAttempt {
  const { assessment } = result;
  return {
    overallScore: assessment.overallScore,
    phonemeScore: assessment.phonemeScore,
    stressScore: assessment.stressScore,
    passed: assessment.overallScore >= passingScore && !assessment.retryRequired,
    retryRequired: assessment.retryRequired,
    durationMs: assessment.durationMs,
  };
}
