export type PronunciationBackend = "onnx-native" | "transformers-js" | "deterministic";

export type PronunciationExecutionProvider = "coreml" | "directml" | "webgpu" | "wasm" | "cpu";

export interface PronunciationRuntimeStatus {
  available: boolean;
  backend: PronunciationBackend;
  executionProvider: PronunciationExecutionProvider;
  platform: NodeJS.Platform | "test";
  arch: string;
  modelPath: string | null;
  modelPresent: boolean;
  localOnly: boolean;
  reason: string | null;
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
