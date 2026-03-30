---
license: mit
language:
  - en
tags:
  - scam-defense
  - prompt-injection
  - social-engineering
  - benchmark
  - red-team
pretty_name: Babylon Scam Defense v1
---

# Babylon Scam Defense v1

Canonical release dataset for the Babylon anti-scam training and evaluation work.

## Contents

- Materialized training examples: `3520`
- Detector rows: `2886`
- Conversation rows: `4185`
- SFT rows: `1544`
- Reasoning donors: `474`
- Curated ScamBench scenarios: `197`
- Weighted Babylon trajectories: `957` trajectories / `3561` samples
- Unweighted Babylon trajectories: `819` trajectories / `3027` samples

## Benchmark Snapshot

- Top full-catalog ScamBench checkpoint: `baseline-qwen35-4b-unified-nebius` at `8.489251207729469`

## Files

- `data/training_examples.jsonl`: agent-policy training examples.
- `data/detector_corpus.jsonl`: detector-style scam rows for auxiliary modeling.
- `data/conversation_corpus.jsonl`: source conversations retained for analysis and augmentation.
- `data/sft_corpus.jsonl`: prompt/response-style rows retained from source corpora.
- `data/reasoning_donor_corpus.jsonl`: reasoning-trace donor rows retained for private-analysis synthesis.
- `data/scambench_scenario_seeds.jsonl`: scenario seed inventory.
- `data/scambench_curated_scenarios.json`: curated multi-turn scenarios.
- `data/scenario_catalog.json`: canonical full ScamBench catalog for this release.
- `exports/weighted/trajectories.jsonl`: weighted Babylon training export.
- `exports/unweighted/trajectories.jsonl`: unweighted Babylon training export.

## Methodology Caveats

- Local train and eval exports still overlap because the grouped held-out split path is not yet compatible with the exported trajectory shape.
- The 4B weighted checkpoint is stronger on the broader malicious TrustBench slice, while the 4B unweighted checkpoint is stronger on the harder ScamBench catalog.
- The 9B weighted checkpoint regressed on both the harder ScamBench catalog and the malicious TrustBench slice.

