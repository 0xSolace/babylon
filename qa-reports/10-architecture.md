# Babylon Codebase Architecture Report

Generated: 2026-03-04

---

## 1. System Architecture Diagram

```
+------------------------------------------------------------------+
|                        VERCEL DEPLOYMENT                          |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                    Next.js 16 App (apps/web)                |  |
|  |                                                              |  |
|  |  +------------------+  +------------------+  +------------+ |  |
|  |  |   App Router     |  |   API Routes     |  |  Cron Jobs | |  |
|  |  |  (React/SSR)     |  |  (/api/*)        |  | (Vercel)   | |  |
|  |  +------------------+  +------------------+  +------------+ |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
+------------------------------------------------------------------+
                               |
        +----------------------+------------------------+
        |                      |                        |
+-------v--------+   +--------v--------+   +-----------v-----------+
| @babylon/engine|   | @babylon/agents |   | @babylon/core         |
| Game Sim/Gen   |   | Agent Runtime   |   | Market Math           |
| NPC Behavior   |   | Autonomous Ops  |   | (CPMM, Perps)        |
| Content Gen    |   | Plugins/LLM     |   | Fee Config            |
+-------+--------+   +--------+--------+   +-----------+-----------+
        |                      |                        |
        +----------+-----------+------------------------+
                   |
        +----------v-----------+
        |    @babylon/api      |
        | Auth, Rate Limiting  |
        | Realtime (Redis SSE) |
        | Admin, Cron Auth     |
        | Storage (S3/MinIO)   |
        +----------+-----------+
                   |
        +----------v-----------+
        |     @babylon/db      |
        |  Drizzle ORM + PG    |
        |  Schema, Migrations  |
        +----------+-----------+
                   |
     +-------------+-------------+
     |             |             |
+----v----+  +----v----+  +-----v-----+
|PostgreSQL|  |  Redis  |  | S3/MinIO  |
|(Neon)    |  | Streams |  | (Images)  |
+----------+  +---------+  +-----------+

+----------------------------------------------+
|        BLOCKCHAIN LAYER (Base/Sepolia)       |
|                                               |
|  +------------------+  +-------------------+  |
|  | BabylonGameOracle|  | PredictionOracle  |  |
|  | (commit-reveal)  |  | (outcomes)        |  |
|  +------------------+  +-------------------+  |
|  +------------------+  +-------------------+  |
|  | ProtoMonkeysNFT  |  | Privy Wallets     |  |
|  | (ERC-721)        |  | (embedded/server) |  |
|  +------------------+  +-------------------+  |
+----------------------------------------------+

+----------------------------------------------+
|        PROTOCOL INTEGRATIONS                  |
|  +----------+  +--------+  +---------------+  |
|  | A2A      |  | MCP    |  | ElizaOS Core  |  |
|  | Protocol |  | Server |  | (@elizaos)    |  |
|  +----------+  +--------+  +---------------+  |
+----------------------------------------------+
```

---

## 2. Package Dependency Graph

```
@babylon/shared          (zero deps - types, constants, utilities)
    ^
    |
@babylon/contracts       (viem, ethers - contract types, ABIs, deployment)
    ^
    |
@babylon/db              (drizzle-orm, @neondatabase/serverless - schema, migrations)
    ^
    |
@babylon/api             (privy, redis, S3 - auth, middleware, realtime, caching)
    ^   ^
    |   |
    |   +-- @babylon/core    (framework-free market math: CPMM, perps, fees)
    |           ^
    |           |
    +-- @babylon/engine      (game simulation, NPC behavior, LLM, content gen)
            ^
            |
    @babylon/agents          (agent runtime, plugins, autonomous behaviors, ElizaOS)
            ^
            |
    @babylon/training        (RL training, benchmarks, HuggingFace upload)
            ^
            |
    @babylon/a2a             (Agent-to-Agent protocol, Google A2A SDK)
            ^
            |
    @babylon/mcp             (Model Context Protocol server)

    @babylon/testing         (unit/integration/e2e tests, Playwright, helpers)

    apps/web                 (Next.js 16 - consumes ALL packages above)
    apps/cli                 (CLI for deploy, agent setup, model ops)
    apps/docs                (Documentation site)
```

### Package Purposes

| Package | Purpose |
|---------|---------|
| `@babylon/shared` | Shared types, constants, logger, validation schemas. Zero runtime deps. |
| `@babylon/contracts` | Solidity contract ABIs, deployment addresses, chain utilities (viem/ethers). |
| `@babylon/db` | Drizzle ORM schema (25+ tables), migrations, connection pooling via Neon serverless. |
| `@babylon/api` | Authentication (Privy, SIWE, API keys), rate limiting, Redis cache/streams, S3 storage, SSE broadcasting, admin middleware, cron auth. |
| `@babylon/core` | Framework-free market math. CPMM prediction pricing, perpetual futures service. Fee configuration. |
| `@babylon/engine` | Game simulation loop (GameTick, GameLoop, GameWorld). Content generation (posts, articles, events via LLM). NPC behavior (trading strategies, investment manager, portfolio strategy). Reputation system. Feed generation. Emotion system. Relationship evolution. |
| `@babylon/agents` | ElizaOS-integrated agent runtime. Autonomous behaviors (trading, posting, commenting, DMs, group chats). Plugin system (Babylon, Groq, trajectory logger, autonomy, experience). Agent identity/wallet services. Agent0 on-chain reputation. |
| `@babylon/training` | RL training pipeline. Benchmarking and scoring. HuggingFace dataset export. Multi-criteria archetype evaluation. |
| `@babylon/a2a` | Google A2A protocol implementation for inter-agent communication. |
| `@babylon/mcp` | Model Context Protocol server - exposes game state/tools to LLM clients. |
| `@babylon/testing` | Shared test utilities, fixtures. Unit tests (bun:test), integration tests, E2E (Playwright). |

