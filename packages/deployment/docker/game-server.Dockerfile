# Babylon Game Server Container
#
# The core game engine that runs prediction markets.
# Can be deployed decentralized via compute marketplace.
#
# Features:
# - Prediction market engine
# - Agent runtime management
# - SSE event streaming
# - Cron-based game tick execution
#
# Build (from babylon root):
#   docker build -f packages/deployment/docker/game-server.Dockerfile -t babylon-game .
#
# Run:
#   docker run -e DATABASE_URL=... -e RPC_URL=... babylon-game

FROM oven/bun:1-debian AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Dependencies
FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/
COPY packages/engine/package.json ./packages/engine/
COPY packages/agents/package.json ./packages/agents/
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/a2a/package.json ./packages/a2a/
COPY packages/mcp/package.json ./packages/mcp/
RUN bun install --production

# Builder
FROM base AS builder
COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/
COPY packages/engine/package.json ./packages/engine/
COPY packages/agents/package.json ./packages/agents/
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/a2a/package.json ./packages/a2a/
COPY packages/mcp/package.json ./packages/mcp/
RUN bun install

COPY . .
RUN bun run build

# Production
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN groupadd --gid 1001 babylon && \
    useradd --uid 1001 --gid babylon --create-home babylon

COPY --from=builder --chown=babylon:babylon /app ./

USER babylon

# Ports: 3000 (Next.js), 8080 (API)
EXPOSE 3000 8080

# ERC-8004 agent card endpoint
ENV AGENT_CARD_PATH="/.well-known/agent-card.json"

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["bun", "run", "start"]
