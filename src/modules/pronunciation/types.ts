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
  audioPcm?: number[];
  sampleRate?: number;
  sessionId?: number | null;
  studentId?: number | null;
}

export interface AcousticFrame {
  timeMs: number;
  logProbs: Record<string, number>;
}
