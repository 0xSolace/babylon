# Babylon CPU Training Container
#
# CPU-optimized container for:
# - Trajectory extraction and processing
# - Data ranking and scoring (RLAIF judge)
# - Benchmark execution
# - Model deployment and distribution
#
# Best deployed on: Standard CPU instances (e.g., c5.xlarge)
#
# Build (from babylon root):
#   docker build -f packages/deployment/docker/training-cpu.Dockerfile -t babylon-training-cpu .
#
# Run:
#   docker run -e DATABASE_URL=... -e OPENAI_API_KEY=... babylon-training-cpu

FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

WORKDIR /app

# Python dependencies (CPU only - no torch)
COPY packages/training/python/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

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

# Create entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
case "$1" in\n\
  "extract")\n\
    echo "Extracting trajectories..."\n\
    bun run packages/training/scripts/generate-trajectories.sh\n\
    ;;\n\
  "score")\n\
    echo "Scoring trajectories with RLAIF..."\n\
    bun run packages/training/scripts/test-scoring.ts\n\
    ;;\n\
  "benchmark")\n\
    echo "Running benchmarks..."\n\
    bun run packages/training/scripts/real-archetype-benchmark.ts\n\
    ;;\n\
  "deploy")\n\
    echo "Deploying model..."\n\
    bun run packages/training/scripts/test-trained-model.ts\n\
    ;;\n\
  "pipeline")\n\
    echo "Running full CPU pipeline..."\n\
    bun run packages/training/scripts/run-full-pipeline.ts\n\
    ;;\n\
  "serve")\n\
    echo "Starting API server..."\n\
    exec bun run packages/training/src/index.ts\n\
    ;;\n\
  *)\n\
    echo "Usage: $0 {extract|score|benchmark|deploy|pipeline|serve}"\n\
    exit 1\n\
    ;;\n\
esac\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["serve"]
