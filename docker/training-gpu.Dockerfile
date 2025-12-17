# Babylon GPU Training Container
#
# GPU-optimized container for:
# - GRPO training with Atropos
# - vLLM inference for on-policy sampling
# - Model fine-tuning with LoRA
# - Large model inference
#
# Requires: NVIDIA GPU with 24GB+ VRAM (H100, H200, A100)
# Best deployed on: Phala H200 GPU nodes
#
# Build:
#   docker build -f docker/training-gpu.Dockerfile -t babylon-training-gpu .
#
# Run:
#   docker run --gpus all -e DATABASE_URL=... babylon-training-gpu

FROM nvidia/cuda:12.4.0-devel-ubuntu22.04 AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libpq-dev \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

WORKDIR /app

# Install PyTorch with CUDA
RUN pip3 install --no-cache-dir \
    torch>=2.1.0 \
    --index-url https://download.pytorch.org/whl/cu124

# Install GPU training dependencies
RUN pip3 install --no-cache-dir \
    transformers>=4.36.0 \
    peft>=0.8.0 \
    vllm>=0.3.0 \
    flash-attn>=2.0.0 \
    bitsandbytes>=0.41.0

# Copy and install Python requirements
COPY packages/training/python/requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# TypeScript dependencies
COPY package.json bun.lock* ./
COPY packages/training/package.json ./packages/training/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/
RUN bun install --production

# Copy source
COPY packages/training ./packages/training
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/api ./packages/api

# Create checkpoints directory
RUN mkdir -p /app/checkpoints /app/logs

# Create entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Verify GPU is available\n\
nvidia-smi || { echo "No GPU detected"; exit 1; }\n\
\n\
case "$1" in\n\
  "train-atropos")\n\
    echo "Starting Atropos GRPO training..."\n\
    python3 packages/training/python/scripts/run_training.py \\\n\
      --model "${MODEL_NAME:-Qwen/Qwen2.5-3B-Instruct}" \\\n\
      --steps "${TRAINING_STEPS:-100}" \\\n\
      --batch-size "${BATCH_SIZE:-4}" \\\n\
      --save-path /app/checkpoints\n\
    ;;\n\
  "train-tinker")\n\
    echo "Starting Tinker cloud training..."\n\
    python3 packages/training/python/scripts/run_tinker_training.py\n\
    ;;\n\
  "vllm")\n\
    echo "Starting vLLM inference server..."\n\
    python3 -m vllm.entrypoints.openai.api_server \\\n\
      --model "${MODEL_NAME:-Qwen/Qwen2.5-3B-Instruct}" \\\n\
      --port 8001 \\\n\
      --gpu-memory-utilization 0.9\n\
    ;;\n\
  "full-pipeline")\n\
    echo "Running full training pipeline..."\n\
    python3 packages/training/python/scripts/run_full_pipeline.py\n\
    ;;\n\
  "benchmark-gpu")\n\
    echo "Running GPU benchmarks..."\n\
    bun run packages/training/scripts/json-mode-benchmark.ts\n\
    ;;\n\
  "serve")\n\
    echo "Starting training API server..."\n\
    exec bun run packages/training/src/index.ts\n\
    ;;\n\
  *)\n\
    echo "Usage: $0 {train-atropos|train-tinker|vllm|full-pipeline|benchmark-gpu|serve}"\n\
    exit 1\n\
    ;;\n\
esac\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=0

# Ports: 8080 (API), 8001 (vLLM)
EXPOSE 8080 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["serve"]