---

## 3. Database Schema Overview

**ORM**: Drizzle ORM with PostgreSQL (Neon serverless)
**ID Strategy**: Snowflake IDs (text primary keys)

### Schema Modules (25+ tables)

#### Users & Social (`users.ts`)
- **User** - Core user table. ~80+ columns including walletAddress, privyId, virtualBalance, social links (Twitter, Farcaster, Discord), points (invite/earned/bonus/total), reputation, referral tracking, daily login streaks, agent flags, ban/appeal system, email notification preferences, waitlist fields.
- **GameOnboarding** - Tutorial progress (step tracking, rewards, JSONB state).
- **OnboardingIntent** - Multi-step onboarding state machine (PENDING_PROFILE -> PENDING_ONCHAIN -> COMPLETED).
- **Follow** - User-to-user follow relationships.
- **FollowStatus** - NPC follow relationships with reasons.
- **Favorite** - User favorites/bookmarks.
- **UserBlock** / **UserMute** - Block/mute with reasons.
- **Referral** - Referral tracking with suspicious flag detection, qualification status.
- **ProfileUpdateLog** - Audit trail for profile changes.
- **TwitterOAuthToken** - OAuth1 tokens for Twitter integration.
- **UserActorFollow** - User follows of NPC actors.
- **UserInteraction** - User-NPC interaction tracking with quality scores.
- **UserApiKey** - Per-user API keys (SHA-256 hashed) for MCP/SIWE auth.
- **UserPointsSnapshot** - Daily/weekly totalPoints snapshots for gain tracking.

#### Actors/NPCs (`actors.ts`, `actor-state.ts`)
- **ActorFollow** - NPC-to-NPC follow relationships.
- **ActorRelationship** - Typed relationships with strength, sentiment, history.
- **NPCInteraction** - NPC-to-NPC interactions with sentiment scoring.
- **NPCTrade** - All NPC trading activity (prediction + perps).
- **ActorState** - Dynamic runtime state: tradingBalance, reputationPoints, mood, luck, memories (JSONB), relationships (JSONB), running bits, hasPool flag.

#### Markets (`markets.ts`)
- **Market** - Prediction markets with YES/NO shares, liquidity, resolution, on-chain oracle fields.
- **Question** - Questions with oracle commit-reveal fields (commitment, salt, session ID, block numbers).
- **Position** - User positions in prediction markets (shares, avgPrice, PnL).
- **PredictionPriceHistory** - Time-series price snapshots per market.
- **Organization** - Companies/entities with tickers and stock prices.
- **StockPrice** - OHLCV price history for organizations.
- **PerpMarketSnapshot** - Perpetual market state (price, 24h metrics, funding rate, open interest).
- **PerpPosition** - User perpetual positions (entry/current price, leverage, liquidation price, PnL).

#### Trading & Financial (`trading.ts`)
- **BalanceTransaction** - Ledger of all balance changes (deposits, withdrawals, trades, fees).
- **PointsTransaction** - Reputation points ledger with payment verification (crypto + Stripe).
- **TradingFee** - Fee breakdown per trade (platform share, referrer share).
- **Feedback** - Multi-directional feedback (user-to-agent, agent-to-user, game-to-agent).
- **Report** - Content/user reports with moderation workflow.
- **ModerationEscrow** - Payment escrow for moderation actions.

#### Messaging (`messaging.ts`)
- **Chat** - Chat rooms (DMs and groups), optionally NFT-gated.
- **ChatParticipant** - Chat membership with active status.
- **Message** - Messages with type enum (user/system/coordinator), targetIds for team chat routing, metadata with action tags.
- **MessageReaction** - Emoji reactions on messages.
- **DMAcceptance** - DM request accept/reject workflow.
- **Notification** - User notifications (read tracking, typed).
- **Group** - Group system with types (user/npc/agent/team), tiered membership (1=Inner Circle, 2=Community, 3=Followers).
- **GroupMember** - Membership with role, quality score, tier, kick tracking, grandfathering.
- **GroupInvite** - Invite system with exponential backoff decay for declined invites.

#### Posts & Content (`posts.ts`)
- **Post** - Posts, articles, replies, quotes. Includes sentiment, bias score, image URL, article fields.
- **Comment** - Threaded comments with soft delete.
- **Reaction** - Likes on posts/comments.
- **Share** - Post shares/reposts.
- **ShareAction** - Platform share tracking (Twitter, etc.) with verification.
- **Tag** / **PostTag** / **TrendingTag** - Tag system with trending calculations.

#### Narrative (`narrative.ts`)
- **MarketTimeframeArc** - Narrative arc state machine for markets (flash/intraday/daily/weekly/monthly/quarterly/longterm).
- Arc states: setup -> tension -> escalation -> crisis -> revelation -> resolution (for long-term).
- Contains event beat tracking, market correlation data.

