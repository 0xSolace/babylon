---
license: mit
base_model: mlx-community/Qwen3.5-4B-MLX-4bit
tags:
  - scam-defense
  - prompt-injection
  - social-engineering
  - lora
  - benchmark-best
---

# Qwen3.5-4B Unweighted

Role in release: `benchmark-best`

## Metrics

- Full-catalog ScamBench: `28.82058087517448`
- Primary deterministic validation: `fail`
- Legacy detector benchmark F1: `0.9885057471264368`

## Training

- Backend: `mlx`
- Base model: `mlx-community/Qwen3.5-4B-MLX-4bit`
- Source dir: `/Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-25T14-26-30Z-difraud-synth-unweighted`
- Eval source dir: `/Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-25T14-26-30Z-difraud-synth-unweighted`
- Raw training samples: `3052`
- Training samples after formatting: `6104`

## Notes

- Best full-catalog ScamBench performer in the difraud-expanded release matrix.

## Methodology Caveats

- Local train and eval exports still overlap because the grouped held-out split path is not yet compatible with the exported trajectory shape.
- The 4B weighted checkpoint is stronger on the broader malicious TrustBench slice, while the 4B unweighted checkpoint is stronger on the harder ScamBench catalog.
- The 9B weighted checkpoint regressed on both the harder ScamBench catalog and the malicious TrustBench slice.

## Included Files

- Artifact layout: `adapter`
- `adapters/adapter_config.json`
- `adapters/adapters.safetensors`
- `training_manifest.json`
- `validation_report.json`
- `benchmark_summary.json`

