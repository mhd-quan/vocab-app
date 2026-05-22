import {
  assessPronunciationFromFrames,
  buildPronunciationTarget,
  ctcViterbiAlign,
  deterministicAcousticFrames,
  scoreStress,
} from "@/modules/pronunciation";
import { describe, expect, it } from "vitest";

describe("pronunciation engine", () => {
  it("builds a stressed CMU-style target for known words", () => {
    const target = buildPronunciationTarget("Fantastic");
    expect(target.phonemes).toEqual(["F", "AE", "N", "T", "AE", "S", "T", "IH", "K"]);
    expect(target.stressPattern).toContain(1);
    expect(target.source).toBe("cmudict");
  });

  it("aligns target phonemes through CTC-Viterbi frames", () => {
    const target = ["F", "AE", "N"];
    const result = ctcViterbiAlign({ target, frames: deterministicAcousticFrames(target) });
    expect(result.phonemes.map((phoneme) => phoneme.phoneme)).toEqual(target);
    expect(result.phonemes.every((phoneme) => phoneme.score > 70)).toBe(true);
  });

  it("scores stress from syllable energy without an acoustic model", () => {
    const score = scoreStress({
      stressPattern: [0, 1, 0],
      sampleRate: 16_000,
      audioPcm: [...Array(200).fill(0.08), ...Array(200).fill(0.5), ...Array(200).fill(0.1)],
    });
    expect(score.issue).toBe("ok");
    expect(score.score).toBeGreaterThan(80);
  });

  it("combines alignment and stress into an assessment", () => {
    const target = buildPronunciationTarget("family");
    const assessment = assessPronunciationFromFrames({
      input: {
        targetText: "family",
        audioPcm: [...Array(400).fill(0.2), ...Array(400).fill(0.55)],
        sampleRate: 16_000,
      },
      frames: deterministicAcousticFrames(target.phonemes),
      runtime: {
        available: true,
        backend: "deterministic",
        executionProvider: "cpu",
        platform: "test",
        arch: "test",
        modelPath: null,
        modelPresent: false,
        localOnly: true,
        reason: null,
      },
    });
    expect(assessment.overallScore).toBeGreaterThan(70);
    expect(assessment.phonemes.length).toBe(target.phonemes.length);
  });
});
