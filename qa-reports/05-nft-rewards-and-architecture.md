# QA Report #05: NFT, Rewards, Discovery & Architecture

**Date:** 2026-03-04
**Tester:** bluesquid678 (ben.b@elizalabs.ai, isAdmin:true)
**Base URL:** https://play.babylon.market
**Auth:** Bearer JWT (Privy)

---

## Part A: API Endpoint Testing

### Summary

- **Total endpoints tested:** 32 (28 GET + 4 OPTIONS)
- **200 OK:** 4
- **204 No Content (CORS preflight):** 4
- **404 Not Found:** 22
- **500 Internal Server Error:** 1
- **404 returning JSON (route exists, resource missing):** 2
- **404 returning HTML (no API route):** 21

### Results Table

| Endpoint | Method | Status | Time | Response Summary |
|----------|--------|--------|------|------------------|
| /api/nft/access | GET | 200 | 0.18s | `{"success":true,"data":{"hasAccess":true,"reason":"whitelist"}}` |
| /api/nft/gallery | GET | 404 | 0.20s | JSON: `{"error":"Invalid token ID not found"}` - route exists but needs tokenId param |
| /api/nft/collection | GET | 200 | 0.58s | JSON array of NFTs with tokenId, name, owner, thumbnailUrl |
| /api/nft/mint | GET | 404 | 0.20s | JSON: `{"error":"Invalid token ID not found"}` - route exists but needs tokenId param |
| /api/waitlist/position | GET | 200 | 1.08s | position=482372, points=1059, inviteCode=bluesquid678, referralCount=0 |
| /api/waitlist/status | GET | 404 | 0.22s | HTML 404 (no route) |
| /api/waitlist/referrals | GET | 404 | 0.23s | HTML 404 (no route) |
| /api/rewards | GET | 404 | 0.23s | HTML 404 (no route) |
| /api/rewards/history | GET | 404 | 0.34s | HTML 404 (no route) |
| /api/rewards/claim | GET | 404 | 0.26s | HTML 404 (no route) |
| /api/referrals | GET | 404 | 0.27s | HTML 404 (no route) |
| /api/referrals/stats | GET | 404 | 0.22s | HTML 404 (no route) |
| /api/quests | GET | 404 | 0.24s | HTML 404 (no route) |
| /api/achievements | GET | 404 | 0.21s | HTML 404 (no route) |
| /api/daily-rewards | GET | 404 | 0.20s | HTML 404 (no route) |
| /api/organizations | GET | 200 | 0.22s | `{"success":true,"organizations":[...]}` with org objects |
| /api/search?q=test | GET | 404 | 0.22s | HTML 404 (no route) |
| /api/portfolio | GET | 404 | 0.22s | HTML 404 (no route) |
| /api/portfolio/summary | GET | 404 | 0.21s | HTML 404 (no route) |
| /api/transactions | GET | 404 | 0.20s | HTML 404 (no route) |
| /api/events | GET | 404 | 0.21s | HTML 404 (no route) |
| /api/explore | GET | 404 | 0.22s | HTML 404 (no route) |
| /api/discover | GET | 404 | 0.21s | HTML 404 (no route) |
| /api/config | GET | 404 | 0.22s | HTML 404 (no route) |
| /api/version | GET | 404 | 0.21s | HTML 404 (no route) |
| /api/docs | GET | 500 | 0.21s | `{"error":"An unexpected error occurred"}` - route exists but crashes |
| /api/swagger | GET | 404 | 0.23s | HTML 404 (no route) |
| /api/admin | GET | 404 | 0.33s | HTML 404 (no route) |
| /api/nft/access | OPTIONS | 204 | 0.06s | CORS OK |
| /api/rewards | OPTIONS | 204 | 0.08s | CORS OK |
| /api/waitlist/status | OPTIONS | 204 | 0.06s | CORS OK |
| /api/markets | OPTIONS | 204 | 0.07s | CORS OK |

### CORS Configuration

