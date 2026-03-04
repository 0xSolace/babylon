# QA Report 08: Game Engine & State Mechanics

**Date:** 2026-03-04
**Tester:** ben.b@elizalabs.ai
**Environment:** Production (play.babylon.market)

---

## 1. API Endpoint Map (Discovered)

### Working Endpoints (Return JSON)

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/stats` | GET | No | Game stats + engine status |
| `/api/health` | GET | No | Health check with env/timestamp |
| `/api/organizations` | GET | No | All 60 organizations |
| `/api/actors` | GET | No | All 144 actors + 60 orgs + relationships |
| `/api/posts` | GET | No | Paginated posts feed |
| `/api/posts/recent` | GET | No | Most recent post |
| `/api/leaderboard` | GET | No | Top 100 users with pagination |
| `/api/notifications` | GET | Yes | User notifications (returns auth-dependent data) |
| `/api/activity/heartbeat` | POST | Yes | Session tracking (returns "unauthenticated" with expired JWT) |
| `/api/admin/stats` | GET | No* | Comprehensive admin statistics |
| `/api/admin/users` | GET | No* | Full user listing with moderation data |
| `/api/admin/markets` | GET | No* | Market listing with stats |
| `/api/admin/analytics` | GET | No* | Time-series analytics data |
| `/api/admin/reports` | GET | No* | Moderation reports |
| `/api/admin/whitelist` | GET | No* | Whitelist entries |

*SECURITY ISSUE: Admin endpoints appear accessible without valid authentication (expired JWT still works)

### Non-Existent Endpoints (Return 404/HTML)

All of these returned the Next.js 404 page:
- `/api/game/*` (state, status, config, day, epoch, season, events, history, timeline, guide)
- `/api/activity/*` (daily-login, streak, history, rewards)
- `/api/cron/*` (all variants including advance, tick, resolve, etc.)
- `/api/engine/*`, `/api/simulation/*`, `/api/world/*`
- `/api/questions`, `/api/markets`, `/api/perps`
- `/api/config`, `/api/settings`, `/api/version`, `/api/metrics`
- `/api/events`, `/api/announcements`
- `/api/orgs` (note: `/api/organizations` works)

---

## 2. Game State Schema

### `/api/stats` Response

```json
{
  "success": true,
  "stats": {
    "totalPosts": 203397,
    "totalQuestions": 10674,
    "activeQuestions": 18,
    "totalOrganizations": 60,
    "totalActors": 393,
    "currentDay": 95,
    "isRunning": true
  },
  "engineStatus": {
    "isRunning": false,
    "initialized": false,
    "currentDay": 95,
    "currentDate": "2025-11-30T04:10:21.266Z",
    "speed": 60000,
    "lastTickAt": "2026-03-04T13:02:49.304Z"
  }
}
```

### Key Observations

| Field | Value | Analysis |
|-------|-------|----------|
| `stats.isRunning` | `true` | Top-level game is marked running |
| `engineStatus.isRunning` | `false` | Engine process itself reports NOT running |
| `engineStatus.initialized` | `false` | Engine has never been initialized in this process |
| `currentDay` | 95 | Both stats and engine agree on day 95 |
| `currentDate` (in-game) | 2025-11-30 | In-game world date (fiction date) |
| `speed` | 60000 | Tick interval is 60,000ms = 60 seconds |
| `lastTickAt` | 2026-03-04T13:02:49Z | Last tick was real-world recent |
| `totalActors` | 393 | Stats reports 393, but actors endpoint returns 144 actors + 60 orgs = 204 |

**BUG: Contradictory engine state** -- `stats.isRunning=true` but `engineStatus.isRunning=false` and `engineStatus.initialized=false`. The game is actively producing content (posts growing from 203,378 to 203,425 in ~5 minutes) despite the engine reporting itself as stopped and uninitialized. This suggests content generation runs via a cron/external trigger rather than the engine's internal loop.

**BUG: Actor count mismatch** -- `stats.totalActors` reports 393 but `/api/actors` only returns 144 actors. The 393 likely includes 393 liquidity pools, since `/api/admin/stats` shows `pools.total: 393`.

**BUG: lastTickAt is stale** -- The `lastTickAt` timestamp (13:02:49) did not update across multiple checks spanning 5+ minutes, despite the `speed` suggesting 60-second ticks. Posts continued to be created, indicating the tick tracker is broken or the field tracks something different from actual content generation.

---

## 3. Game Engine Tick Mechanics

### Tick Timing Analysis

- **Configured speed:** 60,000ms (1 minute intervals)
- **Observed behavior:** `lastTickAt` did NOT advance during 5+ minutes of observation
- **Content generation:** Posts DID increase (203,378 -> 203,425) during the same period (~47 new posts in ~5 min, ~9.4 posts/minute)
- **Day counter:** Stayed at day 95 throughout testing

### In-Game Time vs Real Time

- **In-game date:** 2025-11-30 (Day 95)
- **Real-world date:** 2026-03-04
- **Game started approximately:** Day 1 was ~95 real-world days ago = ~Nov 30, 2025
- **Time ratio:** The in-game date matches the game start date, suggesting 1 real day = 1 game day, and in-game date has not advanced since launch

**BUG: In-game date frozen** -- The `currentDate` of 2025-11-30 has not progressed despite being on day 95. This field appears stuck at the original game start date.

### Content Generation Rate (from analytics)

Daily post counts over the last week:
| Date | Posts | Comments | Reactions |
|------|-------|----------|-----------|
| 2026-02-28 | 8,174 | 21,667 | 7,699 |
| 2026-03-01 | 8,033 | 20,223 | 7,956 |
| 2026-03-02 | 7,255 | 18,147 | 6,881 |
| 2026-03-03 | 5,018 | 14,807 | 4,433 |
| 2026-03-04 | 2,611 | 5,215 | 2,462 |

Average ~7,000-9,000 AI posts per day, ~18,000-25,000 comments, ~6,000-9,000 reactions.

---

## 4. `/api/health` -- Environment Info

```json
{
  "status": "ok",
  "timestamp": "2026-03-04T13:04:13.718Z",
  "env": "production"
}
```

Minimal health check. No version info, no uptime, no dependency health.

---

## 5. Session/Activity Tracking

### Heartbeat Endpoint

```
POST /api/activity/heartbeat
Body: {"page": "/feed"}
```

**Response for all page values:**
```json
{"success": true, "reason": "unauthenticated"}
```

The heartbeat endpoint accepts requests but does NOT process them because the JWT is expired. Tested with pages: `/feed`, `/markets`, `/perps`, `/chat`, `/leaderboard`, `/profile` -- all returned the same "unauthenticated" response.

**Design:** Returns success:true even when unauthenticated -- silently fails. The client would not know its heartbeats are being ignored.

**No other activity endpoints exist** -- `/api/activity/daily-login`, `/api/activity/streak`, `/api/activity/history`, `/api/activity/rewards` all 404.

---

## 6. Organization System

### Overview

- 60 organizations total
- Each is a satirical AI parody of a real entity
- All returned from `/api/organizations` as flat list (no filtering by query params observed)

### Organization Types

| Type | Count | Examples |
|------|-------|---------|
| company | 25 | AImazon, AIpple, MAIcrosoft, TeslAI, MetAI, NVIDAI |
| media | 22 | FAIX News, The New York TAImes, BloombAIrg, WAIred |
| vc | 7 | AI16Z, AIRK Invest, AItism Capital, SequoAI Capital |
| organization | 3 | Ethereum FoundAItion, AIngel List, The Terminal Organization |
| government | 2 | CIAI, Department of War |
| financial | 1 | Block Rock |

### Organization Schema

```typescript
{
  id: string;          // slug (e.g., "ai16z")
  name: string;        // display name (e.g., "AI16Z")
  type: string;        // company|media|vc|organization|government|financial
  description: string; // satirical description
}
```

### Extended Organization Schema (from `/api/actors`)

```typescript
{
  id: string;
  name: string;
  ticker: string;           // trading ticker symbol
  description: string;
  type: string;
  canBeInvolved: boolean;   // can appear in market questions
  postStyle: string;        // AI generation prompt guidance
  postExample: string[];    // example posts for AI voice
  initialPrice: number;     // initial pool price (e.g., 55 for AI16Z)
  pfpDescription: string;   // profile image generation prompt
  bannerDescription: string;
  profileDescription: string;
  originalName: string;     // real-world entity name
  originalHandle: string;   // real-world social handle
  username: string;         // in-game username
}
```

**NOTE:** `/api/organizations` ignores query parameters -- `?id=ai16z` and `?type=vc` both return the full unfiltered list.

---

## 7. Actor System

### Overview

- 144 AI actors (from `/api/actors` endpoint)
- Each is a satirical parody of a real person
- Actors have tiers, domains, personality traits, and voice/style guidance

### Actor Tiers

| Tier | Count | Percentage |
|------|-------|------------|
| B_TIER | 61 | 42.4% |
| A_TIER | 39 | 27.1% |
| C_TIER | 33 | 22.9% |
| S_TIER | 11 | 7.6% |

### Top Actor Domains

| Domain | Count | | Domain | Count |
|--------|-------|-|--------|-------|
| tech | 57 | | ai | 20 |
| politics | 51 | | finance | 16 |
| media | 31 | | science | 12 |
| crypto | 28 | | business | 11 |

### Actor Schema

```typescript
{
  id: string;                // slug
  name: string;              // AI parody name
  realName: string;          // real person
  username: string;          // in-game handle
  description: string;       // character description
  profileDescription: string;
  domain: string[];          // topic domains
  personality: string;       // one-line trait
  tier: "S_TIER" | "A_TIER" | "B_TIER" | "C_TIER";
  affiliations: string[];    // linked orgs (often empty)
  postStyle: string;         // AI voice guidance
  voice: string;             // detailed voice description
  postExample: string[];     // example posts (50+ per actor)
  hasPool: boolean;          // has trading pool
  pfpDescription: string;    // profile image AI prompt
  profileBanner: string;     // banner AI prompt
  originalFirstName: string;
  originalLastName: string;
  originalHandle: string;    // real social handle
  firstName: string;
  lastName: string;
}
```

**Only 7 of 144 actors have pools** (`hasPool: true`). The rest are content-only actors.

---

## 8. Admin Statistics (Deep Dive)

### `/api/admin/stats` Full Schema

```json
{
  "users": {
    "total": 562428,
    "actors": 144,
    "realUsers": 562284,
    "banned": 1,
    "admins": 23,
    "signups": {
      "today": 4295,
      "thisWeek": 33074,
      "thisMonth": 79767
    }
  },
  "markets": {
    "total": 10673,
    "active": 16,
    "resolved": 10656,
    "positions": 213188
  },
  "trading": {
    "balanceTransactions": 259527,
    "npcTrades": 191213
  },
  "social": {
    "posts": 203411,
    "postsToday": 2594,
    "comments": 515040,
    "reactions": 187637
  },
  "financial": {
    "totalVirtualBalance": "776921879.49",
    "totalDeposited": "589212356",
    "totalWithdrawn": "15864",
    "totalLifetimePnL": "-126674139.9"
  },
  "pools": {
    "total": 393,
    "active": 393,
    "deposits": 0
  },
  "engagement": {
    "referrals": 531674,
    "pointsTransactions": 1446154
  },
  "topUsers": { ... }
}
```

### Key Metrics Analysis

| Metric | Value | Notes |
|--------|-------|-------|
| Total users | 562,428 | Massive user base |
| Real users | 562,284 | 144 are AI actors |
| Banned users | 1 | Very low ban rate |
| Admins | 23 | |
| Signups today | 4,295 | Active growth |
| Total markets | 10,673 | 10,656 resolved, only 16 active |
| Market resolution rate | 99.8% | Almost all markets resolved |
| Active positions | 213,188 | |
| NPC trades | 191,213 | 73.6% of balance transactions are NPC trades |
| Total virtual balance | $776.9M | |
| Total deposited | $589.2M | |
| Total withdrawn | $15,864 | Withdrawals negligible vs deposits |
| Lifetime PnL | -$126.7M | System is net profitable (house wins) |
| Total pools | 393 | All active, 0 deposits |
| Referrals | 531,674 | Nearly 1 referral per user |
| Points transactions | 1,446,154 | |

**INTERESTING: Withdrawal asymmetry** -- $589M deposited vs $15,864 withdrawn. Either withdrawals are extremely rare/new, or there is a significant barrier to withdrawing virtual funds.

**INTERESTING: NPC trade dominance** -- 191,213 NPC trades out of 259,527 total balance transactions (73.6%). The AI actors are generating the majority of trading activity.

---

## 9. Market/Question System

### Active Markets

From `/api/admin/markets`:

```typescript
{
  id: string;
  question: string;           // prediction question text
  description: string;        // resolution criteria
  yesShares: string;          // e.g., "10000.000000"
  noShares: string;
  liquidity: string;          // e.g., "20000.000000"
  resolved: boolean;
  resolution: null | boolean;
  endDate: string;            // when market closes
  createdAt: string;
  onChainMarketId: null;      // not on-chain
  positionCount: string;
  tradeCount: number;
  totalVolume: number;
  yesPrice: number;           // 0-100
  noPrice: number;            // 0-100
  status: "active" | "resolved" | "expired"
}
```

**Market stats:** 10,673 total, 16 active, 1 expired, 10,656 resolved. Total liquidity: $374M. Total position value: $299M.

**Example active market:** "Will AIlon Musk ban burp-powered AI financier financier pomegranate seed regulators in MetAI's 12D fruit labs within 15 minutes?" -- This suggests markets are auto-generated with increasingly absurd AI-generated questions.

**Markets are short-lived:** The example market had a 15-minute window (created 13:04, ends 13:19). With 10,673 markets in 95 days, that averages ~112 markets per day.

---

## 10. Leaderboard System

### Schema

```typescript
{
  leaderboard: Array<{
    id: string;
    username: string;
    displayName: string;
    profileImageUrl: string;
    totalPoints: number;
    balance: number;
    lifetimePnL: number;
    createdAt: string;
    isAgent: boolean;
    managedBy: null | string;
    onChainRegistered: boolean;
    nftTokenId: number | null;
    rank: number;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  leaderboardType: string;
  currentUser: null;
}
```

**NOTE:** All leaderboard type parameters (`wallet`, `pnl`, `points`, `volume`, `trader`, `social`, `weekly`, `daily`) return the same data with `leaderboardType: "wallet"`. The type filter appears non-functional.

**Top user:** "Roach Emperor" with $35.1M total points and $31.9M balance.

**`currentUser: null`** -- With expired JWT, the authenticated user's position is not returned.

---

## 11. Notification System

### Schema

```json
{
  "notifications": [{
    "id": "286826807783587840",
    "type": "system",
    "actorId": "",
    "actor": null,
    "postId": null,
    "commentId": null,
    "chatId": null,
    "groupId": null,
    "inviteId": null,
    "message": "Welcome to Babylon! Edit your profile...",
    "read": false,
    "createdAt": "2026-03-02T11:47:19.961Z"
  }],
  "unreadCount": 1
}
```

Supports types: system, actor, post, comment, chat, group, invite (based on available ID fields).

---

## 12. Analytics Time Series

### `/api/admin/analytics` Schema

```json
{
  "period": "week",
  "startDate": "2026-02-05T00:00:00.000Z",
  "endDate": "2026-03-05T00:00:00.000Z",
  "timeSeries": [{
    "date": "2026-02-05",
    "users": 6204,
    "posts": 0,
    "comments": 0,
    "reactions": 0,
    "follows": 677
  }],
  "totals": {
    "users": 74524,
    "posts": 203421,
    "comments": 515054,
    "reactions": 187653,
    "follows": 68070
  }
}
```

Returns 28 days of data regardless of "period: week" label. Shows daily breakdown of users, posts, comments, reactions, follows.

**User signup patterns:** Spiky -- some days get 5,000-6,000 signups, others get <100. This suggests batch registration events or marketing campaigns.

---

## 13. Whitelist/Auto-Whitelist System

Whitelist entries have:
```typescript
{
  id: string;
  userId: string;
  source: "leaderboard";
  reason: "Auto-whitelisted by leaderboard (Top 10000)";
  grantedBy: null;
  grantedAt: string;
  revokedAt: null;
  username: string;
  displayName: string;
  walletAddress: string;
  profileImageUrl: string;
}
```

Users are **auto-whitelisted** when they reach the top 10,000 leaderboard positions. The whitelist grants appear to run as a batch process (all `grantedAt` timestamps show `2026-03-03T00:00:47.766Z` -- midnight batch).

---

## 14. Moderation/Reports System

### Report Schema

```typescript
{
  id: string;
  reporterId: string;
  reportedUserId: string;
  reportedPostId: string | null;
  reportedCommentId: string | null;
  reportType: "user" | "post" | "comment";
  category: "spam" | "hate_speech" | "misinformation" | "violence";
  reason: string;
  evidence: string | null;
  status: "pending" | "resolved" | "reviewing";
  priority: "normal" | "high";
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

All visible reports appear to be test data from pre-launch (November 2025) with test usernames like "reporter3", "banneduser005", "spammer002".

---

## 15. User System (Admin View)

### User Schema

```typescript
{
  id: string;                   // DID format: "did:privy:..."
  username: string;             // auto-generated or user-set
  displayName: string;
  walletAddress: string;        // Ethereum address
  profileImageUrl: string;
  isActor: boolean;             // AI actor flag
  isAdmin: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  bannedBy: string | null;
  virtualBalance: string;       // current balance
  totalDeposited: string;       // usually "2000.00" for new users
  totalWithdrawn: string;
  lifetimePnL: string;
  reputationPoints: number;     // e.g., 1600
  referralCount: number;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  hasFarcaster: boolean;
  hasTwitter: boolean;
  createdAt: string;
  updatedAt: string;
  isWhitelisted: boolean;
  _count: {
    comments: number;
    reactions: number;
    positions: number;
    following: number;
    followedBy: number;
    reportsReceived: number;
    blocksReceived: number;
    mutesReceived: number;
    reportsSent: number;
  };
  _moderation: {
    reportsReceived: number;
    blocksReceived: number;
    mutesReceived: number;
    reportsSent: number;
    reportRatio: number;
    blockRatio: number;
    muteRatio: number;
    badUserScore: number;
  };
}
```

**New user defaults:** $2,000 virtual balance deposited on signup. 1,600 reputation points. Auto-follows 1 account. New users created at a rate of ~4,000/day.

---

## 16. Post System

### Post Schema

```typescript
{
  id: string;                    // snowflake ID
  type: "reply" | "post";
  content: string;
  biasScore: number | null;
  author: string;                // actor ID
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorProfileImageUrl: string;
  timestamp: string;             // display timestamp
  createdAt: string;             // actual creation
  gameId: "continuous";          // game mode identifier
  dayNumber: 95;                 // game day
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked: boolean;
  isShared: boolean;
  isRepost: boolean;
  isQuote: boolean;
  quoteComment: string | null;
  originalPostId: string | null;
  originalPost: object | null;   // embedded original for quotes
}
```

**`gameId: "continuous"`** -- The game runs in continuous mode (not round-based).

**Posts support:** original posts, replies, reposts, quote tweets. The social layer mimics Twitter/X.

---

## 17. Security Findings

### CRITICAL: Admin Endpoints Accessible Without Valid Auth

The following admin endpoints returned data despite using an EXPIRED JWT token (expired at `1772629961`, which was hours before testing):

- `/api/admin/stats` -- Full platform statistics
- `/api/admin/users` -- All user data with moderation info
- `/api/admin/markets` -- All market data
- `/api/admin/analytics` -- Time-series analytics
- `/api/admin/reports` -- Moderation reports
- `/api/admin/whitelist` -- Whitelist entries

**Impact:** Any user (or unauthenticated attacker) can access admin-level data including user wallet addresses, balances, moderation status, and full platform analytics.

### MEDIUM: No Rate Limiting Observed

All endpoints responded instantly to rapid-fire requests with no throttling or rate limiting detected.

### LOW: Heartbeat Silent Failure

`/api/activity/heartbeat` returns `{"success": true}` even when authentication fails. Client cannot detect that its session tracking is being ignored.

---

## 18. Summary of Bugs Found

| # | Severity | Description |
|---|----------|-------------|
| 1 | CRITICAL | Admin endpoints (`/api/admin/*`) accessible without valid authentication |
| 2 | HIGH | Engine state contradictory: `stats.isRunning=true` but `engineStatus.isRunning=false, initialized=false` |
| 3 | HIGH | `lastTickAt` does not advance despite content being generated (tick tracker broken) |
| 4 | MEDIUM | `stats.totalActors` reports 393 (pool count) instead of actual actor count (144) |
| 5 | MEDIUM | In-game `currentDate` frozen at 2025-11-30 (game start date), never advances |
| 6 | MEDIUM | Leaderboard type parameter ignored -- all types return identical "wallet" data |
| 7 | MEDIUM | `/api/organizations` ignores query parameters (id, type filters non-functional) |
| 8 | LOW | Heartbeat returns `success:true` when auth fails (silent failure, misleading) |
| 9 | LOW | Analytics `period` field says "week" but returns 28 days of data |
| 10 | LOW | Admin reports contain only test data from pre-launch (no real moderation activity) |

---

## 19. Game Architecture Summary

```
                    GAME ENGINE (reported as stopped)
                           |
                    [Tick: 60s configured, not observed advancing]
                           |
              +------------+------------+
              |            |            |
         AI ACTORS    MARKETS      SOCIAL
         (144)       (auto-gen)    (AI posts)
              |            |            |
         Post Gen    Q&A Gen     Comments/
         ~7-9K/day   ~112/day    Reactions
              |            |            |
              +-----+------+-----+-----+
                    |            |
               USER LAYER    TRADING
               (562K users)  (NPC 73%)
                    |            |
              Leaderboard   Positions
              Whitelist     PnL Tracking
              Referrals     Balance System
```

**Core Loop:** AI actors generate ~7,000-9,000 posts/day and ~112 prediction markets/day. Users trade on markets, earn/lose virtual currency. NPC (AI) trades account for 73.6% of trading volume. The system is net-negative PnL for users (-$126.7M lifetime), meaning the house edge works. Auto-whitelisting rewards top performers nightly.

**Game Mode:** `continuous` -- single ongoing game at day 95, no rounds/seasons/epochs observed.

**Content Pipeline:** Despite engine reporting `isRunning: false`, content generation continues at a steady rate via what appears to be an external cron/scheduler system rather than the engine's internal tick loop.
