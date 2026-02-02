# Babylon Training - Phala Cloud (TEE)

Deploy Babylon RL training to [Phala Cloud](https://cloud.phala.com) for **TEE-enabled, privacy-preserving GPU training** with verifiable computation.

## Quick Start

```bash
# 1. Install Phala CLI
npm install -g phala

# 2. Login
phala auth login

# 3. Configure (use master env file)
cp ../env.example .env
# Edit .env with your DATABASE_URL, PHALA_API_KEY, etc.

# 4. Deploy with database source (live training data)
python scripts/deploy.py deploy --compose docker-compose.yml --name babylon-train-1

# 5. Monitor
python scripts/deploy.py logs <app-id> --follow
```

## Prerequisites

### 1. Phala Cloud Account

Sign up at [cloud.phala.com](https://cloud.phala.com):
- Verify account and add payment method
- Get API key from Settings → API Keys

### 2. Docker Image

Push your Babylon training image to a registry:

```bash
cd packages/training/deploy/docker
./build.sh training -o yourorg -t latest
./build.sh push-training -o yourorg -t latest
```

### 3. Local Tools

```bash
npm install -g phala
pip install requests python-dotenv
```

## Data Sources

Phala supports two trajectory data sources:

### Option A: PostgreSQL Database (Live Data)

Best for training on continuously updated trajectory data:

```bash
# Set in .env
TRAJECTORY_SOURCE=db
DATABASE_URL=postgresql://user:pass@host:5432/db

# Deploy
python scripts/deploy.py deploy --compose docker-compose.yml --name babylon-train-1
```

### Option B: HuggingFace Dataset (Frozen/Reproducible)

Best for reproducible training runs or when database isn't accessible:

```bash
# Deploy with HF dataset
python scripts/deploy.py deploy \
  --compose docker-compose.yml \
  --name babylon-train-1 \
  --hf-dataset elizaos/enkidu-trajectories-raw \
  --profile h100 \
  --steps 5000
```

## Environment Configuration

Uses the master [`../env.example`](../env.example). Key variables:

| Variable | Description |
|----------|-------------|
| `TRAJECTORY_SOURCE` | `db` (default) or `huggingface` |
| `DATABASE_URL` | PostgreSQL connection (when source=db) |
| `HF_TRAJECTORY_DATASET` | HuggingFace dataset ID (when source=huggingface) |
| `HF_TOKEN` | HuggingFace token for private models/datasets |
| `PHALA_API_KEY` | Phala Cloud API key |
| `WANDB_API_KEY` | Weights & Biases tracking |
| `TEE_ATTESTATION_ENABLED` | Generate attestation reports |
| `TEE_ENCRYPT_CHECKPOINTS` | Encrypt checkpoints with TEE keys |

## Deployment Commands

```bash
# Deploy with database source
python scripts/deploy.py deploy --compose docker-compose.yml --name my-training

# Deploy with HuggingFace dataset
python scripts/deploy.py deploy \
  --compose docker-compose.yml \
  --name my-training \
  --hf-dataset elizaos/enkidu-trajectories-raw \
  --profile h100 \
  --steps 5000 \
  --min-agents-per-window 1

# List CVMs
python scripts/deploy.py list

# View logs
python scripts/deploy.py logs <app-id> --follow

# Get attestation
python scripts/deploy.py attestation <app-id> --output report.json

# Stop/delete
python scripts/deploy.py stop <app-id>
python scripts/deploy.py delete <app-id>
```

## Deploy Options

```
--compose, -c     Path to docker-compose.yml (default: docker-compose.yml)
--name, -n        Deployment name
--env-file, -e    Path to .env file
--profile, -p     GPU profile: 12gb, 24gb, l40, a100, h100, auto (default: auto)
--steps, -s       Training steps (default: 1000)
--hf-dataset      HuggingFace dataset ID (alternative to DATABASE_URL)
--min-agents-per-window  Minimum trajectories per window (default: 1)
```

## GPU Profiles

| Profile | GPU | VRAM | Model |
|---------|-----|------|-------|
| `12gb` | RTX 3060/4070 | 12GB | Qwen2.5-0.5B |
| `24gb` | RTX 4090 | 24GB | Qwen2.5-3B |
| `l40` | L40S | 48GB | Qwen2.5-7B |
| `a100` | A100 | 80GB | Qwen2.5-14B |
| `h100` | H100 | 80GB | Qwen2.5-14B |

## TEE Features

### Remote Attestation

Prove your code runs in a genuine TEE:

```python
from phala.scripts.attestation import attest_training_run

attestation = attest_training_run(
    run_id="training-2024-01-15",
    model_name="qwen2.5-7b",
    config={"steps": 1000}
)
```

### Key Derivation

TEE-derived keys are deterministic and bound to hardware + code:

```python
from phala.scripts.attestation import derive_key

key = derive_key(
    path="/babylon/models/encryption",
    subject="qwen2.5-7b-v1",
    size=32
)
```

### Secure Secrets

```python
from phala.scripts.secrets import BabylonSecrets

secrets = BabylonSecrets()

# Validation is trajectory-source aware
if secrets.validate():
    if secrets.trajectory_source == "db":
        db_url = secrets.database_url
    else:
        dataset_id = secrets.hf_trajectory_dataset

encryption_key = secrets.get_model_encryption_key("qwen2.5-7b")
```

## GPU Selection

Edit `docker-compose.yml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 2  # Number of GPUs
          capabilities: [gpu]
```

Available GPUs:
- NVIDIA H100 80GB - Fastest
- NVIDIA A100 80GB - Best for large models
- NVIDIA L40S 48GB - Good cost/performance
- NVIDIA RTX 4090 24GB - Budget option

## Troubleshooting

### Container Won't Start

```bash
python scripts/deploy.py status <app-id>
python scripts/deploy.py logs <app-id> --tail 200
```

### GPU Not Available

Verify in docker-compose.yml and Phala Console that GPU is allocated.

### Database Connection Failed

If your database isn't accessible from Phala Cloud, use HuggingFace dataset instead:

```bash
python scripts/deploy.py deploy \
  --hf-dataset elizaos/enkidu-trajectories-raw \
  --profile h100
```

### Attestation Unavailable

Ensure running in actual Phala CVM (not local Docker):
```python
from phala.scripts.attestation import is_tee_environment
print(is_tee_environment())  # Should be True
```

## Directory Structure

```
phala/
├── README.md              # This file
├── docker-compose.yml     # Deployment config
└── scripts/
    ├── deploy.py          # CLI wrapper
    ├── attestation.py     # TEE attestation
    ├── secrets.py         # Secret management
    └── tests/             # Unit tests
```

## Related

- [Master Environment Config](../env.example)
- [Docker Images](../docker/README.md)
- [RunPod Deployment](../runpod/README.md)
- [Phala Cloud Docs](https://docs.phala.com/)
