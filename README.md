<div align="center">

  <img src="docs/public/logo_full.svg" alt="Babylon Logo" width="600">

  <p><strong>A multiplayer prediction market game with autonomous AI agents and continuous RL training</strong></p>
  
  <p>
    <a href="https://github.com/BabylonSocial/babylon"><img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build Status"></a>
    <a href="https://github.com/BabylonSocial/babylon"><img src="https://img.shields.io/badge/tests-passing-brightgreen" alt="Tests"></a>
    <a href="https://docs.babylon.market"><img src="https://img.shields.io/badge/docs-available-blue" alt="Documentation"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript"></a>
    <a href="https://soliditylang.org/"><img src="https://img.shields.io/badge/Solidity-0.8-363636" alt="Solidity"></a>
  </p>

</div>

<div align="center">

  <img src="docs/public/game_preview.jpg" alt="Babylon Game Preview" width="800">

</div>

---

# 🎮 Babylon

A real-time prediction market game with autonomous NPCs, perpetual futures, and gamified social mechanics.

**NOTE**: This is currently in development. We expect to launch publicly around December 1st, 2025. This repo will change heavily in the meantime.

## 🏗️ Running Modes

Babylon can run in two modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Standalone** | Independent project with local Hardhat chain | Development, testing, standalone deployment |
| **Jeju Vendor** | Integrated with Jeju ecosystem | Production with decentralized compute, TEE, on-chain treasury |

---

## 📦 Standalone Installation

```bash
git clone https://github.com/BabylonSocial/babylon.git
cd babylon
bun install

# Setup environment & database
cp .env.example .env
bun run db:push
```

---

## 🚀 Standalone Quick Start

```bash
# 1. Install
bun install

# 2. Configure environment
cp .env.example .env
# (Optional) Create .env.local for Next.js-only overrides
# Edit .env with your OAuth3 service URL + GROQ_API_KEY

# 3. Setup database
bun run db:push
bun run db:seed

# 4. (Optional) Enable Agent0 Integration
# Add to .env:
# AGENT0_ENABLED=true
# BASE_SEPOLIA_RPC_URL=...
# BABYLON_GAME_PRIVATE_KEY=...
# Then configure Agent0: babylon agent agent0-config

# 5. Start development
bun run dev   # ← Automatically starts web + game engine!
```

Visit `http://localhost:5007` - everything runs and generates content automatically!

### What `bun run dev` Does

The unified development script (`dev-unified.ts`) starts:

1. **Elysia backend server** on port 5008
   - REST API endpoints
   - WebSocket realtime server
   - A2A/MCP protocol handlers
   - API documentation at http://localhost:5008/docs

2. **Next.js frontend** on port 5007
   - React web application
   - Connects to backend API automatically

### Alternative Development Modes

```bash
# Unified mode (recommended)
bun run dev              # Backend (5008) + Frontend (5007)

# Individual services
bun run dev:backend      # Elysia backend only
bun run dev:frontend     # Next.js frontend only

# Standalone mode (with local Docker services)
bun run dev:standalone   # Includes PostgreSQL, Redis, MinIO setup

# Jeju integrated mode
bun run dev:jeju         # Uses Jeju decentralized services
```

---

## 🌐 Jeju Vendor Mode

