# Installing the HuBERT CAPT Model

The pronunciation feature relies on a local, offline HuBERT phoneme-CTC ONNX bundle. This document explains how to drop one in.

The app refuses to load anything that is not a HuBERT bundle: `electron/pronunciation/runtime.ts:verifyHubertArchitecture` reads `<modelId>/config.json` and rejects bundles whose `model_type` is not `hubert`. Wav2vec2 and other architectures are intentionally not supported.

## Recommended model

[`Peacockery/hubert-base-phoneme-en`](https://huggingface.co/Peacockery/hubert-base-phoneme-en) — HuBERT-base fine-tuned for English ARPABET phoneme CTC. Its `vocab.json` already lists the 39 ARPABET phonemes the app expects, plus `[PAD]` and `[UNK]`, so no extra label mapping is needed.

The reference `assets/capt-models/manifest.json` is already configured for this `modelId`.

## One-time install

The HuggingFace repo ships PyTorch `safetensors`. The runtime needs ONNX. Use [Optimum CLI](https://huggingface.co/docs/optimum/main/en/exporters/onnx/usage_guides/export_a_model) to convert once, on the dev machine.

```bash
# 1. Install converter prerequisites (Python 3.11 or 3.12, in a venv).
#    Note: Python 3.14 is not supported by torch wheels at time of writing.
python3.12 -m venv .capt-venv && source .capt-venv/bin/activate
pip install "optimum[exporters]==1.24.0" "transformers<5" torch

# 2. Export ONNX into the expected app folder.
optimum-cli export onnx \
  --model Peacockery/hubert-base-phoneme-en \
  --task automatic-speech-recognition \
  assets/capt-models/Peacockery/hubert-base-phoneme-en

# 3. Restructure into the transformers.js convention: model.onnx must live
#    under <modelId>/onnx/, not flat at the top of the bundle.
mkdir -p assets/capt-models/Peacockery/hubert-base-phoneme-en/onnx
mv assets/capt-models/Peacockery/hubert-base-phoneme-en/model.onnx \
   assets/capt-models/Peacockery/hubert-base-phoneme-en/onnx/
```

Notes:

- Optimum 2.x removed the `export onnx` subcommand; pin to `1.24.0`.
- The post-export validation step may print `RuntimeError: Numpy is not available` when numpy 2.x and torch 2.2 are paired. The ONNX file is still written; ignore that error.
- `model.onnx` ends up ~360 MB (float32). Smaller quantized variants can be generated with `--quantize` if needed, but require a calibration pass.

After this, the folder layout should look like:

```
assets/capt-models/
├── manifest.json
└── Peacockery/
    └── hubert-base-phoneme-en/
        ├── config.json           # model_type = "hubert"
        ├── vocab.json            # ARPABET labels
        ├── tokenizer_config.json
        ├── preprocessor_config.json
        ├── special_tokens_map.json
        ├── added_tokens.json
        └── onnx/
            └── model.onnx        # 360 MB (float32)
```

The whole bundle is gitignored (`.gitignore`: `/assets/capt-models/**` with manifest exception), so nothing here is committed.

## Verifying

```bash
npm start
# Tutor → Settings → check the Pronunciation runtime card.
```

Status reasons map to the runtime checks in `electron/pronunciation/runtime.ts:pronunciationStatus`:

| Status reason mentions          | What to fix                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| "No offline HuBERT CAPT bundle" | Folder under `assets/capt-models/` is missing                  |
| "must declare modelFamily"      | `manifest.json` is malformed or wrong family                   |
| "missing required English phonemes" | `vocab.json` doesn't cover the 39 ARPABET phonemes          |
| "HuBERT is required"            | `config.json/model_type` is not `hubert` — wrong architecture |
| "runtime dependencies"          | `@huggingface/transformers` or `onnxruntime-node` not installed for this platform |

When all five checks pass, the status badge reads `transformers-js / coreml` (macOS), `transformers-js / directml` (Windows), or `transformers-js / cpu` (fallback).

## Using a different HuBERT bundle

Any HuBERT phoneme-CTC export is acceptable provided:

1. `config.json:model_type === "hubert"`.
2. `vocab.json` (or `manifest.labels`) covers `REQUIRED_PRONUNCIATION_LABELS` from `src/modules/pronunciation/model.ts` after normalization via `normalizeAcousticLabel` (handles IPA → ARPABET).
3. The ONNX export emits `[batch, frames, labels]` logits.

Then update `manifest.json:modelId` to the new folder path and restart.