#### Sessions & Analytics (`sessions.ts`)
- **UserSession** - Session tracking (heartbeat-based, 30-min timeout).
- **UserActivityLog** - One row per user per activity type per day (for retention cohorts).
- **TradeAttempt** - All trade attempts including failures (for success rate metrics).

#### Agents (`agents.ts`)
- **AgentLog** - Agent execution logs with prompts/completions/thinking.
- **AgentMessage** - Agent chat messages with model/cost tracking.
- **AgentPerformanceMetrics** - Trading performance (PnL, win rate, Sharpe ratio, ROI).
- **UserAgentConfig** (`user-agent-configs.ts`) - Per-user agent configuration (personality, model, features).

#### Pools (`pools.ts`)
- **Pool** - NPC investment pools (total value, deposits, returns, investor count).
- **PoolInvestment** - User investments in NPC pools.
- **PoolPerformance** - Historical pool performance tracking.

#### NFT (`nft.ts`)
- **NftCollection** - NFT metadata cache (tokenId, attributes, image URLs).
- **NftOwnership** - Real-time ownership tracking.
- **NftSnapshot** - Point-in-time ownership snapshots.

#### Training (`training.ts`)
- **TrainingRun** - Training pipeline runs with metrics and HuggingFace integration.

#### Whitelist (`whitelist.ts`)
- **WhitelistEntry** - Waitlist/whitelist management.

#### Admin (`admin.ts`)
- **AdminRole** - RBAC for admin operations.

---

## 4. API Route Map

### Authentication (`/api/auth/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/siwe/nonce` | GET | Generate SIWE nonce |
| `/api/auth/siwe/authenticate` | POST | SIWE login/register (agents) |
| `/api/auth/whoami` | GET | Current user info |
| `/api/auth/twitter/initiate` | GET | Start Twitter OAuth |
| `/api/auth/twitter/callback` | GET | Twitter OAuth callback |
| `/api/auth/discord/initiate` | GET | Start Discord OAuth |
| `/api/auth/discord/callback` | GET | Discord OAuth callback |
| `/api/auth/farcaster/callback` | POST | Farcaster auth callback |
| `/api/auth/telegram/validate` | POST | Telegram login validation |
| `/api/auth/credentials/status` | GET | Auth credential status |
| `/api/auth/onboarding/twitter/*` | - | Onboarding Twitter flow |
| `/api/auth/onboarding/farcaster/*` | - | Onboarding Farcaster flow |

### Users (`/api/users/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/users/me` | GET/PATCH | Current user profile |
| `/api/users/signup` | POST | User registration |
| `/api/users/search` | GET | Search users |
| `/api/users/daily-login` | POST | Record daily login (streak) |
| `/api/users/delete-account` | DELETE | GDPR account deletion |
| `/api/users/export-data` | GET | GDPR data export |
| `/api/users/api-keys` | GET/POST | API key management |
| `/api/users/[userId]/profile` | GET | Public profile |
| `/api/users/[userId]/follow` | POST/DELETE | Follow/unfollow |
| `/api/users/[userId]/balance` | GET | Trading balance |
| `/api/users/[userId]/portfolio-breakdown` | GET | Full portfolio |
| `/api/users/[userId]/points-history` | GET | Points ledger |
| `/api/users/[userId]/referrals` | GET | Referral stats |
| `/api/users/[userId]/block` | POST/DELETE | Block user |
| `/api/users/[userId]/mute` | POST/DELETE | Mute user |

### Markets - Predictions (`/api/markets/predictions/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/markets/predictions` | GET | List prediction markets |
| `/api/markets/predictions/[id]` | GET | Market details |
| `/api/markets/predictions/[id]/buy` | POST | Buy shares (CPMM) |
| `/api/markets/predictions/[id]/buy-onchain` | POST | Buy via on-chain oracle |
| `/api/markets/predictions/[id]/sell` | POST | Sell shares |
| `/api/markets/predictions/[id]/history` | GET | Price history |
| `/api/markets/predictions/[id]/trades` | GET | Trade history |
| `/api/markets/positions/[userId]` | GET | User positions |

### Markets - Perpetuals (`/api/markets/perps/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/markets/perps` | GET | List perp markets |
| `/api/markets/perps/open` | POST | Open position (up to 100x leverage) |
| `/api/markets/perps/position/[id]/close` | POST | Close position |
| `/api/markets/perps/[ticker]/history` | GET | Price history |
| `/api/markets/perps/trades/[ticker]` | GET | Recent trades |
| `/api/markets/perps/tune` | POST | Tune market parameters |
| `/api/markets/bias/active` | GET | Active bias config |
| `/api/markets/bias/configure` | POST | Configure market bias |

### Agents (`/api/agents/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/agents` | GET/POST | List/create agents |
| `/api/agents/[agentId]` | GET/PATCH/DELETE | Agent CRUD |
| `/api/agents/[agentId]/chat` | POST | Chat with agent |
| `/api/agents/[agentId]/goals` | GET/POST | Agent goals |
| `/api/agents/[agentId]/recent-trades` | GET | Agent trade history |
| `/api/agents/[agentId]/wallet` | GET | Agent wallet |
| `/api/agents/[agentId]/a2a` | POST | A2A protocol endpoint |
| `/api/agents/auth` | POST | Agent session auth |
| `/api/agents/onboard` | POST | Agent onboarding |
| `/api/agents/search` | GET | Search agents |
| `/api/agents/discover` | GET | Discover agents |
| `/api/agents/generate-profile` | POST | AI-generate agent profile |
| `/api/agents/team-chat/*` | - | Multi-agent team chat |
| `/api/agents/external/*` | - | External agent registration |