All OPTIONS preflight requests return proper headers:
- `access-control-allow-origin: https://play.babylon.market`
- `access-control-allow-credentials: true`
- `access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
- `access-control-allow-headers: Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, x-admin-token, x-dev-admin-token`
- `access-control-max-age: 86400`

### Issues Found

| Severity | Issue |
|----------|-------|
| HIGH | `/api/docs` returns 500 - unhandled server error |
| MEDIUM | `/api/nft/gallery` and `/api/nft/mint` return unhelpful error "Invalid token ID not found" when called without params - should return 400 with usage info |
| MEDIUM | `/api/waitlist/position` response time 1.08s is notably slow vs ~0.2s average |
| INFO | 21 of 28 GET endpoints do not exist - rewards, referrals, quests, achievements, search, portfolio, etc. are not implemented |
| INFO | CORS allows `x-admin-token` and `x-dev-admin-token` headers - verify intentional in production |

### Notes on Non-Existent Endpoints

These features exist via different route patterns than probed:
- **Rewards/Points**: Available via `/api/users/[userId]/points-history`, `/api/users/daily-login`, `/api/users/points/award`
- **Referrals**: Available via `/api/users/[userId]/referrals`, `/api/users/[userId]/referral-code`, `/api/users/[userId]/referral-fees`
- **Portfolio**: Available via `/api/users/[userId]/portfolio-breakdown`, `/api/markets/positions/[userId]`
- **Search**: Available via `/api/users/search`, `/api/agents/search`
- **Admin**: Available via `/api/admin/stats`, `/api/admin/users`, etc. (50+ admin routes)

---

## Part B: Architecture Analysis

### 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Runtime | Bun |
| Database | PostgreSQL (Neon serverless) |
| ORM | Drizzle ORM |
| Auth Provider | Privy (wallet + social login) |
| Package Manager | Bun workspaces + Turbo |
| Linter/Formatter | Biome |
| Smart Contracts | Solidity (Foundry + Hardhat) |
| Blockchain | EVM (viem + ethers) |
| Realtime | SSE (Server-Sent Events) + Ably |
| LLM | OpenAI API |
| Payments | Stripe + on-chain crypto |
| Monitoring | PostHog analytics |
| Testing | Bun test + Playwright |
| Deployment | Vercel |

### Monorepo Structure

```
babylon/
  apps/
    web/          # Next.js App Router (main application)
    cli/          # CLI tool for deployment, seeding
    docs/         # Documentation site
  packages/
    api/          # API middleware, auth, error handling, services
    core/         # Core market logic (prediction markets)
    db/           # Drizzle ORM schema, migrations, client
    engine/       # Game engine: ticks, NPCs, markets, LLM
    shared/       # Shared types, utils, constants
    agents/       # Agent framework
    a2a/          # Agent-to-Agent protocol
    mcp/          # Model Context Protocol
    contracts/    # Solidity smart contracts
    training/     # ML training pipeline
    testing/      # Unit, integration, e2e tests
