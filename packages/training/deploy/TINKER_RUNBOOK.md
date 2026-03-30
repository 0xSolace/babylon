# Tinker Runbook

Use this when Babylon training should run on Tinker instead of a self-managed GPU box.

## What This Path Does

- Loads real trajectories from Postgres or a Hugging Face export
- Scores and groups them in the canonical pipeline
- Sends the curated groups to Tinker for remote training
- Writes a local `training_manifest.json` plus a remote checkpoint reference

## Required Environment

```bash
export TINKER_API_KEY=...
```

Choose one trajectory source:

```bash
# Direct DB access
export DATABASE_URL=postgresql://...
```

```bash
# Remote-friendly dataset export
export TRAJECTORY_SOURCE=huggingface
export HF_TRAJECTORY_DATASET=your-org/scambench-trajectories
export HF_TRAJECTORY_SPLIT=raw
```

## Recommended Command

From `packages/training`:

```bash
make tinker-pipeline \
  STEPS=500 \
  OUTPUT=./trained_models/tinker-run \
  TRAJECTORY_SOURCE=huggingface \
  HF_DATASET=your-org/scambench-trajectories \
  HF_SPLIT=raw
```

Direct Python entrypoint:

```bash
cd python
./.venv/bin/python scripts/run_pipeline.py \
  --training-backend tinker \
  --trajectory-source huggingface \
  --hf-dataset your-org/scambench-trajectories \
  --hf-split raw \
  --tinker-steps 500 \
  --rl-steps 100 \
  --output ../trained_models/tinker-run
```

## Outputs

- `training_manifest.json`
- `tinker_trained/training_result.json`
- `tinker_trained/checkpoint.tar`
- `tinker_trained/exported_adapter/`
- `tinker_training_metrics.jsonl`
- `rl/post_training_report.json`
- `rl/tinker_trained/checkpoint.tar`
- `rl/tinker_trained/exported_adapter/`
- `served_eval_tinker.json`
- `scambench_results.json`

The manifest records:
- `backend=tinker`
- `remote_base_model_ref=<initial sampler checkpoint>`
- `remote_model_ref=<final sampler checkpoint>`
- `remote_state_ref=<resumable training checkpoint>`
- downloaded archive and extracted adapter paths when export succeeds

Notes:
- `your-org/scambench-trajectories` is a placeholder. The repo does not currently publish a live public Hugging Face ScamBench dataset id.

## Current Limits

- Tinker RL now resumes from the SFT `remote_state_ref`, but it still uses Tinker-native training/sampling rather than the local Atropos process stack.
- Served eval and ScamBench use Tinker’s OpenAI-compatible endpoint, so they require `TINKER_API_KEY` to be present at evaluation time.
- The downloaded archive is intended as a portable artifact; whether it can be fused into a local full model depends on the local transformers/PEFT stack and the checkpoint format.
