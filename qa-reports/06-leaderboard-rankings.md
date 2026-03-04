# QA Report 06: Leaderboard & Rankings Deep Dive

**Date:** 2026-03-04
**Tester:** ben.b@elizalabs.ai (limekiwi_dao)
**User ID:** did:privy:cml8l4kp8013xld0cm4jmcaa8
**Environment:** play.babylon.market (production)

---

## Executive Summary

The Babylon game has TWO independent ranking systems: a **game leaderboard** (wallet/team) ranked by `totalPoints`, and a **waitlist leaderboard** ranked by referral/reputation points. The game leaderboard supports 562,254 users but only 2 valid types (`wallet` and `team`). There is extreme wealth concentration: the #1 player holds 35.1M points while the median user has ~3,600 points. Our user (limekiwi_dao) ranks #179,122 with 2,508.73 points.

---

## 1. Leaderboard Types Available

### 1.1 Game Leaderboard (`/api/leaderboard`)

Two modes determined by `type` query parameter:

| Type | Description | Sort By |
|------|-------------|---------|
| `wallet` (default) | Individual wallets -- users AND agents ranked separately | `totalPoints DESC, createdAt ASC, id ASC` |
| `team` | User + all their managed agents combined | `teamTotalPoints DESC, createdAt ASC, id ASC` |

**BUG:** The `type` parameter accepts any string but silently defaults to `wallet` for anything other than `wallet` or `team`. Passing `type=pnl`, `type=volume`, `type=reputation`, `type=streak`, `type=weekly`, `type=daily`, `type=monthly`, `type=alltime`, `type=agents`, `type=super` ALL return the same `wallet` leaderboard. The schema transforms unknown values to `wallet` silently (line 437-439 of common.ts). This is misleading -- the API should return a 400 error for invalid types.

### 1.2 Waitlist Leaderboard (`/api/waitlist/leaderboard`)

Separate system. Supports `pointsType` parameter:

| pointsType | Behavior | Description |
|------------|----------|-------------|
| `invite` (default) | Ranked by invite/referral points | Top referrers |
| `total` | Ranked by total reputation points | Overall waitlist standing |
| `reputation` | Falls back to `invite` | Seems ignored |
| `earned` | Falls back to `invite` | Seems ignored |

**BUG:** Only `invite` and `total` produce different results. `reputation` and `earned` silently fall back to `invite` sorting.

### 1.3 Missing Leaderboard Types

The following expected leaderboard types do NOT exist:
- PnL leaderboard (no `type=pnl`)
- Volume leaderboard (no `type=volume`)
- Agent-only leaderboard (no filtering by `isAgent`)
- Time-scoped leaderboards (daily/weekly/monthly)
- Season/epoch leaderboards (no season concept exists)

---

## 2. Scoring Formula (totalPoints)

Source: `packages/engine/src/services/total-points-service.ts`

```
totalPoints = virtualBalance + perpPositionValue + predictionPositionValue + reputationPoints
```

### 2.1 Components

| Component | Description |
|-----------|-------------|
| `virtualBalance` | Cash in wallet (starting balance + deposits - withdrawals + realized PnL) |
| `perpPositionValue` | `margin + unrealizedPnL` for each open perp position |
| `predictionPositionValue` | Net sell proceeds (or cost basis fallback) for prediction market shares |
| `reputationPoints` | Sum of all earned/bonus/invite points from social actions |

### 2.2 Reputation Points Breakdown

Source: `packages/shared/src/constants/points.ts`

| Action | Points |
|--------|--------|
| Initial signup | 1,000 |
| Profile completion | 200 |
| Farcaster link | 300 |
| Farcaster follow | 100 |
| Twitter link | 300 |
| Twitter follow | 100 |
| Discord link | 300 |
| Discord join | 100 |
| Wallet connect | 300 |
| Email submit | 100 |
| Share action | 500 |
| Share to Twitter | 500 |
| Referral signup (referrer) | 100 |
| Referral bonus (new user) | 100 |
| Referral qualified | 100 |
| On-chain registration | 100 (cost) |
| Private group create | 200 |
| Private channel create | 200 |

### 2.3 Daily Login Streak Rewards

| Day | Points | Milestone Bonus |
|-----|--------|-----------------|
| Day 1 | 50 | -- |
| Day 2 | 75 | -- |
| Day 3 | 100 | -- |
| Day 4 | 125 | -- |
| Day 5 | 150 | -- |
| Day 6 | 175 | -- |
| Day 7 | 200 | +500 (7-day milestone) |
| Day 14 | (repeats cycle) | +750 |
| Day 30 | | +1,500 |
| Day 60 | | +3,000 |
| Day 90 | | +5,000 |

Streak timing: 24h minimum between claims, 36h grace period before reset.