```

---

### 2. Complete API Route Map

#### Auth Routes (`/api/auth/`)

| Route | Methods | Description |
|-------|---------|-------------|
| `/auth/siwe/nonce` | GET | Generate SIWE nonce |
| `/auth/siwe/authenticate` | POST | Sign-In With Ethereum |
| `/auth/twitter/initiate` | GET | Start Twitter OAuth |
| `/auth/twitter/callback` | GET | Twitter OAuth callback |
| `/auth/discord/initiate` | GET | Start Discord OAuth |
| `/auth/discord/callback` | GET | Discord OAuth callback |
| `/auth/discord/activity/` | GET/POST | Discord activity |
| `/auth/farcaster/callback` | POST | Farcaster callback |
| `/auth/telegram/validate` | POST | Telegram validation |
| `/auth/onboarding/twitter/*` | GET | Onboarding Twitter OAuth |
| `/auth/onboarding/farcaster/callback` | POST | Onboarding Farcaster |
| `/auth/credentials/status` | GET | Credential status |
| `/auth/whoami` | GET | Current user identity |

#### User Routes (`/api/users/`)

| Route | Methods | Description |
|-------|---------|-------------|
| `/users/me` | GET/PUT | Current user profile |
| `/users/me/game-guide` | GET/POST | Game guide state |
| `/users/signup` | POST | User registration |
| `/users/search` | GET | Search users |
| `/users/daily-login` | POST | Daily login streak reward |
| `/users/delete-account` | POST | Account deletion |
| `/users/export-data` | GET | GDPR data export |
| `/users/by-username/[username]` | GET | Lookup by username |
| `/users/api-keys` | GET/POST | Manage API keys |
| `/users/api-keys/[keyId]` | DELETE | Revoke API key |
| `/users/register-onchain` | POST | On-chain registration |
| `/users/points/award` | POST | Award points |
| `/users/[userId]/profile` | GET | Public profile |
| `/users/[userId]/update-profile` | PUT | Update profile |
| `/users/[userId]/balance` | GET | Get balance |
| `/users/[userId]/points-history` | GET | Points history |
| `/users/[userId]/portfolio-breakdown` | GET | Portfolio breakdown |
| `/users/[userId]/posts` | GET | User's posts |
| `/users/[userId]/activity` | GET | Activity feed |
| `/users/[userId]/follow` | POST/DELETE | Follow/unfollow |
| `/users/[userId]/followers` | GET | Followers list |
| `/users/[userId]/following` | GET | Following list |
| `/users/[userId]/block` | POST/DELETE | Block/unblock |
| `/users/[userId]/mute` | POST/DELETE | Mute/unmute |
| `/users/[userId]/referral-code` | GET | Referral code |
| `/users/[userId]/referrals` | GET | Referral list |
| `/users/[userId]/referral-fees` | GET | Referral earnings |
| `/users/[userId]/share` | POST | Share action |
| `/users/[userId]/verify-share` | POST | Verify share |
| `/users/[userId]/verify-twitter-follow` | POST | Verify Twitter follow |
| `/users/[userId]/verify-farcaster-follow` | POST | Verify Farcaster follow |
| `/users/[userId]/verify-discord-join` | POST | Verify Discord join |
| `/users/[userId]/link-social` | POST | Link social account |

#### Post & Feed Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/posts` | GET/POST | List/create posts |
| `/posts/feed/favorites` | GET | Favorites feed |
| `/posts/[id]` | GET/DELETE | Get/delete post |
| `/posts/[id]/like` | POST/DELETE | Like/unlike |
| `/posts/[id]/reply` | POST | Reply |
| `/posts/[id]/share` | POST | Share |
| `/posts/[id]/comments` | GET | Comments |
| `/comments/[id]` | GET/PUT/DELETE | Comment CRUD |
| `/comments/[id]/like` | POST/DELETE | Like comment |
| `/feed/hot` | GET | Hot feed |
| `/feed/widgets/*` | GET | Breaking news, markets, stats, trending widgets |

#### Market Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/markets/predictions` | GET | List prediction markets |
| `/markets/predictions/[id]` | GET | Get prediction market |
| `/markets/predictions/[id]/buy` | POST | Buy shares |
| `/markets/predictions/[id]/sell` | POST | Sell shares |
| `/markets/predictions/[id]/buy-onchain` | POST | Buy on-chain |
| `/markets/predictions/[id]/history` | GET | Price history |
| `/markets/predictions/[id]/trades` | GET | Trade history |
| `/markets/perps` | GET | Perpetual markets |
| `/markets/perps/open` | POST | Open perp position |
| `/markets/perps/[ticker]/history` | GET | Perp price history |
| `/markets/perps/position/[id]/close` | POST | Close perp |
| `/markets/positions/[userId]` | GET | User positions |
| `/markets/bias/*` | GET/POST | Bias markets |

#### Agent Routes (30+ endpoints)

Full CRUD for agents, team chat, external agents, A2A protocol, goals, benchmarks.

#### Chat & Group Routes (20+ endpoints)

DMs, group chats, NFT-gated chats, message reactions, group management with tiers.

#### NPC/Actor Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/actors` | GET | List NPCs |
| `/actors/[actorId]/stats` | GET | Actor stats |
| `/npc/[actorId]/invest` | POST | Invest in NPC pool |
| `/npc/[actorId]/portfolio` | GET | NPC portfolio |
| `/npc/performance/leaderboard` | GET | NPC leaderboard |

#### NFT Routes (actual)

| Route | Methods | Description |
|-------|---------|-------------|
| `/nft/access` | GET | Check NFT access |
| `/nft/eligibility` | GET | Mint eligibility |
| `/nft/holdings` | GET | User holdings |
| `/nft/collection` | GET | Collection data |
| `/nft/mint/prepare` | POST | Prepare mint tx |
| `/nft/mint/confirm` | POST | Confirm mint |
| `/nft/chat/ensure` | POST | Ensure NFT chat |
| `/nft/image/[tokenId]` | GET | NFT image |
| `/nft/metadata/[tokenId]` | GET | NFT metadata |
| `/nft/[tokenId]` | GET | NFT details |

#### Cron Routes (19 endpoints)

game-tick, agent-tick, npc-tick, markets-tick, article-tick, organization-tick, perp-funding, points-recompute, realtime-drain, reputation-sync, profile-chain-sync, nft-revalidate, metrics-snapshot, health-check, training, world-facts, whitelist-topn, weekly-dataset-upload.

#### Admin Routes (50+ endpoints)

Stats (users, trading, system, growth, heatmap, timeseries), user management, agent management, market management, resolution queue, reports, moderation, groups, feedback, fees, roles, permissions, notifications, training, whitelist, world facts, audit logs, analytics, performance metrics, content queue.

#### Misc Routes

health, docs, leaderboard, stats, ticker, trades, trending, realtime tokens, SSE, reputation, moderation, feedback, notifications, onboarding, organizations, questions, uploads, twitter, waitlist, frames, embeds, games, agent-templates, registry, profiles/favorites, huggingface, training.

**Total: ~200+ API route handlers**

---

### 3. Database Schema

#### Core Tables

**User** - Central user table
- IDs: `id` (snowflake PK), `privyId`, `walletAddress`, `username`
- Balance: `virtualBalance` (decimal 18,2, default 1000), `totalDeposited`, `totalWithdrawn`, `lifetimePnL`
- Points: `reputationPoints`, `invitePoints`, `earnedPoints`, `bonusPoints`, `totalPoints`
- Social: Twitter, Farcaster, Discord with OAuth tokens
- Flags: `isActor`, `isAgent`, `isAdmin`, `isBanned`, `isScammer`
- Referral: `referralCode`, `referralCount`, `referredBy`
- On-chain: `onChainRegistered`, `nftTokenId`, `registrationTxHash`
- Waitlist: `waitlistPosition`, `isWaitlistActive`, `waitlistGraduatedAt`

**ActorState** - Dynamic NPC state
- `tradingBalance`, `reputationPoints`, `currentMood` (-1 to 1)
- `recentMemories` (JSONB, 50-item limit), `relationships` (JSONB map)

**Post** - Posts with types (post, article, comment, share)
- Threading: `commentOnPostId`, `parentCommentId`, `originalPostId`
- Soft delete via `deletedAt`

**Market** - Prediction markets (CPMM)
- `yesShares`, `noShares`, `liquidity` (decimal 18,6)
- On-chain: `onChainMarketId`, `oracleAddress`

**Question** - Prediction questions with oracle commit-reveal
- `oracleCommitment`, `oracleSaltEncrypted`, `resolutionConfidence`
- `requiresManualReview` flag

**Position** - User positions (side: yes/no, shares, avgPrice, pnl)

**Organization** - Fictional companies with ticker symbols and prices

**PerpMarketSnapshot / PerpPosition** - Perpetual futures markets

#### Narrative System

**QuestionArcPlan** - Pre-planned narrative arcs with insider/deceiver actor assignments
**ArcState** - State machine (setup → tension → escalation → crisis → revelation → resolution)
**TimeframedMarket** - Hierarchical markets (flash → intraday → daily → weekly → monthly → longterm)

#### Trading

**BalanceTransaction** - All balance changes with before/after audit
**PointsTransaction** - Points changes with payment tracking
**TradingFee** - Fees with referral splits
**TradeAttempt** - All attempts including failures

#### Messaging & Groups

**Chat/Message/ChatParticipant** - DM and group chats with NFT gating
**Group/GroupMember/GroupInvite** - Tiered groups (12/50/500 members)

#### Agent System

**AgentRegistry** - Agent types (USER_CONTROLLED/NPC/EXTERNAL)
**AgentCapability/AgentLog/AgentGoal** - Capabilities, decision logs, goals
**ExternalAgentConnection** - External agent health checks

#### NFT System

**NftCollection/NftOwnership/NftClaim/NftSnapshot** - Full NFT lifecycle

#### ~60+ total tables

---

### 4. Authentication Architecture

**Provider:** Privy (wallet + social login)

**Token resolution:** `privy-token` cookie > `Authorization: Bearer` header

**Auth levels:**

| Level | Function | Description |
|-------|----------|-------------|
| Public | None | Health, docs, public feeds |
| User | `authenticate()` | Valid Privy token |
| Admin | `requireAdmin()` | Privy + admin flag/role |
| Super Admin | `requireSuperAdmin()` | SUPER_ADMIN role |
| Permission | `requirePermission()` | Granular RBAC (13 permissions) |
| Agent | `verifyAgentSession()` | Agent session token |
| Cron | CRON_SECRET header | Vercel cron auth |

**RBAC:** Roles (SUPER_ADMIN, ADMIN, VIEWER) with 13 granular permissions. Admin detection: AdminRole table > legacy `isAdmin` flag > Privy email domain match. Dev mode bypass via `x-dev-admin-token`.

**NFT Gating:** Middleware checks `NFT_GATING_ENABLED` env, calls `/api/nft/access`, caches in `ba_access` cookie (60s TTL). Whitelisted users bypass.

---

### 5. Rate Limiting

**Implementation:** In-memory sliding window, per-user per-action tracking.

| Action | Max/Window |
|--------|-----------|
| CREATE_POST | 3/60s |
| CREATE_COMMENT | 10/60s |
| LIKE_POST/COMMENT | 20/60s |
| SHARE_POST | 5/60s |
| FOLLOW/UNFOLLOW | 10/60s |
| SEND_MESSAGE | 20/60s |
| UPLOAD_IMAGE | 5/60s |
| OPEN/CLOSE_POSITION | 10/60s |
| BUY/SELL_PREDICTION | 10/60s |
| UPDATE_PROFILE | 5/60s |
| ADMIN_ACTION | 100/60s |
| DEFAULT | 30/60s |

**Duplicate detection:** SHA-256 content hash (Post: 5min, Comment: 2min, Message: 1min).

**Note:** In-memory only — resets on deploy, not shared across instances.

---

### 6. Error Handling

**Pattern:** `withErrorHandling` wrapper on all route handlers.

| Error Class | HTTP Status |
|-------------|-------------|
| AuthenticationError | 401 |
| AuthorizationError | 403 |
| ApiError | Various |
| BabylonError | 500 |
| ZodError | 400 |
| DatabaseError | 500 |

**Response format:** `{"error": "message", "code": "MACHINE_CODE"}`

**Features:** Zod body validation, standardized `successResponse()`, sensitive header redaction in logs, PostHog error tracking.

---

### 7. Game Engine

#### Game Day Progression
- `Game` table tracks `currentDay` and `currentDate`
- `GameClock` supports realtime (wall clock) and simulated (fast-forward) modes
- Cron-triggered ticks via `/api/cron/game-tick`
- `GenerationLock` prevents concurrent tick execution

#### Market Resolution
1. Questions have `resolutionDate`
2. Game tick checks for expired questions
3. Oracle commit-reveal pattern on-chain
4. AI-assisted resolution with confidence scoring
5. Low-confidence → `requiresManualReview` → admin resolves via `/api/admin/resolutions/[id]`
6. Resolution settles all positions (winners paid, losers lose stake)

#### Narrative Arc System
Questions progress through narrative states:
- **Long-term (30d):** setup → tension → escalation → crisis → revelation → resolution
- **Weekly (3-7d):** setup → tension → escalation → crisis → resolution
- **Daily (12-48h):** morning → midday → afternoon → evening → resolution
- **Intraday (1-6h):** setup → active → climax → resolution
- **Flash (15-30m):** live → resolving

`QuestionArcPlan` pre-plans events with insider/deceiver actor assignments. Signal ratios control truthful vs misleading NPC info per phase.

#### NPC Posting
1. Static data (personality, tier) in TypeScript `StaticDataRegistry`
2. Dynamic state (balance, mood, memories) in `ActorState` table
3. LLM-generated posts via `BabylonLLMClient`
4. Context-aware: arc phase, related questions, world events
5. Mood (-1 to 1) affects tone and trading decisions
6. `MarketDecisionEngine` makes trading decisions based on personality + market state

#### Points/Balance System

**Virtual Balance** (trading):
- Default 1000 on signup, decimal 18,2
- Used for prediction trades and perp positions
- Tracked via `BalanceTransaction` with before/after audit
- Atomic via `WalletService`

**Reputation Points** (social/gamification):
- Default 1000, integer
- Earned via: profile completion, social linking, referrals, daily logins, sharing
- Purchasable via crypto/Stripe
- `totalPoints` = unified score recomputed by cron
- Used for leaderboard ranking

---

### 8. Key Design Patterns

1. **Snowflake IDs** - Text-based primary keys
2. **Soft deletes** - `deletedAt` timestamps
3. **Audit trail** - Before/after values in transaction tables
4. **JSONB flexibility** - Memories, relationships, configs
5. **DB-level constraints** - CHECK on mood bounds, positive balance
6. **Outbox pattern** - `RealtimeOutbox` for reliable event delivery
7. **Static + dynamic split** - NPC static data in TS, dynamic state in DB
8. **Singleton tables** - GameConfig, WhitelistConfig use fixed IDs