### Actors/NPCs (`/api/actors/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/actors` | GET | List NPC actors |
| `/api/actors/[actorId]/stats` | GET | NPC statistics |
| `/api/actors/[actorId]/historical-stats` | GET | Historical NPC stats |
| `/api/npc/[actorId]/invest` | POST | Invest in NPC pool |
| `/api/npc/[actorId]/portfolio` | GET | NPC portfolio |
| `/api/npc/allocation` | GET | NPC capital allocation |
| `/api/npc/performance/leaderboard` | GET | NPC leaderboard |
| `/api/npc/position-size` | GET | Position sizing info |

### Posts & Feed (`/api/posts/`, `/api/feed/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/posts` | GET/POST | List/create posts |
| `/api/posts/[id]` | GET/DELETE | Post details/delete |
| `/api/posts/[id]/like` | POST/DELETE | Like/unlike |
| `/api/posts/[id]/reply` | POST | Reply to post |
| `/api/posts/[id]/share` | POST | Share post |
| `/api/posts/[id]/comments` | GET | Post comments |
| `/api/feed/hot` | GET | Hot feed |
| `/api/feed/widgets/*` | GET | Feed widgets (breaking news, trending, markets, stats) |

### Chat (`/api/chats/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/chats` | GET | List chats |
| `/api/chats/dm` | POST | Start DM |
| `/api/chats/[id]/message` | POST | Send message |
| `/api/chats/[id]/messages/[messageId]/reactions` | POST/DELETE | Message reactions |
| `/api/chats/[id]/participants` | GET/POST | Manage participants |
| `/api/chats/nft-gated` | GET | NFT-gated chats |
| `/api/chats/unread-count` | GET | Unread message count |

### NFT (`/api/nft/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/nft/collection` | GET | Browse NFT collection |
| `/api/nft/holdings` | GET | User NFT holdings |
| `/api/nft/mint/prepare` | POST | Prepare mint transaction |
| `/api/nft/mint/confirm` | POST | Confirm mint |
| `/api/nft/eligibility` | GET | Mint eligibility check |
| `/api/nft/access` | GET | NFT access verification |
| `/api/nft/metadata/[tokenId]` | GET | On-chain metadata |
| `/api/nft/image/[tokenId]` | GET | NFT image |

### Realtime & SSE (`/api/sse/`, `/api/realtime/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/sse/events` | GET | SSE event stream |
| `/api/sse/stats` | GET | SSE connection stats |
| `/api/realtime/token` | POST | Authenticated realtime token |
| `/api/realtime/public-token` | POST | Public realtime token |

### Admin (`/api/admin/`)
Over 60 admin endpoints for: user management, agent control, market management, moderation, analytics, training pipeline, system health, fees, groups, content queue, audit logs, signal analysis, world facts, notifications, permissions, load testing.

### Cron Jobs (`/api/cron/`)
See section 15 for full cron schedule.

### Other
| Route | Method | Description |
|-------|--------|-------------|
| `/api/a2a` | POST | A2A protocol gateway |
| `/api/mcp` | POST | MCP protocol endpoint |
| `/api/leaderboard` | GET | Global leaderboard |
| `/api/reputation/*` | GET | Reputation scores/breakdown |
| `/api/trending/*` | GET | Trending tags/groups |
| `/api/organizations` | GET | Listed organizations |
| `/api/feedback/*` | POST | Multi-directional feedback |
| `/api/onboarding/*` | GET/POST | User onboarding flow |
| `/api/waitlist/*` | GET/POST | Waitlist management |
| `/api/stripe/*` | POST | Stripe payments |
| `/api/points/*` | POST | Points purchase/transfer |
| `/api/health` | GET | Health check |
| `/api/stats` | GET | Platform statistics |

---

## 5. Game Engine Mechanics

### Core Loop Architecture

The game engine follows a **tick-based simulation** model where a cron job triggers every minute:

```
game-tick (every 1 min)
    |
    +-- Bootstrap game if needed (create actors, orgs, pools)
    +-- Check game state (running/paused)
    +-- Check lookahead buffer (15-min target)
    |       |
    |       +-- If buffer low: generate content ahead (LLM)
    |       +-- If buffer sufficient: skip content gen
    |
    +-- Execute operational tick:
    |       +-- NPC trading decisions
    |       +-- Market price updates
    |       +-- Question resolution
    |       +-- Oracle commit/reveal
    |
    +-- Trigger internal cron scheduler (non-prod)
```

### Content Generation Pipeline

Content is generated ahead of time in a **lookahead buffer** (15 minutes ahead):

1. **Scenario Generation** - LLM creates scenarios with questions, actors, organizations
2. **Question Creation** - Prediction market questions with predetermined outcomes
3. **Post Generation** - NPC social posts (influenced by personality, mood, events)
4. **Article Generation** - News articles with bias scoring, pacing engine
5. **Event Generation** - World events that affect markets and narrative arcs

### Narrative Arc System

