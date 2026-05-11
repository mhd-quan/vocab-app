import type { GrammarActivityInput } from "@/application/import/grammar.schema";
import type { GradeOutcome } from "@/modules/exercises";
import { rngFromSeed, shuffle } from "@/modules/exercises";
import type {
  GrammarAnswer,
  GrammarChoiceExercise,
  GrammarDeckBuildOptions,
  GrammarDeckBuildResult,
  GrammarErrorCorrectionExercise,
  GrammarExercise,
  GrammarFillBlankExercise,
  GrammarOrderExercise,
  GrammarPracticeResult,
  GrammarPromptedSentenceExercise,
  GrammarRewriteExercise,
  GrammarTopicMetadata,
} from "./types";

export function buildGrammarDeck(opts: GrammarDeckBuildOptions): GrammarDeckBuildResult {
  const rng = rngFromSeed(opts.sessionSeed);
  const exercises: GrammarExercise[] = [];
  const skipped: GrammarDeckBuildResult["skipped"] = [];

  for (const topic of opts.topics) {
    const activities = activitiesForTopic(topic.metadata as GrammarTopicMetadata | null);
    activities.forEach((activity, index) => {
      const exercise = toExercise(topic, activity, index);
      if (exercise) {
        exercises.push(exercise);
      } else {
        skipped.push({ topicId: topic.id, activityIndex: index, reason: "unsupported_activity" });
      }
    });
  }

  const ordered = opts.shuffle === false ? exercises : shuffle(exercises, rng);
  const trimmed =
    typeof opts.maxExercises === "number" && opts.maxExercises >= 0
      ? ordered.slice(0, opts.maxExercises)
      : ordered;

  return { exercises: trimmed, skipped };
}

export function gradeGrammarExercise(
  exercise: GrammarExercise,
  answer: GrammarAnswer,
): GradeOutcome {
  if (exercise.kind !== answer.kind) {
    throw new Error(`Answer kind '${answer.kind}' does not match exercise kind '${exercise.kind}'`);
  }

  switch (exercise.kind) {
    case "grammar_choice": {
      const choiceAnswer = answer as Extract<GrammarAnswer, { kind: "grammar_choice" }>;
      const selected = exercise.payload.options[choiceAnswer.selectedIndex];
      const correct = selected?.correct === true;
      return {
        correct,
        feedback: correct
          ? selected?.explanation || "Correct."
          : feedbackWithAnswer(
              "Not quite.",
              firstCorrectOption(exercise.payload.options)?.text ?? null,
              selected?.explanation ?? exercise.explanation,
            ),
        selfGrade: null,
        selectedIndex: choiceAnswer.selectedIndex,
      };
    }
    case "grammar_order": {
      const orderAnswer = answer as Extract<GrammarAnswer, { kind: "grammar_order" }>;
      return gradeTextAnswer(orderAnswer.tokens.join(" "), exercise.payload.acceptedAnswers);
    }
    case "grammar_fill_blank": {
      const textAnswer = answer as Extract<GrammarAnswer, { kind: "grammar_fill_blank" }>;
      return gradeTextAnswer(textAnswer.text, exercise.payload.acceptedAnswers);
    }
    case "grammar_rewrite": {
      const textAnswer = answer as Extract<GrammarAnswer, { kind: "grammar_rewrite" }>;
      return gradeTextAnswer(textAnswer.text, exercise.payload.acceptedAnswers);
    }
    case "grammar_prompted_sentence": {
      const textAnswer = answer as Extract<GrammarAnswer, { kind: "grammar_prompted_sentence" }>;
      return gradeTextAnswer(textAnswer.text, exercise.payload.acceptedAnswers);
    }
    case "grammar_error_correction": {
      const textAnswer = answer as Extract<GrammarAnswer, { kind: "grammar_error_correction" }>;
      return gradeTextAnswer(textAnswer.text, exercise.payload.acceptedAnswers);
    }
  }
}

export function summarizeGrammarResults(results: GrammarPracticeResult[]) {
  const total = results.length;
  const correct = results.filter((result) => result.outcome.correct).length;
  const byKind: Record<string, { total: number; correct: number }> = {};

  for (const result of results) {
    const bucket = byKind[result.kind] ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (result.outcome.correct) bucket.correct += 1;
    byKind[result.kind] = bucket;
  }

  return { total, correct, byKind };
}

export function grammarTopicMetadata(metadata: unknown): GrammarTopicMetadata {
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as GrammarTopicMetadata;
}

function activitiesForTopic(metadata: GrammarTopicMetadata | null): GrammarActivityInput[] {
  if (Array.isArray(metadata?.activities)) return metadata.activities;
  if (!Array.isArray(metadata?.checks)) return [];

  return metadata.checks.map((check, index) => ({
    kind: "rewrite",
    id: `check_${index + 1}`,
    prompt: check.prompt,
    instruction: "Write the complete correct answer.",
    answer: check.answer,
    explanation: check.explanation,
  }));
}

