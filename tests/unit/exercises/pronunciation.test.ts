import {
  type BuildContext,
  type PronunciationAttempt,
  mulberry32,
  pronunciationPlugin,
} from "@/modules/exercises";
import { describe, expect, it } from "vitest";
import { makeSource } from "./fixtures";

function makeCtx(): BuildContext {
  return {
    distractorPool: [],
    rng: mulberry32(13),
    sessionSeed: "seed-pron",
  };
}

function makeAttempt(overrides: Partial<PronunciationAttempt> = {}): PronunciationAttempt {
  return {
    overallScore: 80,
    phonemeScore: 78,
    stressScore: 82,
    passed: true,
    retryRequired: false,
    durationMs: 1_200,
    ...overrides,
  };
}

describe("pronunciationPlugin.build", () => {
  it("returns null when the source has no audio and no IPA", () => {
    const ex = pronunciationPlugin.build(makeSource({ ipa: null, audioRef: null }), makeCtx());
    expect(ex).toBeNull();
  });

  it("returns an exercise when the source has an IPA", () => {
    const ex = pronunciationPlugin.build(makeSource({ audioRef: null }), makeCtx());
    expect(ex).not.toBeNull();
    expect(ex?.kind).toBe("pronunciation");
    expect(ex?.payload.headword).toBe("relative");
    expect(ex?.payload.ipa).toBe("/ˈrelətɪv/");
    expect(ex?.payload.referenceAudio).toEqual([]);
    expect(ex?.payload.passingScore).toBe(70);
  });

  it("returns an exercise with reference audio when only an audioRef is present", () => {
    const ex = pronunciationPlugin.build(
      makeSource({ ipa: null, audioRef: "oald://relative__gb_1.mp3" }),
      makeCtx(),
    );
    expect(ex?.payload.referenceAudio).toEqual([
      { ref: "oald://relative__gb_1.mp3", label: "Audio", accent: "other" },
    ]);
  });

  it("is deterministic for a fixed seed", () => {
    const a = pronunciationPlugin.build(makeSource(), makeCtx());
    const b = pronunciationPlugin.build(makeSource(), makeCtx());
    expect(a?.id).toBe(b?.id);
  });
});

describe("pronunciationPlugin.grade", () => {
  const exercise = pronunciationPlugin.build(makeSource(), makeCtx());
  if (!exercise) throw new Error("fixture should produce a pronunciation exercise");

  it("returns correct=true when the attempt passes", () => {
    const outcome = pronunciationPlugin.grade(exercise, {
      kind: "pronunciation",
      attempt: makeAttempt({ passed: true, overallScore: 88 }),
    });
    expect(outcome.correct).toBe(true);
    expect(outcome.needsRetry).toBe(false);
    expect(outcome.feedback).toMatch(/88/);
  });

  it("returns correct=false and needsRetry=true when the attempt fails", () => {
    const outcome = pronunciationPlugin.grade(exercise, {
      kind: "pronunciation",
      attempt: makeAttempt({ passed: false, overallScore: 52 }),
    });
    expect(outcome.correct).toBe(false);
    expect(outcome.needsRetry).toBe(true);
    expect(outcome.feedback).toMatch(/52/);
    expect(outcome.feedback).toMatch(/70/);
  });

  it("leaves selfGrade + selectedIndex null", () => {
    const outcome = pronunciationPlugin.grade(exercise, {
      kind: "pronunciation",
      attempt: makeAttempt(),
    });
    expect(outcome.selfGrade).toBeNull();
    expect(outcome.selectedIndex).toBeNull();
  });
});
