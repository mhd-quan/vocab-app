import { cn } from "@/lib/cn";
import type { PronunciationAssessment } from "@/modules/pronunciation";

type Phonemes = PronunciationAssessment["phonemes"];

export function PhraseRail({
  phonemes,
  target,
}: {
  phonemes: Phonemes;
  target: PronunciationAssessment["target"];
}) {
  const words = target.words ?? [];
  if (words.length === 0) return <PhonemeRail phonemes={phonemes} />;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/70 p-4">
      <p className="text-xs font-semibold uppercase text-muted-2">Phrase alignment</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {words.map((word, wordIndex) => {
          const slice = phonemes.slice(word.phonemeRange[0], word.phonemeRange[1]);
          const approximate = word.source !== "cmudict";
          return (
            <div
              key={`${word.text}-${wordIndex}`}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border px-2.5 py-2",
                approximate
                  ? "border-border-subtle/70 bg-surface-1/40"
                  : "border-border-subtle bg-surface-1",
              )}
              title={approximate ? "Approximate IPA: word not in CMUdict" : undefined}
            >
              <span
                className={cn(
                  "px-0.5 text-xs font-semibold uppercase tracking-wide",
                  approximate ? "text-muted-2" : "text-app",
                )}
              >
                {word.text}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {slice.map((phoneme, index) => (
                  <PhonemePill
                    key={`${phoneme.phoneme}-${index}`}
                    phoneme={phoneme.phoneme}
                    detected={phoneme.detectedPhoneme}
                    score={phoneme.score}
                    issue={phoneme.issue}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PhonemeRail({ phonemes }: { phonemes: Phonemes }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/70 p-4">
      <p className="text-xs font-semibold uppercase text-muted-2">Phoneme alignment</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {phonemes.map((phoneme, index) => (
          <PhonemePill
            key={`${phoneme.phoneme}-${index}`}
            phoneme={phoneme.phoneme}
            detected={phoneme.detectedPhoneme}
            score={phoneme.score}
            issue={phoneme.issue}
          />
        ))}
      </div>
    </div>
  );
}

function PhonemePill({
  phoneme,
  detected,
  score,
  issue,
}: {
  phoneme: string;
  detected: string | null;
  score: number;
  issue: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-12 flex-col items-center rounded-lg border px-2 py-2 font-mono text-xs",
        issue === "ok"
          ? "border-success/30 bg-success/10 text-success"
          : "border-warning/35 bg-warning/10 text-warning",
      )}
    >
      /{phoneme}/
      <span className="mt-1 text-[10px] text-muted-2">
        {detected && detected !== phoneme ? `/${detected}/` : score}
      </span>
    </span>
  );
}
