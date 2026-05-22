# HuBERT Pronunciation Implementation Plan

## Goal

Build a production-ready pronunciation tab for students and a clear tutor dashboard review flow. The pronunciation backend must behave like a stable subsystem: model loading, target generation, acoustic inference, scoring policy, evidence storage, and UI views communicate through typed contracts so a future model swap or feature extension does not require rewriting the whole app.

The current target backbone is HuBERT-only. Wav2Vec2 assets, manifests, and runtime assumptions should not be reintroduced.

## Architecture Boundary

Pronunciation owns these layers:

1. Target generation: text/IPA to normalized phoneme target and stress pattern.
2. Model contract: HuBERT CTC bundle manifest, label normalization, required English phoneme coverage.
3. Acoustic inference: local-only ONNX inference through Transformers.js in Electron.
4. Alignment and scoring: CTC Viterbi phoneme alignment, stress scoring, overall scoring.
5. Policy and guardrails: pass/retry threshold, audio quality checks, retry-required decision.
6. Evidence: append-only `pronunciation_assessment` payloads in `session_evidence_events`.
7. Presentation: student pronunciation tab and tutor CAPT dashboard panels.

No UI code should decide whether an attempt passes. UI reads `retryRequired`, `guardrails`, `passingScore`, and `audioQuality` from the backend result.

## Stage 1 - HuBERT Model Contract

Outcome: the app can identify whether an installed model bundle is the right kind of bundle before trying inference.

Implementation:

- Keep `assets/capt-models/manifest.json` as a lightweight tracked placeholder.
- Require `modelFamily: "hubert"` and a local `modelId`.
- Require labels from either `manifest.labels` or `<modelId>/vocab.json`.
- Normalize model labels into the app ARPABET set.
- Reject any bundle missing required English phoneme coverage.
- Keep local model files ignored by git.

Verification:

- Unit tests for label normalization and coverage.
- Status reports a setup reason instead of becoming available for invalid bundles.

## Stage 2 - Acoustic Runtime

Outcome: Electron can load a local HuBERT CTC bundle and produce frame-level log probabilities.

Implementation:

- Keep inference in `electron/pronunciation/runtime.ts`.
- Keep `allowRemoteModels = false`.
- Cache processor/model per `{modelPath, modelId, provider}`.
- Prefer platform provider, then fallback to CPU.
- Resample microphone PCM to manifest sample rate.
- Convert logits to `AcousticFrame[]`.
- Keep model execution behind the existing IPC procedure surface.

Guardrails:

- No network model download at runtime.
- No raw audio persistence by default.
- Model failure returns structured `ok: false`, not a crashed session.

## Stage 3 - Scoring Core

Outcome: a single pure scoring engine turns frames plus target into an assessment.

Implementation:

- Use CTC Viterbi alignment against target phonemes.
- Score each phoneme with expected/detected span metadata.
- Score stress from energy buckets while treating missing stress as unavailable.
- Compute overall score from phoneme and stress scores.
- Return a full `PronunciationAssessment` object.

Extension points:

- Add fluency/completeness later without changing IPC payload shape drastically.
- Swap acoustic model as long as it emits normalized phoneme log probabilities.

## Stage 4 - Policy And Guardrails

Outcome: the backend decides pass/retry consistently.

Implementation:

- Default `maxErrorRate = 0.30`, which means `passingScore = 70`.
- Retry when `errorRate > maxErrorRate`.
- Retry for invalid microphone input: missing audio, too short, too quiet, clipped.
- Store guardrails as structured `{code, severity, message}`.
- Read tutor-adjustable policy from `app_settings` keys:
  - `pronunciation_max_error_rate`
  - `pronunciation_min_duration_ms`
  - `pronunciation_min_rms`

Near-term follow-up:

- Add tutor Settings controls for these keys.
- Add per-level presets if B1/B2 targets need different thresholds.

## Stage 5 - Evidence Pipeline

Outcome: every checked attempt is visible to tutor reporting.

Implementation:

- Record `pronunciation_assessment` evidence for successful model assessments.
- Payload includes backend, provider, score, threshold, retry decision, guardrails, audio quality, phoneme scores, stress score, and feedback.
- Evidence summary counts:
  - attempts
  - average score
  - retry-required count
  - pronunciation flags

Dashboard behavior:

- Tutor overview shows average pronunciation score and retry count.
- Student detail panel shows attempts, average score, retries, and recent session rows.

## Stage 6 - Student Pronunciation Tab

Outcome: students can practice assigned vocabulary with immediate feedback.

Implementation:

- Student selects assigned vocabulary target.
- Student can play dictionary audio.
- Student records an attempt.
- `Check attempt` runs backend assessment.
- UI shows pass/retry based on `retryRequired`.
- UI shows score cards, phoneme rail, and feedback.
- If retry is required, the student should record again before moving on.

Near-term follow-up:

- Disable check when there is no recording unless preview mode is explicitly requested.
- Add attempt count per word in the current session.
- Add "next target" only after pass or tutor-configured max retries.

## Stage 7 - Tutor Review And QA

Outcome: tutor can quickly see who needs pronunciation intervention.

Implementation:

- Dashboard surfaces pronunciation average and retry counts.
- Student detail panel lists recent pronunciation sessions.
- Evidence timeline keeps detailed payload for review/export.
- Export/import already uses the evidence pipeline, so pronunciation data travels with student reports.

QA Matrix:

- Valid HuBERT bundle: status available, assessment recorded.
- Missing bundle: UI shows setup state, no evidence row for failed model assessment.
- Bad labels: status explains missing phoneme labels.
- Quiet audio: retry guardrail.
- Short audio: retry guardrail.
- Score below 70: retry guardrail.
- Score at least 70 with clean audio: pass.
- Tutor dashboard: attempt count, average score, retry count update.

## Model Swap Rule

Future models may replace HuBERT only by implementing the same backend contract:

- local-only model bundle
- manifest family declared explicitly
- labels normalize to app phonemes
- output can be converted to `AcousticFrame[]`
- assessment result still goes through policy and evidence

The student tab, tutor dashboard, evidence repository, and settings should not need model-specific branches.
