# Babylon Training Base Image
#
# Base image for all training containers with shared dependencies.
# This builds the Python and TypeScript runtimes for training.
#
# Build (from babylon root):
#   docker build -f packages/deployment/docker/training-base.Dockerfile -t babylon-training-base .

FROM python:3.11-slim AS python-base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Bun for TypeScript
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

WORKDIR /app

# Copy Python requirements
COPY packages/training/python/requirements.txt ./training-requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r training-requirements.txt

# Copy package.json files for TypeScript
COPY package.json bun.lock* ./
COPY packages/training/package.json ./packages/training/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/

# Install TypeScript dependencies
RUN bun install --production

# Copy source files
COPY packages/training ./packages/training
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/api ./packages/api

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Health check endpoint
EXPOSE 8080
