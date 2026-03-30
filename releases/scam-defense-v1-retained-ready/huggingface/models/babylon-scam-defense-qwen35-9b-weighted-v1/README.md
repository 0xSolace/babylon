---
license: mit
base_model: mlx-community/Qwen3.5-9B-MLX-4bit
tags:
  - scam-defense
  - prompt-injection
  - social-engineering
  - lora
  - negative-result
---

# Qwen3.5-9B Weighted

Role in release: `negative-result`

## Metrics

- Full-catalog ScamBench: `17.49320795802984`
- Primary deterministic validation: `fail`
- Legacy detector benchmark F1: `0.389336917562724`

## Training

- Backend: `mlx`
- Base model: `mlx-community/Qwen3.5-9B-MLX-4bit`
- Source dir: `/Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-25T14-26-30Z-difraud-synth-weighted`
- Eval source dir: `/Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-25T14-26-30Z-difraud-synth-weighted`
- Raw training samples: `4063`
- Training samples after formatting: `8126`

## Notes

- Included for completeness because it is a clear negative result in the full matrix.

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