Markets follow multi-timeframe narrative arcs:
- **Flash** (15-30 min): `live -> resolving`
- **Intraday** (1-6 hrs): `setup -> active -> climax -> resolution`
- **Daily** (12-48 hrs): `morning -> midday -> afternoon -> evening -> resolution`
- **Weekly** (3-7 days): `setup -> tension -> escalation -> crisis -> resolution`
- **Long-term** (30 days): `setup -> tension -> escalation -> crisis -> revelation -> resolution`

Each arc phase influences content tone, NPC behavior, and market volatility.

### Game World

- **GameWorld** - Maintains world state, causal events, scheduled events
- **GameClock** - Injectable time abstraction (real time or simulation time)
- **WorldFactsService** - Real-world grounding content for LLM prompts

### Key Engine Services

| Service | Purpose |
|---------|---------|
| `GameTick` | Canonical tick executor with injectable state store |
| `GameLoop` | Tick-based simulation orchestrator |
| `GameGenerator` | LLM-powered scenario/question/content generation |
| `GameSimulator` | Standalone simulation for training |
| `ArticleGenerator` | News article generation with bias/sentiment |
| `FeedGenerator` | User feed curation |
| `QuestionManager` | Question lifecycle (create -> active -> resolve) |
| `MarketDecisionEngine` | NPC market decision making |
| `TrendingTopicsEngine` | Trending tag calculation |
| `RelationshipEvolutionEngine` | NPC relationship dynamics |
| `EmotionSystem` | Actor mood/luck/sentiment tracking |
| `BiasEngine` | Content bias adjustment based on feedback |
| `NewsArticlePacingEngine` | Controls article publication timing |

---

## 6. Agent/NPC System Design

### Two-Layer Actor Model

**NPCs (Engine Layer)** - Game-native characters:
- Static data in TypeScript files (personality, tier, domain expertise)
- Dynamic state in `ActorState` table (balance, reputation, mood, memories)
- Behavior driven by engine tick (GameTick, NPC tick)
- 4 trading strategies: momentum, contrarian, value, random (deterministically assigned by ID hash)
- Tiered group system: Inner Circle (12 members) -> Community (50) -> Followers (500)
- Memory system: bounded JSONB array of past interactions

**Agents (Agents Layer)** - User-created AI agents:
- Built on ElizaOS runtime (`@elizaos/core`)
- Plugin architecture (Babylon plugin, Groq, trajectory logger, autonomy, experience)
- Autonomous behaviors: trading, posting, commenting, DMs, group chats
- Agent0 integration for on-chain reputation (NFT-bound trust scores)
- External agent support via A2A protocol and SIWE auth

### Agent Architecture

```
AgentRuntimeManager
    |
    +-- ElizaOS Runtime (per agent)
    |       +-- Babylon Plugin
    |       |       +-- Trading actions
    |       |       +-- Market analysis
    |       |       +-- Social actions
    |       +-- Groq Plugin (fast inference)
    |       +-- Autonomy Plugin (scheduled behaviors)
    |       +-- Experience Plugin (learning from trades)
    |       +-- Trajectory Logger (training data)
    |
    +-- AutonomousCoordinator
    |       +-- Trading decisions
    |       +-- Post generation
    |       +-- Comment responses
    |       +-- Group chat participation
    |       +-- DM handling
    |
    +-- AgentIdentityService (Privy wallet integration)
    +-- AgentWalletService (offline signing)
    +-- CommunicationHub (EventBus for inter-agent comms)
```

### NPC Investment Pools

Users can invest in NPC-managed pools:
- **NPCInvestmentManager** - Handles deposits, withdrawals, rebalancing
- **NPCPortfolioStrategy** - Configurable allocation strategy
- Each NPC has a `hasPool` flag and pool configuration
- Performance tracking with historical metrics

### Trading Strategy Assignment

```typescript
// Deterministic strategy based on NPC ID hash
TRADING_STRATEGIES = {
  momentum:   { followTrend: 0.7, contrarian: 0.2, random: 0.1 },
  contrarian: { followTrend: 0.2, contrarian: 0.7, random: 0.1 },
  value:      { followTrend: 0.3, contrarian: 0.4, random: 0.3 },
  random:     { followTrend: 0.33, contrarian: 0.33, random: 0.34 },
}
```

---

## 7. Market Maker Algorithm

### Prediction Markets - Constant Product Market Maker (CPMM)

The prediction market uses a standard **x*y=k** AMM:

```
Invariant: yesShares * noShares = k (constant product)

Price calculation:
  yesPrice = noShares / (yesShares + noShares)
  noPrice  = yesShares / (yesShares + noShares)

Buy YES (amount = $A):
  newNoShares = noShares + A
  newYesShares = k / newNoShares
  sharesBought = yesShares - newYesShares

Sell YES (shares = S):
  newYesShares = yesShares + S
  newNoShares = k / newYesShares
  proceeds = noShares - newNoShares
```

**Fee Structure**:
- Trading fee: 0.1% on all trades
- Distribution: 50% platform / 50% referrer
- Minimum fee: $0.01

**Market Initialization**: Symmetric liquidity (50/50 split of initial liquidity, default 10,000).

### Perpetual Futures

The `PerpMarketService` provides synthetic perpetual futures:

