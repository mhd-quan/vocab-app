import type { GrammarActivityInput } from "@/application/import/grammar.schema";
import type { GradeOutcome } from "@/modules/exercises";
import type { GrammarTopicForPractice } from "../../../electron/db/repositories/grammar";

export const grammarExerciseKinds = [
  "grammar_fill_blank",
  "grammar_choice",
  "grammar_order",
  "grammar_rewrite",
  "grammar_prompted_sentence",
  "grammar_error_correction",
] as const;

export type GrammarExerciseKind = (typeof grammarExerciseKinds)[number];

export interface GrammarExerciseBase {
  id: string;
  kind: GrammarExerciseKind;
  topicId: number;
  contentItemId: number;
  topicTitle: string;
  prompt: string;
  instruction: string | null;
  hint: string | null;
  explanation: string | null;
}

export interface GrammarFillBlankExercise extends GrammarExerciseBase {
  kind: "grammar_fill_blank";
  payload: {
    sentence: string;
    acceptedAnswers: string[];
  };
}

export interface GrammarChoiceOption {
  text: string;
  correct: boolean;
  explanation: string | null;
}

export interface GrammarChoiceExercise extends GrammarExerciseBase {
  kind: "grammar_choice";
  payload: {
    question: string;
    options: GrammarChoiceOption[];
  };
}

export interface GrammarOrderExercise extends GrammarExerciseBase {
  kind: "grammar_order";
  payload: {
    tokens: string[];
    acceptedAnswers: string[];
  };
}

export interface GrammarRewriteExercise extends GrammarExerciseBase {
  kind: "grammar_rewrite";
  payload: {
    sourceSentence: string;
    acceptedAnswers: string[];
  };
}

export interface GrammarPromptedSentenceExercise extends GrammarExerciseBase {
  kind: "grammar_prompted_sentence";
  payload: {
    words: string[];
    acceptedAnswers: string[];
  };
}

export interface GrammarErrorCorrectionExercise extends GrammarExerciseBase {
  kind: "grammar_error_correction";
  payload: {
    incorrectSentence: string;
    acceptedAnswers: string[];
  };
}

export type GrammarExercise =
  | GrammarFillBlankExercise
  | GrammarChoiceExercise
  | GrammarOrderExercise
  | GrammarRewriteExercise
  | GrammarPromptedSentenceExercise
  | GrammarErrorCorrectionExercise;

export type GrammarAnswer =
  | { kind: "grammar_fill_blank"; text: string }
  | { kind: "grammar_choice"; selectedIndex: number }
  | { kind: "grammar_order"; tokens: string[] }
  | { kind: "grammar_rewrite"; text: string }
  | { kind: "grammar_prompted_sentence"; text: string }
  | { kind: "grammar_error_correction"; text: string };

export interface GrammarDeckBuildOptions {
  topics: GrammarTopicForPractice[];
  sessionSeed: string;
  maxExercises?: number;
  shuffle?: boolean;
}

export interface GrammarDeckBuildResult {
  exercises: GrammarExercise[];
  skipped: Array<{ topicId: number; activityIndex: number; reason: "unsupported_activity" }>;
}

export interface GrammarPracticeResult {
  exerciseId: string;
  topicId: number;
  contentItemId: number;
  kind: GrammarExerciseKind;
  outcome: GradeOutcome;
  currentSessionRun: number;
}

export type GrammarTopicMetadata = {
  patterns?: Array<{
    label?: string;
    form: string;
    use?: string;
    examples?: string[];
  }>;
  examples?: Array<{
    text: string;
    translation?: string;
    explanation?: string;
    correct?: boolean;
    note?: string;
  }>;
  common_mistakes?: Array<{
    wrong: string;
    correct: string;
    note?: string;
  }>;
  checks?: Array<{
    prompt: string;
    answer: string;
    explanation?: string;
  }>;
  activities?: GrammarActivityInput[];
};
