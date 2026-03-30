# Training Commands

These commands reproduce the packaged checkpoints from the canonical exports.

## Qwen3.5-4B Unweighted

```bash
cd <BABYLON_ROOT>/packages/training/python/scripts
python3 train_local.py --backend mlx --model mlx-community/Qwen3.5-4B-MLX-4bit --source-dir /Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-30T03-29-40Z-retained-unweighted --eval-source-dir /Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-30T03-29-40Z-retained-unweighted --output /Users/shawwalters/babylon-workspace/babylon/trained_models/scam-defense-qwen35-4b-difraud-synth-unweighted --iters 20 --batch-size 1 --max-seq-length 512 --sample-profile raw --validate
```

## Qwen3.5-4B Weighted

```bash
cd <BABYLON_ROOT>/packages/training/python/scripts
python3 train_local.py --backend mlx --model mlx-community/Qwen3.5-4B-MLX-4bit --source-dir /Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-30T03-29-40Z-retained-weighted --eval-source-dir /Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-30T03-29-40Z-retained-weighted --output /Users/shawwalters/babylon-workspace/babylon/trained_models/scam-defense-qwen35-4b-difraud-synth-weighted --iters 20 --batch-size 1 --max-seq-length 512 --sample-profile raw --validate
```

## Qwen3.5-9B Unweighted

```bash
cd <BABYLON_ROOT>/packages/training/python/scripts
python3 train_local.py --backend mlx --model mlx-community/Qwen3.5-9B-MLX-4bit --source-dir /Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-30T03-29-40Z-retained-unweighted --eval-source-dir /Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-30T03-29-40Z-retained-unweighted --output /Users/shawwalters/babylon-workspace/babylon/trained_models/scam-defense-qwen35-9b-difraud-synth-unweighted --iters 20 --batch-size 1 --max-seq-length 512 --sample-profile raw --validate
```

## Qwen3.5-9B Weighted

```bash
cd <BABYLON_ROOT>/packages/training/python/scripts
python3 train_local.py --backend mlx --model mlx-community/Qwen3.5-9B-MLX-4bit --source-dir /Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-30T03-29-40Z-retained-weighted --eval-source-dir /Users/shawwalters/babylon-workspace/babylon/training-data/scam-defense-export/2026-03-30T03-29-40Z-retained-weighted --output /Users/shawwalters/babylon-workspace/babylon/trained_models/scam-defense-qwen35-9b-difraud-synth-weighted --iters 20 --batch-size 1 --max-seq-length 512 --sample-profile raw --validate
```