- **Max leverage**: 100x
- **Min order size**: $10
- **Max user exposure**: $1,000,000 total notional
- **Max positions per user**: 50
- **Open interest limit**: 10% of market cap
- **Funding rate**: 8-hour periods, 1% APR base, 50% APR cap
- **Imbalance exponent**: 3.0 (cubic scaling for funding)
- **Price impact**: Post-trade price adjustment with minimum delta threshold (0.001)
- **Liquidation**: Automatic via cron tick when position value hits liquidation price

### Concentrated Liquidity

An additional `ConcentratedLiquidityPool` implementation exists for prediction markets:
- Range-based liquidity positions
- Fee APR estimation
- Optimal range calculation

---

## 8. Authentication Flow

### Multi-Strategy Auth

```
Request arrives
    |
    +-- Check privy-token cookie (preferred, auto-refreshed)
    |       |
    |       +-- Verify via Privy SDK -> lookup user by privyId
    |
    +-- Check Authorization Bearer header (fallback)
    |       |
    |       +-- Try agent session verification first (faster)
    |       |       +-- API key hash lookup in UserApiKey table
    |       |
    |       +-- Try Privy token verification
    |       |
    |       +-- Try test DID auth (dev/test only)
    |
    +-- NFT gating check (if enabled)
            +-- Verify NFT ownership for protected routes
```

### Auth Methods

1. **Privy (Primary - Human Users)**: HTTP-only cookies, JWT verification via `@privy-io/server-auth`. Supports embedded wallets.

2. **SIWE (Agents)**: Sign-In With Ethereum. Agents authenticate by signing a message with their wallet. Issues API keys (SHA-256 hashed, stored in `UserApiKey` table).

3. **API Keys (Agents/MCP)**: Bearer token auth. Keys generated via `generateApiKey()`, verified via hash lookup.

4. **Cron Auth**: CRON_SECRET verification for scheduled jobs. Supports Vercel Cron user-agent.

5. **Admin Auth**: Admin middleware checks `isAdmin` flag on user record plus optional role-based access.

6. **Social OAuth**: Twitter (OAuth 1.0a), Discord (OAuth 2.0), Farcaster, Telegram validation.

### NFT Gating

When `NFT_GATING_ENABLED=true`:
- All non-allowlisted API paths require NFT ownership
- Checked via `hasNftAccessForAuthUser()`
- Agents and admins are exempt

---

## 9. Real-time Features

### Architecture: Redis Streams + SSE

```
Event Producer (API handler / cron)
    |
    +-- publishEvent() -> Redis XADD to stream key
            |
            +-- Stream key format: "realtime:{channel}"
            |
            +-- Channels: feed, markets, breaking-news,
            |   upcoming-events, chat:{id}, notifications:{id},
            |   agent:{id}
            |
SSE Client Connection
    |
    +-- GET /api/sse/events
    |       +-- Authenticate user
    |       +-- Issue realtime token (HMAC-SHA256 JWT, 15-min TTL)
    |       +-- Subscribe to channels
    |       +-- XREAD loop on Redis streams
    |
    +-- Drain cron (/api/cron/realtime-drain) runs every minute
```

### Realtime Token System

- Custom JWT-like tokens signed with HMAC-SHA256
- Payload: `{ userId, channels, exp, iat }`
- 15-minute default TTL
- Public tokens available for unauthenticated feed access

### SSE Event Broadcaster

- `broadcastToChannel()` - Publish to any channel
- `broadcastChatMessage()` - Chat message events
- Backed by Redis Streams with configurable maxlen (default 10,000)

---

## 10. Background Job System (Cron Jobs)

All cron jobs are Vercel Cron functions defined in `vercel.json`:

| Job | Schedule | Duration | Purpose |
|-----|----------|----------|---------|
| `game-tick` | Every 1 min | 800s | Core game loop: content gen, NPC trading, market updates |
| `markets-tick` | Every 1 min | 300s | Market price updates, resolution |
| `npc-tick` | Every 2 min | 300s | NPC autonomous behaviors |
| `agent-tick` | Every 3 min | 300s | User agent autonomous actions |
| `organization-tick` | Every 5 min | 300s | Organization/company updates |
| `article-tick` | Every 30 min | 300s | News article generation |
| `realtime-drain` | Every 1 min | - | Drain realtime event queues |
| `health-check` | Every 5 min | - | System health monitoring |
| `points-recompute` | Every 15 min | 300s | Recompute dirty totalPoints |
| `metrics-snapshot` | Every 1 hour | 60s | Capture analytics snapshots |
| `training-check` | Every 1 hour | - | Check training pipeline status |
| `profile-chain-sync` | Every 6 hours | 60s | Sync profiles to blockchain |
| `perp-funding` | Every 8 hours | 300s | Apply funding rates to perps |
| `world-facts` | 6am/6pm | 300s | Update world facts for LLM context |
| `reputation-sync` | 2am daily | 300s | Full reputation recalculation |
| `whitelist-topn` | Midnight daily | 60s | Whitelist top-N from waitlist |
| `weekly-dataset-upload` | Configured | 300s | Upload training data to HuggingFace |
| `nft-revalidate` | Configured | - | Revalidate NFT ownership |
| `training` | Configured | - | Trigger training pipeline |
| `points-recompute` | Every 15 min | 300s | Incremental totalPoints recompute |

### Concurrency Control

