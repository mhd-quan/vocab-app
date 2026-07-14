import { cn } from "@/lib/cn";
import type { PronunciationAssessment } from "@/modules/pronunciation";

type Phonemes = PronunciationAssessment["phonemes"];
type RailVariant = "assessment" | "guide";

export function PhraseRail({
  phonemes,
  target,
  variant = "assessment",
}: {
  phonemes: Phonemes;
  target: PronunciationAssessment["target"];
  variant?: RailVariant;
}) {
  const words = target.words ?? [];
  if (words.length === 0) return <PhonemeRail phonemes={phonemes} variant={variant} />;

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-2">
        {variant === "guide" ? "Phrase sound sequence" : "Word-by-word result"}
      </h3>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-4">
        {words.map((word, wordIndex) => {
          const slice = phonemes.slice(word.phonemeRange[0], word.phonemeRange[1]);
          const approximate = word.source !== "cmudict";
          return (
            <div key={`${word.text}-${wordIndex}`} className="border-l border-border-subtle pl-3">
              <span
                className={cn("text-xs font-semibold", approximate ? "text-muted" : "text-app")}
              >
                {word.text}
                {approximate ? (
                  <span className="ml-1 font-normal text-muted-2">approx.</span>
                ) : null}
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {slice.map((phoneme, index) => (
                  <PhonemePill
                    key={`${phoneme.phoneme}-${index}`}
                    phoneme={phoneme.phoneme}
                    detected={phoneme.detectedPhoneme}
                    score={phoneme.score}
                    issue={phoneme.issue}
                    variant={variant}
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

export function PhonemeRail({
  phonemes,
  variant = "assessment",
}: {
  phonemes: Phonemes;
  variant?: RailVariant;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-2">
        {variant === "guide" ? "Sound sequence" : "Sound detail"}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {phonemes.map((phoneme, index) => (
          <PhonemePill
            key={`${phoneme.phoneme}-${index}`}
            phoneme={phoneme.phoneme}
            detected={phoneme.detectedPhoneme}
            score={phoneme.score}
            issue={phoneme.issue}
            variant={variant}
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
  variant,
}: {
  phoneme: string;
  detected: string | null;
  score: number;
  issue: string;
  variant: RailVariant;
}) {
  const assessment = variant === "assessment";
  const issueLabel =
    issue === "ok"
      ? "correct"
      : issue === "substitution"
        ? "substituted"
        : issue === "missing"
          ? "missing"
          : "needs attention";

  return (
    <span
      aria-label={
        assessment
          ? `Expected ${phoneme}, ${issueLabel}, score ${Math.round(score)}`
          : `Expected sound ${phoneme}`
      }
      className={cn(
        "inline-flex min-w-11 flex-col items-center rounded-control border px-2 py-1.5 font-mono text-xs",
        !assessment
          ? "border-border-subtle bg-surface-2/70 text-app"
          : issue === "ok"
            ? "border-success/25 bg-success/10 text-success"
            : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      /{phoneme}/
      {assessment ? (
        <span data-tabular className="mt-0.5 text-[10px] text-muted">
          {detected && detected !== phoneme ? `heard /${detected}/` : Math.round(score)}
        </span>
      ) : null}
    </span>
  );
}