function toExercise(
  topic: {
    id: number;
    contentItemId: number;
    title: string;
  },
  activity: GrammarActivityInput,
  index: number,
): GrammarExercise | null {
  const base = {
    id: `grammar-${topic.id}-${activity.id ?? index + 1}-${activity.kind}`,
    topicId: topic.id,
    contentItemId: topic.contentItemId,
    topicTitle: topic.title,
    prompt: activity.prompt ?? defaultPrompt(activity.kind),
    instruction: activity.instruction ?? null,
    hint: activity.hint ?? null,
    explanation: activity.explanation ?? null,
  };

  switch (activity.kind) {
    case "fill_blank": {
      const markerAnswer = extractMarkedAnswer(activity.sentence);
      const answers = collectAcceptedAnswers(
        activity.answer ?? markerAnswer,
        activity.accepted_answers,
      );
      if (answers.length === 0) return null;
      return {
        ...base,
        kind: "grammar_fill_blank",
        payload: {
          sentence: displayBlankSentence(activity.sentence),
          acceptedAnswers: answers,
        },
      } satisfies GrammarFillBlankExercise;
    }
    case "choice": {
      const answer = activity.answer ? normalizeAnswer(activity.answer) : null;
      const options = activity.options.map((option) => ({
        text: option.text,
        correct: option.correct === true || normalizeAnswer(option.text) === answer,
        explanation: option.explanation ?? null,
      }));
      return {
        ...base,
        kind: "grammar_choice",
        prompt: activity.question,
        payload: {
          question: activity.question,
          options,
        },
      } satisfies GrammarChoiceExercise;
    }
    case "order": {
      return {
        ...base,
        kind: "grammar_order",
        payload: {
          tokens: activity.tokens,
          acceptedAnswers: collectAcceptedAnswers(activity.answer, activity.accepted_answers),
        },
      } satisfies GrammarOrderExercise;
    }
    case "rewrite": {
      return {
        ...base,
        kind: "grammar_rewrite",
        payload: {
          sourceSentence: activity.prompt,
          acceptedAnswers: collectAcceptedAnswers(activity.answer, activity.accepted_answers),
        },
      } satisfies GrammarRewriteExercise;
    }
    case "prompted_sentence": {
      return {
        ...base,
        kind: "grammar_prompted_sentence",
        payload: {
          words: activity.words,
          acceptedAnswers: collectAcceptedAnswers(activity.answer, activity.accepted_answers),
        },
      } satisfies GrammarPromptedSentenceExercise;
    }
    case "error_correction": {
      return {
        ...base,
        kind: "grammar_error_correction",
        payload: {
          incorrectSentence: activity.sentence,
          acceptedAnswers: collectAcceptedAnswers(activity.answer, activity.accepted_answers),
        },
      } satisfies GrammarErrorCorrectionExercise;
    }
  }
}

function collectAcceptedAnswers(
  primary: string | null | undefined,
  alternates: string[] | undefined,
): string[] {
  const values = [primary, ...(alternates ?? [])].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return [...new Set(values)];
}

function gradeTextAnswer(value: string, expected: string[]): GradeOutcome {
  const correct = expected.some((answer) => answersMatch(value, answer));
  return {
    correct,
    feedback: correct ? "Correct." : feedbackWithAnswer("Not quite.", expected[0] ?? null, null),
    selfGrade: null,
    selectedIndex: null,
  };
}

function answersMatch(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .toLocaleLowerCase();
}

function feedbackWithAnswer(
  prefix: string,
  answer: string | null,
  explanation: string | null,
): string {
  const parts = [prefix];
  if (answer) parts.push(`Answer: ${answer}`);
  if (explanation) parts.push(explanation);
  return parts.join(" ");
}

function firstCorrectOption(options: Array<{ text: string; correct: boolean }>) {
  return options.find((option) => option.correct);
}

function extractMarkedAnswer(sentence: string): string | null {
  const match = sentence.match(/\{\{([^{}]+)\}\}/);
  return match?.[1]?.trim() || null;
}

function displayBlankSentence(sentence: string): string {
  return sentence.replace(/\{\{([^{}]+)\}\}/g, "_____");
}

function defaultPrompt(kind: GrammarActivityInput["kind"]): string {
  switch (kind) {
    case "fill_blank":
      return "Complete the sentence.";
    case "choice":
      return "Choose the correct option.";
    case "order":
      return "Put the words in the correct order.";
    case "rewrite":
      return "Rewrite the sentence.";
    case "prompted_sentence":
      return "Write a sentence using the prompts.";
    case "error_correction":
      return "Correct the sentence.";
  }
}