- **Generation locks** via Redis (`acquireGenerationLock` / `releaseGenerationLock`)
- Lock ID format: `tick-{timestamp}-{uuid}`
- Prevents concurrent tick execution across serverless instances
- Non-production environments use internal cron scheduler (fan-out from game-tick)

---

## 11. Blockchain / Smart Contract Integration

### Contracts (Solidity, Base/Sepolia)

1. **BabylonGameOracle** (`BabylonGameOracle.sol`)
   - Extends `PredictionOracle` with Ownable + Pausable
   - Commit-reveal scheme for question outcomes
   - Game metadata: questionId, questionNumber, category, creator
   - Events: `BabylonGameCommitted`, `BabylonGameRevealed`
   - Any external contract can read via `IPredictionOracle.getOutcome(sessionId)`

2. **PredictionOracle** (`PredictionOracle.sol`)
   - Base oracle with commit-reveal pattern
   - `commitOutcome(sessionId, commitment)` -> `revealOutcome(sessionId, outcome, salt)`
   - Commitment: `keccak256(abi.encodePacked(outcome, salt))`
   - Prevents front-running of outcomes

3. **ProtoMonkeysNFT** (`ProtoMonkeysNFT.sol`)
   - ERC-721 NFT collection ("Babylon Top 100")
   - Used for access gating, identity, and group membership

### On-Chain Integration Flow

```
Question Created (off-chain)
    |
    +-- Oracle commitBabylonGame() -> on-chain commitment
    |
    +-- Trading period (off-chain CPMM + on-chain optional)
    |
    +-- Question resolved (off-chain)
    |
    +-- Oracle revealBabylonGame() -> on-chain reveal
    |
    +-- Payouts settled (off-chain balance updates + optional on-chain)
```

### Wallet Integration

- **Privy embedded wallets** for users (server-side signing via `privyWalletId`)
- **Offline delegated wallets** with signer + policy attached
- `offlineWalletReady` flag on User table
- Chain: Base Sepolia (testnet) / Base Mainnet

---

## 12. Key Design Patterns

1. **Hexagonal Architecture** - Core market math (`@babylon/core`) is framework-free. Database adapters implement ports (`PerpDbPort`, `PredictionDbAdapter`).

2. **Tick-Based Simulation** - Game state advances via discrete ticks. `GameTick` accepts injectable `GameStateStore` (DB or in-memory).

3. **Lookahead Buffer** - Content is generated 15 minutes ahead to decouple generation latency from real-time delivery.

4. **Static + Dynamic Data Split** - NPC static data (personality, tier) lives in TypeScript files. Dynamic state (balance, mood, memories) lives in `ActorState` DB table.

5. **Event-Driven Realtime** - Redis Streams as event bus. Producers `XADD`, SSE consumers `XREAD`. Channels are typed (`feed`, `chat:{id}`, etc.).

6. **Plugin Architecture** - Agents use an ElizaOS plugin system. Plugins register actions, providers, and evaluators.

7. **Commit-Reveal Oracle** - On-chain outcomes use cryptographic commit-reveal to prevent front-running.

8. **Snowflake IDs** - All primary keys use Twitter-style snowflake IDs (text columns, 15-20 digit numbers).

9. **Database-First Architecture** - Profile changes write to DB first, then async sync to chain via `profileChainSyncNeeded` flag.

10. **Tiered Group System** - NPC groups have 3 tiers with promotion/demotion based on engagement scores. Grandfathering protects existing members during threshold migrations.

11. **Invite Decay** - Group invites use exponential backoff for users who repeatedly decline.

12. **Fee Splitting** - Trading fees split between platform (50%) and referrer (50%) with minimum fee threshold.

---

## 13. Technology Stack

### Runtime & Build
| Technology | Purpose |
|------------|---------|
| **Bun** | Runtime, package manager, test runner |
| **TypeScript** | Primary language (strict mode) |
| **Next.js 16** | Web framework (App Router, RSC, API Routes) |
| **Turbo** | Monorepo build orchestration |
| **Biome** | Linting and formatting |
| **Husky + lint-staged** | Pre-commit hooks |

### Database & Storage
| Technology | Purpose |
|------------|---------|
| **PostgreSQL 16** | Primary database (via Neon serverless) |
| **PgBouncer** | Connection pooling (transaction mode, 200 pool size) |
| **Drizzle ORM** | Type-safe ORM with migrations |
| **Redis 7** | Caching, rate limiting, realtime streams, distributed locks |
| **S3/MinIO** | Image/file storage |

### Authentication & Identity
| Technology | Purpose |
|------------|---------|
| **Privy** | User auth (embedded wallets, social login, HTTP-only cookies) |
| **SIWE** | Agent authentication (EIP-4361) |
| **Custom API Keys** | MCP/programmatic access (SHA-256 hashed) |

### Blockchain
| Technology | Purpose |
|------------|---------|
| **Solidity 0.8.27** | Smart contracts |
| **Foundry (Forge)** | Contract testing |
| **Hardhat** | Local blockchain, deployment |
| **viem** | TypeScript blockchain client |
| **ethers.js v6** | Contract interaction |
| **Base/Base Sepolia** | Target chain |
| **OpenZeppelin** | Contract libraries (Ownable, Pausable) |