### 2.4 Update Frequency

- Points are NOT updated in real-time
- `totalPointsDirtyAt` flag marks users needing recompute
- Cron job runs on a schedule (15-min interval based on code references)
- Dirty users are recomputed in batches of 100
- Daily snapshot at midnight UTC
- Bulk backfill runs for users stuck at 0 totalPoints
- Cache TTL: 120 seconds (2 minutes) for leaderboard pages

---

## 3. Top Player Analysis

### 3.1 Wallet Leaderboard Top 10

| Rank | Username | Total Points | Balance | Lifetime PnL | Agent? | NFT |
|------|----------|-------------|---------|---------------|--------|-----|
| 1 | roach_empire_420 | 35,155,667.52 | 31,956,934.52 | 31,959,335.79 | No | 34755 |
| 2 | mdmnvest | 7,578,505.72 | 6,869,502.98 | 6,973,361.55 | No | 368 |
| 3 | darthvader | 1,930,554.67 | 1,577,646.76 | 1,638,395.33 | Yes (agent of mdmnvest) | -- |
| 4 | oracleofbabylon | 1,846,473.14 | 1,489,879.18 | 1,537,346.55 | Yes (agent of mdmnvest) | -- |
| 5 | wlt | 251,254.28 | 218,593.32 | 233,001.20 | No | 112115 |
| 6 | ionoi | 180,437.23 | 161,694.23 | 168,930.88 | No | 67515 |
| 7 | sparknet270067 | 67,855.87 | 46,916.27 | 55,020.05 | Yes (agent) | -- |
| 8 | rusmayana | 61,700.00 | 1,307.70 | 0.00 | No | 4522 |
| 9 | blue_barnacle_king | 61,100.00 | 1,000.00 | 0.00 | No | -- |
| 10 | akumaujp19819 | 53,465.87 | 34,543.36 | 35,738.95 | No | 14099 |

### 3.2 Team Leaderboard Top 5

| Rank | Username | Team Total | User Points | Agent Points | Agent Count |
|------|----------|-----------|-------------|-------------|-------------|
| 1 | roach_empire_420 | 35,155,759.40 | 35,155,667.52 | 91.88 | 3 |
| 2 | mdmnvest | 11,372,504.77 | 7,578,505.72 | 3,793,999.05 | 8 |
| 3 | wlt | 263,054.13 | 251,254.28 | 11,799.85 | 12 |
| 4 | ionoi | 190,364.13 | 180,437.23 | 9,926.90 | 6 |
| 5 | yuo | 122,668.44 | 17,965.00 | 104,703.44 | 13 |

