import {
  ARPABET_VOWELS,
  REQUIRED_PRONUNCIATION_LABELS,
  assessPronunciationFromFrames,
  audioQualityFromPcm,
  buildPronunciationTarget,
  ctcViterbiAlign,
  deterministicAcousticFrames,
  evaluatePronunciationPolicy,
  normalizeAcousticLabel,
  pronunciationLabelCoverage,
  scoreStress,
} from "@/modules/pronunciation";
import { describe, expect, it } from "vitest";

const stubLookup = (entries: Record<string, string>) => (word: string) => entries[word] ?? null;

describe("pronunciation engine", () => {
  it("builds a stressed CMU-style target using the injected lookup", () => {
    const target = buildPronunciationTarget("Fantastic", null, {
      lookup: stubLookup({ fantastic: "F AE1 N T AE2 S T IH0 K" }),
    });
    expect(target.phonemes).toEqual(["F", "AE", "N", "T", "AE", "S", "T", "IH", "K"]);
    expect(target.stressPattern).toContain(1);
    expect(target.stressPattern).toContain(2);
    expect(target.source).toBe("cmudict");
  });

  it("falls back to IPA parsing when no CMU lookup hits", () => {
    const target = buildPronunciationTarget("relative", "/ˈrelətɪv/");
    expect(target.source).toBe("ipa");
    expect(target.phonemes[0]).toBe("R");
    expect(target.stressPattern[0]).toBeNull();
    const firstVowelIndex = target.phonemes.findIndex((p) => ARPABET_VOWELS.has(p));
    expect(firstVowelIndex).toBeGreaterThanOrEqual(0);
    expect(target.stressPattern[firstVowelIndex]).toBe(1);
    const otherVowelStresses = target.phonemes
      .map((p, i) =>
        i !== firstVowelIndex && ARPABET_VOWELS.has(p) ? target.stressPattern[i] : null,
      )
      .filter((s) => s !== null);
    expect(otherVowelStresses.every((s) => s === 0)).toBe(true);
  });

  it("tokenizes multi-character IPA digraphs greedily", () => {
    const target = buildPronunciationTarget("cheese", "tʃiːz");
    expect(target.source).toBe("ipa");
    expect(target.phonemes).toEqual(["CH", "IY", "Z"]);
  });

  it("preserves secondary stress markers in IPA", () => {
    const target = buildPronunciationTarget("photograph", "/ˈfoʊtəˌɡræf/");
    expect(target.source).toBe("ipa");
    const stressOnVowels = target.phonemes
      .map((p, i) => (ARPABET_VOWELS.has(p) ? target.stressPattern[i] : null))
      .filter((s): s is 0 | 1 | 2 => s !== null);
    expect(stressOnVowels).toContain(1);
    expect(stressOnVowels).toContain(2);
  });

  it("falls back to heuristic when no lookup nor IPA is given", () => {
    const target = buildPronunciationTarget("xyzgibberish");
    expect(target.source).toBe("heuristic");
    expect(target.phonemes.length).toBeGreaterThan(0);
  });

  it("normalizes model acoustic labels into the app phoneme set", () => {
    expect(normalizeAcousticLabel("<pad>")).toBe("<blank>");
    expect(normalizeAcousticLabel("f")).toBe("F");
    expect(normalizeAcousticLabel("æ")).toBe("AE");
    expect(normalizeAcousticLabel("eɪ")).toBe("EY");
    expect(normalizeAcousticLabel("tʃ")).toBe("CH");
    expect(normalizeAcousticLabel("<unk>")).toBeNull();
  });

  it("requires full English phoneme coverage for HuBERT CAPT labels", () => {
    const completeLabels = Object.fromEntries(
      ["<blank>", ...REQUIRED_PRONUNCIATION_LABELS].map((label, index) => [String(index), label]),
    );
    expect(pronunciationLabelCoverage(completeLabels).ok).toBe(true);

    const incomplete = pronunciationLabelCoverage({ "0": "<blank>", "1": "F", "2": "T" });
    expect(incomplete.ok).toBe(false);
    expect(incomplete.missing).toContain("AE");
    expect(incomplete.missing).toContain("IY");
  });

  it("aligns target phonemes through CTC-Viterbi frames", () => {
    const target = ["F", "AE", "N"];
    const { frames, labels } = deterministicAcousticFrames(target);
    const result = ctcViterbiAlign({ target, frames, labels });
    expect(result.phonemes.map((phoneme) => phoneme.phoneme)).toEqual(target);
    expect(result.phonemes.every((phoneme) => phoneme.score > 70)).toBe(true);
  });

  it("scores stress from syllable energy without an acoustic model", () => {
    const score = scoreStress({
      stressPattern: [0, 1, 0],
      sampleRate: 16_000,
      audioPcm: new Float32Array([
        ...Array(200).fill(0.08),
        ...Array(200).fill(0.5),
        ...Array(200).fill(0.1),
      ]),
    });
    expect(score.issue).toBe("ok");
    expect(score.score).toBeGreaterThan(80);
  });

  it("evaluates retry guardrails from score threshold and microphone quality", () => {
    const policyResult = evaluatePronunciationPolicy({
      overallScore: 64,
      audioPcm: new Float32Array(800).fill(0.2),
      sampleRate: 16_000,
    });
    expect(policyResult.retryRequired).toBe(true);
    expect(policyResult.guardrails.map((guardrail) => guardrail.code)).toContain(
      "score_below_threshold",
    );

    const quiet = audioQualityFromPcm(new Float32Array(16_000).fill(0.001), 16_000);
    expect(quiet?.durationMs).toBe(1000);
    expect(quiet?.rms).toBeLessThan(0.012);
  });

  it("combines alignment and stress into an assessment", () => {
    const target = buildPronunciationTarget("family", null, {
      lookup: stubLookup({ family: "F AE1 M AH0 L IY0" }),
    });
    const { frames, labels } = deterministicAcousticFrames(target.phonemes);
    const assessment = assessPronunciationFromFrames({
      input: {
        targetText: "family",
        audioPcm: new Float32Array([...Array(6_000).fill(0.2), ...Array(6_000).fill(0.55)]),
        sampleRate: 16_000,
      },
      frames,
      labels,
      runtime: {
        available: true,
        backend: "deterministic",
        executionProvider: "cpu",
        modelFamily: "hubert",
        modelId: null,
        platform: "test",
        arch: "test",
        modelPath: null,
        modelPresent: false,
        localOnly: true,
        reason: null,
      },
      buildTargetOptions: { lookup: stubLookup({ family: "F AE1 M AH0 L IY0" }) },
    });
    expect(assessment.overallScore).toBeGreaterThan(70);
    expect(assessment.retryRequired).toBe(false);
    expect(assessment.passingScore).toBe(70);
    expect(assessment.phonemes.length).toBe(target.phonemes.length);
  });
});