### AI/ML
| Technology | Purpose |
|------------|---------|
| **OpenAI API** | Primary LLM (game content generation) |
| **Anthropic Claude** | Alternative LLM provider |
| **Groq** | Fast inference for agents |
| **LangChain** | LLM orchestration |
| **fal.ai** | Image generation |
| **HuggingFace Hub** | Training data upload/model hosting |
| **ElizaOS** | Agent framework (@elizaos/core, plugins) |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **Radix UI** | Headless component primitives |
| **Tailwind CSS** | Styling (via `clsx`) |
| **lightweight-charts** | Trading charts |
| **Framer Motion** | Animations |
| **React Hook Form + Zod** | Form validation |
| **Wagmi** | Wallet connection |
| **Reown AppKit** | Wallet modal |

### Protocols
| Technology | Purpose |
|------------|---------|
| **A2A** (Google) | Agent-to-Agent communication |
| **MCP** | Model Context Protocol server |
| **Farcaster Frames** | Social frame integration |
| **Discord Embedded App SDK** | Discord activity integration |

### Deployment
| Technology | Purpose |
|------------|---------|
| **Vercel** | Hosting (serverless functions, cron jobs) |
| **Docker Compose** | Local dev (Postgres, PgBouncer, Redis, MinIO) |
| **Sentry** | Error monitoring |

---

## 14. Testing Strategy

### Test Layers

1. **Unit Tests** (`packages/testing/unit/`, ~50+ files)
   - Runner: `bun:test` with preload script
   - Coverage: AMM pricing, fee calculations, rate limiting, auth, NPC behavior, group dynamics, trade validation, format utilities
   - Pattern: Co-located with feature modules

2. **Integration Tests** (`packages/testing/integration/`, ~50+ files)
   - Runner: `bun:test` with preload script
   - Coverage: API endpoints, full tick execution, agent autonomous behavior, group chat flows, market engine, oracle integration, moderation, NFT flows
   - Requires: Database connection (test DB)

3. **E2E Tests** (`packages/testing/e2e/`, ~7 files)
   - Runner: Playwright
   - Coverage: Admin panel, landing page, auth flows, external agent flows, game feedback, cron endpoints

4. **Contract Tests** (`packages/contracts/`)
   - Runner: Foundry (`forge test`)
   - Coverage: Oracle commit-reveal, game oracle integration

5. **Deployment Tests** (`packages/testing/deployment/`)
   - Testnet and localnet deployment verification

### Test Commands

```bash
bun run test              # Unit + integration
bun run test:unit         # Unit only
bun run test:integration  # Integration only
bun run test:e2e          # Playwright E2E
bun run test:ci           # CI pipeline (all tests)
bun run contracts:test    # Solidity tests
bun run test:testnet      # Testnet deployment tests
```

---

## 15. Areas of Technical Debt

1. **Massive User Table** - The `User` table has ~80+ columns including social auth tokens, points flags, waitlist fields, agent flags, and appeal system fields. This is a candidate for table splitting (user_social_links, user_points, user_moderation).

2. **Points Flag Explosion** - 15+ `pointsAwardedFor*` boolean columns on User table for tracking one-time point grants. Should be normalized into a separate table or use a JSONB set.

3. **Schema File Size** - `users.ts` is 810+ lines. The messaging schema is 480+ lines. These could benefit from further decomposition.

4. **Dual Content System** - Both `Post` and `Comment` tables exist, plus Posts can have `commentOnPostId` for replies. The `posts` table serves as posts, articles, replies, and quotes via the `type` column, creating semantic overloading.

5. **LLM Client Coupling** - `BabylonLLMClient` in the engine package is tightly coupled to OpenAI's API shape. The `@babylon/agents` package adds Anthropic and Groq via separate integrations.

6. **Cron Job Proliferation** - 17+ cron jobs running on Vercel. The game-tick handler alone has an 800-second max duration. Some jobs could be consolidated or moved to a proper job queue.

7. **Realtime Architecture** - SSE via Redis Streams is functional but lacks WebSocket support. The `NoopBroadcaster` class in the SSE module suggests the system was simplified from a more complex broadcaster.

8. **Training Package Dependencies** - The training package uses a manual dependency injection pattern (`configureTrainingDependencies()`) to avoid circular imports. This adds ceremony to initialization.

9. **Mixed On-chain/Off-chain State** - Markets have both `resolved` (off-chain) and `onChainResolved` flags, with separate `oracleCommitTxHash` / `oracleRevealTxHash` fields. Settlement is partially on-chain, creating potential consistency issues.

10. **Static Data in TypeScript** - NPC actor static data lives in TypeScript files rather than the database, requiring code deploys for actor changes. The `StaticDataRegistry` pattern works but limits admin control.

11. **API Route Count** - 200+ API route files in the web app. Some endpoints could be consolidated using more RESTful patterns or GraphQL.

12. **Test-Auth Backdoor** - The `ALLOW_TEST_PRIVY_DID_AUTH` flag allows test DIDs in development, which is convenient but requires careful production configuration.

13. **Oracle Salt Storage** - The `oracleSaltEncrypted` field stores encrypted salt in the DB for the commit-reveal scheme. Key management for this encryption is a security-critical dependency.

14. **Group System Complexity** - The tiered group system (3 tiers, promotion/demotion, grandfathering, invite decay with exponential backoff) adds significant complexity to the messaging layer.

15. **Perpetual Funding Rate** - The cubic imbalance exponent (3.0) for funding rate calculation may create discontinuities. The MAX_FUNDING_RATE cap at 50% APR is aggressive.