**Key Insight:** mdmnvest owns agents `darthvader` and `oracleofbabylon` (ranks #3 and #4 on wallet board). On the team leaderboard, mdmnvest's team total (11.37M) is much higher than their individual wallet (7.58M), showing the value of agents.

### 3.3 Two Player Archetypes

**Trading whales** (ranks 1-6): High balance, high PnL. Points driven primarily by trading profits. `pts/bal` ratio near 1.1 (points ~ balance + small reputation).

**Referral grinders** (ranks 8-50): Low balance (~1,000), zero PnL. Points driven entirely by reputation from referrals and social actions. Examples: rusmayana (#8, 61,700 pts, 1,307 balance), blue_barnacle_king (#9, 61,100 pts, 1,000 balance).

---

## 4. Wealth Distribution Analysis

### 4.1 Point Distribution Across Ranks

| Rank | Total Points | Ratio to #1 |
|------|-------------|-------------|
| #1 | 35,155,667.52 | 1x |
| #2 | 7,578,505.72 | 4.6x less |
| #10 | 53,465.87 | 657x less |
| #50 | 21,900.00 | 1,605x less |
| #100 | 17,300.00 | 2,032x less |
| #250 | 9,000.00 | 3,906x less |
| #500 | 6,000.00 | 5,859x less |
| #1,000 | 5,200.00 | 6,761x less |
| #5,000 | 3,900.00 | 9,014x less |
| #25,000 | 3,600.00 | 9,765x less |
| #179,122 (us) | 2,508.73 | 14,014x less |
| #562,254 (last) | 0.00 | -- |

### 4.2 Gini Coefficient Indicators

- **Top 2 players** hold more than the next 562,252 users combined
- **#1 roach_empire_420** has 4.6x more points than #2
- Ratio #1 to #10 is 657:1 -- extreme power-law distribution
- The vast majority of 562,254 users cluster between 0-5,000 points
- Only ~6 users have >100,000 points
- The effective leaderboard is a 2-player race

### 4.3 Agent Impact

- 12 agents in top 100 (12%)
- All agents are managed by top human players
- mdmnvest manages 8 agents including #3 and #4 on the leaderboard
- Agents cannot register on-chain (no NFT, onChainRegistered=false)
- Combined, mdmnvest + agents control ~$11.4M in points

---

## 5. Our User Position (limekiwi_dao)

### 5.1 Game Leaderboard

| Metric | Value |
|--------|-------|
| **Wallet Rank** | #179,122 of 562,254 (67th percentile) |
| **Page** | 1,792 |
| **Total Points** | 2,508.73 |
| **Balance** | 1,751.77 (originally ~1,741.75 + positions) |
| **Lifetime PnL** | 0.42 |
| **Reputation Points** | 700 |
| **Earned Points** | 0 |
| **Invite Points** | 0 |
| **Bonus Points** | 600 |
| **Is Agent** | No |
| **On-Chain Registered** | No |
| **NFT** | None |
| **Created** | 2026-02-04 |

### 5.2 Waitlist Position

| Metric | Value |
|--------|-------|
| **Overall Position** | #482,372 of 486,652 |
| **Leaderboard Rank** | #482,372 |
| **Waitlist Position** | #472,774 |
| **Percentile** | 99 (bottom 1%) |
| **Invite Code** | limekiwi_dao |
| **Total Points** | 709 |
| **Base Points** | 110 |
| **Bonus Points** | 600 |
| **Earned Points** | -1 |
| **Invite Points** | 0 |
| **Referral Count** | 0 |

### 5.3 Points Composition

Our 2,508.73 total points break down as:
- Virtual balance: ~1,741.75
- Open position value: ~66.98 (from 4 positions)
- Reputation points: 700 (signup + bonus actions)
- The `earned: -1` in waitlist breakdown is suspicious -- likely a rounding error or small deduction

### 5.4 Profile Completion Status

- Username: Set (limekiwi_dao)
- Bio: Empty
- Profile Image: Set
- Farcaster: Not linked (missed 300+100 = 400 points)
- Twitter: Not linked (missed 300+100 = 400 points)
- Discord: Not linked (missed 300+100 = 400 points)
- Wallet: Not connected (missed 300 points)
- On-chain: Not registered

**Potential unclaimed points: ~1,500 from social linking alone.**

---

## 6. Pagination & API Behavior

### 6.1 Pagination

| Parameter | Behavior |
|-----------|----------|
| `page` | 1-indexed, defaults to 1, min=1 |
| `pageSize` | Defaults to 100, max=100, min=1 |
| `limit` | NOT supported (ignored) -- only `pageSize` works in schema but API returns 100 always when using `limit` |
| Response | Returns `pagination` object with `page`, `pageSize`, `totalCount`, `totalPages` |

**BUG/QUIRK:** When you pass `?limit=50`, the API still returns 100 entries because the schema only recognizes `pageSize`. The `limit` parameter is silently ignored. Users might expect `limit` to work.

### 6.2 User Position Feature

Passing `userId` as query parameter triggers a fresh (uncached) user position lookup. Returns:
```json
{
  "currentUser": {
    "rank": 179122,
    "page": 1792,
    "entry": { ... full user data ... }
  }
}
```

This is the only way to find a specific user's rank. There is NO search endpoint.

### 6.3 Caching

- Redis-backed cache, namespace `leaderboard`
- Cache key format: `{type}-{page}-{pageSize}`
- TTL: 120 seconds (env configurable via `LEADERBOARD_CACHE_MS`)
- Stale-while-revalidate: 360 seconds
- User position lookups bypass cache (always fresh)
- Response header `x-cache: leaderboard-hit|leaderboard-miss` indicates cache status

---

## 7. Season/Epoch Mechanics

**There are NO season or epoch mechanics.** The game operates on a continuous day counter:
- Current day: 95 (from `/api/stats`)
- Current simulated date: 2025-11-30 (game time != real time)
- Engine speed: 60,000ms per tick
- Engine status: Running (isRunning=true per stats, isRunning=false per engineStatus -- contradiction)

There is a daily snapshot system (`userPointsSnapshots` table) that records each user's totalPoints at midnight UTC. This could support future time-scoped leaderboards but currently isn't exposed via API.

---

## 8. Reward/Incentive Structure

### 8.1 Active Reward Mechanisms

1. **Reputation Points** -- one-time bonuses for social actions (signup, profile, social linking)
2. **Daily Login Streak** -- escalating daily rewards from 50-200 points, with milestone bonuses
3. **Referral System** -- 100 points per referral signup + 100 when qualified
4. **Trading PnL** -- profits from prediction markets and perps directly increase balance and thus totalPoints
5. **On-chain Registration** -- costs 100 reputation points to register

### 8.2 Missing/Not Found

- No `/api/rewards` endpoint exists
- No `/api/rewards/history` endpoint exists
- No claim mechanics found
- No XP system
- No levels
- No badges
- No achievements
- No seasonal rewards

### 8.3 Purchase System

Points can be purchased (Stripe integration exists in codebase):
- `purchase` points reason
- `purchase_refund` for refunds
- `purchase_dispute` for chargebacks
- This means leaderboard positions are partially pay-to-win

---

## 9. Game Stats Overview

From `/api/stats`:

| Metric | Value |
|--------|-------|
| Total Posts | 203,394 |
| Total Questions/Markets | 10,674 |
| Active Questions | 18 |
| Total Organizations | 60 |
| Total Actors (NPCs) | 393 |
| Current Game Day | 95 |

From `/api/admin/stats`:

| Metric | Value |
|--------|-------|
| Total Users | 562,457 |
| Actors (NPCs) | 144 |
| Real Users | 562,313 |
| Banned | 1 |
| Admins | 23 |
| Signups Today | 4,324 |
| Signups This Week | 33,103 |
| Signups This Month | 79,796 |
| Total Markets | 10,673 |
| Active Markets | 15 |
| Resolved Markets | 10,657 |
| Total Positions | 213,188 |
| Balance Transactions | 259,581 |
| NPC Trades | 191,213 |
| Total Posts | 203,426 |
| Posts Today | 2,609 |
| Comments | 515,054 |
| Reactions | 187,653 |
| Total Virtual Balance (all users) | $776,982,594.63 |
| Total Deposited | $589,270,356 |
| Total Lifetime PnL | -$126,691,515.32 |
| Referrals | 531,703 |
| Points Transactions | 1,446,243 |

---

## 10. Bugs & Issues Found

### Critical

1. **BUG: `type` parameter silently ignored for invalid values.** Passing `type=pnl`, `type=agents`, `type=volume` etc. all return the default `wallet` leaderboard with no error. Should return 400 for invalid types.

2. **BUG: `limit` parameter ignored.** The API only recognizes `pageSize` but many users/docs reference `limit`. Passing `?limit=50` returns 100 entries.

3. **BUG: Waitlist `pointsType` silently falls back.** `reputation` and `earned` types fall back to `invite` with no error.

### High

4. **NO user search on leaderboard.** The only way to find a user is to pass `userId` parameter. No search by username functionality.

5. **NO agent-only leaderboard.** `onlyAgents=true` and `category=agents` are ignored. Users cannot view agent-only rankings despite agents being a major feature.

6. **currentUser always null without explicit userId.** Even with a valid auth token, the API doesn't auto-detect the authenticated user. Must explicitly pass `userId` parameter.

7. **Engine status contradiction.** `/api/stats` returns `isRunning: true` in `stats` but `isRunning: false` in `engineStatus`.

### Medium

8. **Extreme wealth concentration concerns.** Top 2 accounts (roach_empire_420 + mdmnvest) hold ~$42.7M combined. The total virtual balance across ALL 562K users is ~$777M, so 2 users hold ~5.5% of all value. With agents, mdmnvest effectively controls ~$11.4M.

9. **No time-scoped leaderboards.** Daily snapshots are taken but not exposed. No way to see weekly/monthly/seasonal rankings.

10. **Leaderboard pagination defaults to 100.** `pageSize` defaults and maxes at 100, but the API docs in the openapi annotation say the default is 100 while the limit parameter from user's URL is ignored.

### Low

11. **Non-existent endpoints return HTML.** `/api/leaderboard/me`, `/api/rewards`, etc. return full HTML pages instead of 404 JSON responses. This is a Next.js catch-all behavior.

12. **Waitlist earned points = -1.** Our user has `earned: -1` in the points breakdown, suggesting a potential rounding or calculation error.

---

## 11. Recommendations

1. **Add input validation errors** for invalid `type` values instead of silent fallback
2. **Implement agent-only leaderboard** filter (frontend already has "Super Leaderboard XL" PR merged)
3. **Expose time-scoped leaderboards** using existing daily snapshots
4. **Auto-detect authenticated user** from JWT token for `currentUser` data
5. **Add username search** to leaderboard API
6. **Return proper 404 JSON** for non-existent API routes
7. **Consider anti-concentration mechanics** to keep leaderboard competitive

---

## File References

- Leaderboard API route: `apps/web/src/app/api/leaderboard/route.ts`
- Points service (leaderboard logic): `packages/api/src/services/points-service.ts`
- Total points formula: `packages/engine/src/services/total-points-service.ts`
- Points constants: `packages/shared/src/constants/points.ts`
- Query schema validation: `packages/shared/src/validation/schemas/common.ts`
- Points recompute cron: `apps/web/src/app/api/cron/points-recompute/route.ts`
