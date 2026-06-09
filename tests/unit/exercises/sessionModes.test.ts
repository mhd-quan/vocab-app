import {
  exerciseKindsForMode,
  practiceModeForExerciseMode,
} from "@/modules/exercises/sessionModes";
import { describe, expect, it } from "vitest";

describe("sessionModes", () => {
  it("can remove pronunciation from mixed unit-review decks", () => {
    expect(exerciseKindsForMode("mixed", { excludeSpeaking: true })).toEqual([
      "flashcard",
      "multiple_choice",
      "audio_recall",
      "sentence_rebuild",
      "definition_match",
    ]);
  });

  it("falls back to flashcards when a pronunciation-only mode excludes speaking", () => {
    expect(exerciseKindsForMode("pronunciation", { excludeSpeaking: true })).toEqual(["flashcard"]);
    expect(practiceModeForExerciseMode("pronunciation", { excludeSpeaking: true })).toBe(
      "flashcard",
    );
  });
});