When running as part of the [Jeju](https://github.com/jeju-ai/jeju) ecosystem, Babylon gains:

- **Decentralized Database**: EQLite via Jeju DWS for persistent storage
- **Decentralized Compute**: GPU training via Jeju compute marketplace
- **On-chain Treasury**: Training audit trail on BabylonTreasury contract
- **TEE Execution**: Phala Network trusted execution
- **Decentralized Storage**: IPFS/Arweave via Jeju storage

### Running in Jeju

```bash
# From Jeju root, start Jeju first (provisions EQLite, DWS, etc.)
jeju dev

# Then run Babylon
cd vendor/babylon
bun run dev
```

Or start from Jeju root (if configured in jeju-manifest.json):
```bash
# From Jeju root
bun run dev:babylon
```

### Environment Detection

Babylon automatically detects its environment:

```typescript
// Standalone mode (default)
{
  mode: 'dev',
  hasJeju: false,
  storageMode: 'local',
  teeMode: 'simulated'
}

// Jeju production mode
{
  mode: 'production',
  hasJeju: true,
  storageMode: 'jeju',
  teeMode: 'phala'
}
```

### Key Environment Variables for Jeju

| Variable | Standalone | Jeju Production |
|----------|------------|-----------------|
| `NODE_ENV` | `development` | `production` |
| `USE_JEJU` | not set | `true` |
| `JEJU_NETWORK` | `localnet` | `mainnet` |
| `EQLITE_DATABASE_ID` | `babylon` | `babylon` |
| `BABYLON_TREASURY_ADDRESS` | not set | `0x...` (deployed contract) |
| `STORAGE_MODE` | `local` | `jeju` |
| `TEE_MODE` | `simulated` | `phala` |

**Database Configuration**: With `JEJU_NETWORK` set, the EQLite endpoint is automatically resolved from `@jejunetwork/config`. You can override with `EQLITE_BLOCK_PRODUCER_ENDPOINT` if needed.

### Training Pipeline

**Standalone**: Training runs locally via Python scripts
```bash
bun run train  # Spawns python3 directly
```

**Jeju**: Training runs on rented GPUs
```bash
USE_JEJU=true bun run train  # Rents GPU, runs in cloud, records on-chain
```

---

### Development Modes

**Default Mode** (Recommended):
```bash
bun run dev   # ← Web + Game Engine (both automatically!)
```
Runs web server plus the local cron simulator. Content is generated via cron endpoints every 60 seconds.

**Web Only** (UI/API only, no local cron simulator):
```bash
bun run dev:web   # Just Next.js, no daemon
```
Use if you're only working on frontend and don't need live cron-driven content.

### Real-Time Updates

The application uses **Server-Sent Events (SSE)** for real-time updates:
- Feed updates (new posts)
- Market price changes
- Breaking news
- Chat messages

**For Production:** Optionally set up Redis for cross-instance broadcasting:
```bash
REDIS_URL=redis://your-redis-instance:6379
```

---

## 🚀 Development

```bash
# Start dev server
bun run dev

# Build & test
bun run build
bun run typecheck
bun run lint
bun run test
```

Visit `http://localhost:5007`

---

## 🧪 Testing

```bash
bun run test:unit           # Unit tests
bun run test:integration    # Integration tests
bun run test:e2e           # E2E tests
bun run contracts:test     # Smart contracts
```

---

## 🚢 Deployment

### Contract Deployment

```bash
# Local (Hardhat)
babylon deploy local

# Testnet (Base Sepolia)
babylon deploy testnet

# Mainnet (Base) - requires --force flag
babylon deploy mainnet --force
```

### Decentralized Deployment (via Jeju)

Deploy frontend to IPFS/Arweave with JNS resolution:

```bash
# Build static site
bun run build:static

# Deploy to decentralized infrastructure
bun run deploy:frontend
```

**Required Environment Variables:**

- `JEJU_NETWORK` - Network: localnet, testnet, mainnet
- `EQLITE_BLOCK_PRODUCER_ENDPOINT` - EQLite endpoint (or auto-resolved via JEJU_NETWORK)
- `JEJU_OAUTH3_SERVICE_URL` - OAuth3 authentication service
- `OPENAI_API_KEY` or `GROQ_API_KEY` - AI agents

**Full Decentralized Config:**

```bash
# On-chain integration
BABYLON_TREASURY_ADDRESS=0x...  # Deployed BabylonTreasury contract
RPC_URL=https://rpc.jeju.ai     # Jeju mainnet RPC
PRIVATE_KEY=0x...               # Operator private key

# Decentralized compute
USE_JEJU=true                   # Enable Jeju compute marketplace

# TEE (Trusted Execution)
TEE_MODE=phala                  # Use Phala Network
PHALA_ENDPOINT=https://...      # Phala CVM endpoint

# Storage
STORAGE_MODE=jeju               # Use Jeju decentralized storage
JEJU_STORAGE_URL=https://...    # Jeju storage endpoint
```

See `.env.example` for complete list.

---

## 📚 Documentation

**[📖 Full Documentation →](https://docs.babylon.market)**

- Smart Contracts: `bun run deploy:local|testnet`
- RL Training: See `python/README.md`
- Game Control: `bun run game:start|pause|status`

---

## 📱 Farcaster Mini App Setup

Babylon is configured as a **Farcaster Mini App** with automatic authentication. Users opening your app from any Farcaster client (e.g., Warpcast) are logged in automatically!

### Prerequisites

- Jeju OAuth3 service configured
- Production deployment at `https://babylon.market`

### Configuration Steps

#### 1. Configure OAuth3 Authentication

Configure your Jeju OAuth3 service with:
- **Allowed origins**: `https://babylon.market`, `http://localhost:3000`
- **Farcaster callback URL**: `https://babylon.market/api/auth/farcaster/callback`

#### 2. Verify Environment Variables

Ensure these are set in production:

```bash
JEJU_OAUTH3_SERVICE_URL=https://auth.jeju.network
BABYLON_OAUTH3_APP_ID=babylon
```

#### 3. Deploy

```bash
vercel --prod
```

#### 4. Test in Farcaster

Create a cast in a Farcaster client (e.g., Warpcast):
```
Check out Babylon! 🏛️

https://babylon.market
```

Click to launch → Users are automatically logged in! ✨

### How It Works

1. **Mini App SDK** detects Farcaster context
2. **Auto-login** triggers via OAuth3 + `@farcaster/miniapp-sdk`
3. User approves once
4. **Instant authentication** - no forms or passwords!

### Using Mini App Context in Code

```typescript
import { useFarcasterMiniApp } from '@/components/providers/FarcasterFrameProvider'

function MyComponent() {
  const { isMiniApp, fid, username } = useFarcasterMiniApp()

  if (isMiniApp) {
    return <div>Welcome from Farcaster, {username}!</div>
  }

  return <div>Welcome to Babylon!</div>
}
```

### Key Resources

- **Farcaster Mini Apps**: https://miniapps.farcaster.xyz/
- **Jeju OAuth3 Docs**: https://docs.jeju.network/oauth3
- **Mini Apps SDK**: https://github.com/farcaster/miniapp-sdk
