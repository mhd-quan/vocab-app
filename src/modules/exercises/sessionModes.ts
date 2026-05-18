import type { PracticeMode } from "@/data/schema";
import type { ExerciseKind } from "./types";

export type ExerciseSessionMode = "mixed" | ExerciseKind;

export const mixedExerciseKinds: ExerciseKind[] = [
  "flashcard",
  "multiple_choice",
  "audio_recall",
  "sentence_rebuild",
  "definition_match",
];

export const exerciseSessionModeOptions: Array<{ value: ExerciseSessionMode; label: string }> = [
  { value: "mixed", label: "Mixed reinforcement" },
  { value: "flashcard", label: "Flashcard" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "audio_recall", label: "Audio recall" },
  { value: "definition_match", label: "Definition matching" },
  { value: "sentence_rebuild", label: "Sentence rebuild" },
];

const exerciseSessionModeValues = new Set<string>(
  exerciseSessionModeOptions.map((option) => option.value),
);

export function normalizeExerciseSessionMode(value: unknown): ExerciseSessionMode {
  if (value === "fill_blank") return "sentence_rebuild";
  if (value === "matching") return "definition_match";
  return typeof value === "string" && exerciseSessionModeValues.has(value)
    ? (value as ExerciseSessionMode)
    : "mixed";
}

export function exerciseKindsForMode(mode: ExerciseSessionMode): ExerciseKind[] {
  return mode === "mixed" ? mixedExerciseKinds : [mode];
}

export function practiceModeForExerciseMode(mode: ExerciseSessionMode): PracticeMode {
  return mode;
}
