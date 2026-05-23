export type PronunciationBackend = "onnx-native" | "transformers-js" | "deterministic";

export type PronunciationExecutionProvider = "coreml" | "directml" | "webgpu" | "wasm" | "cpu";

export interface PronunciationRuntimeStatus {
  available: boolean;
  backend: PronunciationBackend;
  executionProvider: PronunciationExecutionProvider;
  modelFamily: "hubert" | null;
  modelId: string | null;
  platform: NodeJS.Platform | "test";
  arch: string;
  modelPath: string | null;
  modelPresent: boolean;
  localOnly: boolean;
  reason: string | null;
}

export type PronunciationGuardrailSeverity = "info" | "warning" | "retry";

export type PronunciationGuardrailCode =
  | "audio_missing"
  | "audio_too_short"
  | "audio_too_quiet"
  | "audio_clipped"
  | "score_below_threshold";

export interface PronunciationAudioQuality {
  durationMs: number;
  sampleRate: number;
  rms: number;
  peak: number;
  clippedRatio: number;
  silentRatio: number;
}

export interface PronunciationGuardrail {
  code: PronunciationGuardrailCode;
  severity: PronunciationGuardrailSeverity;
  message: string;
}

export interface PronunciationTarget {
  text: string;
  phonemes: string[];
  stressPattern: Array<0 | 1 | 2 | null>;
  source: "cmudict" | "heuristic" | "ipa";
}

export interface PronunciationPhonemeScore {
  phoneme: string;
  expectedIndex: number;
  startMs: number;
  endMs: number;
  score: number;
  detectedPhoneme: string | null;
  issue: "ok" | "substitution" | "weak" | "missing";
}

export interface PronunciationStressScore {
  expectedStress: Array<0 | 1 | 2 | null>;
  observedStress: Array<0 | 1 | 2 | null>;
  score: number;
  issue: "ok" | "flat" | "shifted" | "unavailable";
}

export interface PronunciationAssessment {
  target: PronunciationTarget;
  backend: PronunciationBackend;
  executionProvider: PronunciationExecutionProvider;
  modelUsed: boolean;
  durationMs: number;
  overallScore: number;
  phonemeScore: number;
  stressScore: number | null;
  passingScore: number;
  errorRate: number;
  retryRequired: boolean;
  guardrails: PronunciationGuardrail[];
  audioQuality: PronunciationAudioQuality | null;
  phonemes: PronunciationPhonemeScore[];
  stress: PronunciationStressScore;
  feedback: string[];
}

export interface PronunciationAnalyzeInput {
  targetText: string;
  ipa?: string | null;
  /**
   * Mono PCM samples in [-1, 1]. Use `Float32Array` end-to-end (binary
   * structured-clone over IPC, no per-element Zod validation) — `number[]`
   * is accepted only for legacy test fixtures via the engine.
   */
  audioPcm?: Float32Array | number[];
  sampleRate?: number;
  sessionId?: number | null;
  studentId?: number | null;
}

export interface AcousticLabels {
  /** label index → phoneme name (e.g. "AA", "<blank>"). */
  readonly labels: readonly string[];
  /** Index of the CTC blank token within `labels`. */
  readonly blankIndex: number;
}

export interface AcousticFrame {
  timeMs: number;
  /**
   * Log probabilities indexed by label index. Length matches
   * `AcousticLabels.labels.length`. Using a flat Float32Array
   * keeps the per-frame payload contiguous in memory (cheap to
   * pass over IPC / WASM) and removes per-cell object-key lookups
   * from the Viterbi hot loop.
   */
  logProbs: Float32Array;
}

export interface AcousticFrameSet {
  frames: AcousticFrame[];
  labels: AcousticLabels;
}
