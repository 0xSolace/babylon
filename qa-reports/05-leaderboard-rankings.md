# QA Report: Leaderboard & Rankings

**Date:** 2026-03-04
**Tester:** Automated QA
**Base URL:** https://play.babylon.market
**Auth:** Cookie-based (privy-token)

---

## Summary

4 leaderboard endpoints discovered. The main `/api/leaderboard` endpoint works for `type=wallet` but has critical bugs: `type=team` with `userId` causes a 500 error, `currentUser` is never populated from auth cookies (requires explicit `userId` param), and all query parameters besides `page`, `pageSize`, `type`, and `userId` are silently ignored.

---

## Endpoints Discovered

| Endpoint | Status | Description |
|----------|--------|-------------|
| `GET /api/leaderboard` | 200 | Main leaderboard (wallet or team mode) |
| `GET /api/waitlist/leaderboard` | 200 | Waitlist/referral leaderboard |
| `GET /api/reputation/leaderboard` | 200 | Reputation-based leaderboard |
| `GET /api/npc/performance/leaderboard` | 200 | NPC/actor performance leaderboard |
| `GET /api/stats` | 200 | Game statistics |
| `GET /api/actors` | 200 | Actor/NPC listing |
| `GET /leaderboard` | 200 | Frontend leaderboard page |

### Endpoints That Do NOT Exist (all return 404)

`/api/leaderboard/me`, `/api/leaderboard/agents`, `/api/leaderboard/super`, `/api/leaderboard/perps`, `/api/leaderboard/predictions`, `/api/leaderboard/search`, `/api/rankings`, `/api/stats/daily`, `/api/stats/summary`, `/api/user/rank`, `/api/user/stats`, `/api/profile/stats`, `/api/me`, `/api/pnl/leaderboard`, `/api/points/leaderboard`

---

## 1. GET /api/leaderboard (Main Leaderboard)

### Accepted Parameters (from source code)

| Parameter | Type | Default | Valid Values | Notes |
|-----------|------|---------|-------------|-------|
| `type` | string | `wallet` | `wallet`, `team` | Any other value silently falls back to `wallet` |
| `page` | int | 1 | >= 1 | page=0 is coerced to 1; page=-1 returns empty |
| `pageSize` | int | 100 | 1-100 | Clamped: 0 -> 1, >100 -> 100 |
| `userId` | string | - | privy DID | Returns user's rank alongside leaderboard |

### Response Structure (type=wallet)

```json
{
  "leaderboard": [
    {
      "id": "did:privy:...",
      "username": "roach_empire_420",
      "displayName": "Roach Emperor",
      "profileImageUrl": "https://...",
      "totalPoints": 35155667.52,
      "balance": 31956934.52,
      "lifetimePnL": 31959335.79,
      "createdAt": "2025-11-24T18:36:04.770Z",
      "isAgent": false,
      "managedBy": null,
      "onChainRegistered": true,
      "nftTokenId": 34755,
      "rank": 1
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "totalCount": 562551,
    "totalPages": 5626
  },
  "leaderboardType": "wallet",
  "currentUser": null
}
```

### Response Structure (type=team)

Additional fields per entry compared to wallet mode:
- `teamTotalPoints` - combined user + agent points
- `userPoints` - user's individual points
- `agentPoints` - sum of all agent points
- `agentCount` - number of agents owned
- No `managedBy` field (agents excluded from team view)

### Wallet Leaderboard Statistics

- **Total users:** ~562,551 (fluctuates as new users register)
- **Top user:** roach_empire_420 with 35,155,667 points
- **#2:** mdmnvest with 7,580,509 points (4.6x gap from #1)
- **#10:** ~53,465 points
- **#100:** ~17,300 points
- **#1000:** ~5,200 points
- **#5000:** ~3,900 points
- **Bottom:** ~562,500+ users with 0 points, 0 PnL
- **Default balance:** New users start with 1,000-2,000 balance

### Team Leaderboard Statistics

- **Total teams:** ~562,419 (fewer than wallet, agents excluded)
- Top teams show agents contributing significant points (e.g., mdmnvest has 3.8M agent points on top of 7.6M user points)

### Agents in Top 100

12 agents appear in the wallet top 100, all with `onChainRegistered: false` and `nftTokenId: null`. Most are managed by a single user (did:privy:cmi90tklb00jijs0cqw9571ie) who manages 2 of the top 4.

### Sorting

The leaderboard is sorted by `totalPoints` in descending order. Points are monotonically decreasing across ranks -- verified correct.

### Tie Handling

Users with identical `totalPoints` receive unique sequential ranks rather than tied ranks. For example, at the ~5,200 points level, 20+ users share the same score but get ranks 981-1000. This is a **design decision** (not necessarily a bug) but differs from traditional tie-handling where tied users share the same rank.

### Pagination

- `page` and `pageSize` work correctly
- Page boundaries are contiguous (page 1 last = rank 5, page 2 first = rank 6)
- Deep pages work (page 5626 returns last 71 entries)
- Page beyond total returns empty `leaderboard` array with correct pagination metadata
- `offset` and `limit` parameters are **ignored** (only `page`/`pageSize` work)

### Caching

- Response header: `x-cache: leaderboard-hit` or `leaderboard-miss`
- `Cache-Control: public` for anonymous, `private, no-store` when `userId` is provided
- Cache TTL: 120 seconds (from source code, env-configurable)
- Redis-backed cache keyed by `{type}-{page}-{pageSize}`

---

## 2. GET /api/waitlist/leaderboard

### Response Structure

```json
{
  "leaderboard": [
    {
      "id": "did:privy:...",
      "userId": "did:privy:...",
      "username": "blue_barnacle_king",
      "displayName": "Blue Barnacle King",
      "points": 29100,
      "invitePoints": 29100,
      "reputationPoints": 60100,
      "referralCount": 304,
      "rank": 1
    }
  ],
  "totalShown": 10,
  "page": 1,
  "totalPages": 10,
  "hasMore": true,
  "pointsType": "invite"
}
```

### Parameters

| Parameter | Effect |
|-----------|--------|
| `page` | Pagination works (page=2 returns ranks 11-20) |
| `type`, `pointsType`, `sort`, `sortBy` | ALL IGNORED -- always returns invite-sorted |

### Notes

- Always sorted by `invitePoints`, always `pointsType: "invite"`
- `type=reputation`, `pointsType=reputation`, `sort=reputation` all have no effect
- 10 entries per page, 10 total pages (100 total entries)
- Different pagination structure from main leaderboard (`totalShown`, `hasMore` vs `pagination` object)

---

## 3. GET /api/reputation/leaderboard

### Response Structure

```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "userId": "...",
      "username": "Lawyered",
      "displayName": "Lawyered",
      "profileImageUrl": "...",
      "isActor": false,
      "reputationScore": 70,
      "trustLevel": "UNRATED",
      "confidenceScore": 0,
      "gamesPlayed": 0,
      "winRate": 0,
      "normalizedPnL": 0.5
    }
  ],
  "metadata": { "count": 2, "limit": 100, "minGames": 5 }
}
```

### Parameters

| Parameter | Effect |
|-----------|--------|
| `limit` | Works (limits number of results) |
| `minGames` | Works (default=5, set to 0 to see all entries) |

### Notes

- With default `minGames=5`, returns 0 results (no one has played 5+ games)
- With `minGames=0`, only 2 entries exist, both with `reputationScore=70`, `trustLevel=UNRATED`, and `gamesPlayed=0`
- Appears to be a new/early-stage feature with minimal data

---

## 4. GET /api/npc/performance/leaderboard

### Response Structure

```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "actorId": "vitailik-buterin",
      "actorName": "VitAIlik Buterin",
      "personality": "protocol savant",
      "profileImageUrl": "/images/actors/vitailik-buterin.jpg",
      "poolId": "vitailik-buterin",
      "performance": {
        "totalValue": 350000,
        "roi": 0,
        "unrealizedPnL": 0,
        "positionCount": 1030,
        "utilization": 0
      }
    }
  ]
}
```

### Parameters

| Parameter | Effect |
|-----------|--------|
| `limit` | Works (limits number of results) |

### Notes

- 50 NPCs total, all with `roi: 0`, `unrealizedPnL: 0`, `utilization: 0`
- Only `totalValue` and `positionCount` vary across NPCs
- Includes 2 test entries: "Test Trader NPC" and "Test Analyst NPC" with 0 positions
- `profileImageUrl` uses relative paths (`/images/actors/...`) unlike user leaderboard which uses absolute URLs

---

## 5. GET /api/stats

### Response Structure

```json
{
  "success": true,
  "stats": {
    "totalPosts": 203604,
    "totalQuestions": 10681,
    "activeQuestions": 15,
    "totalOrganizations": 60,
    "totalActors": 394,
    "currentDay": 95,
    "isRunning": true
  },
  "engineStatus": {
    "isRunning": false,
    "initialized": false,
    "currentDay": 95,
    "currentDate": "2025-11-30T04:10:21.266Z",
    "speed": 60000,
    "lastTickAt": "2026-03-04T13:17:49.995Z"
  }
}
```

### Notes

- `stats.isRunning: true` but `engineStatus.isRunning: false` -- contradictory
- `engineStatus.currentDate` is "2025-11-30" but `lastTickAt` is "2026-03-04" -- 3 months apart
- No auth required to access

---

## Bugs Found

### BUG-1: CRITICAL -- type=team with userId causes 500 error

**Endpoint:** `GET /api/leaderboard?type=team&userId=<any_valid_id>`
**Response:** `{"error": "An unexpected error occurred"}`
**Expected:** Team leaderboard with user's team rank
**Impact:** Users cannot see their team ranking. The `getUserPosition()` function likely fails when called with `leaderboardType=team`.

### BUG-2: HIGH -- type parameter silently ignores all invalid values

**Endpoint:** `GET /api/leaderboard?type=pnl` (or any non-wallet/team value)
**Behavior:** Silently falls back to `wallet` type, returns `leaderboardType: "wallet"`
**Expected:** Should return 400 validation error for invalid type values, or at minimum document this behavior. Currently `type=pnl`, `type=points`, `type=volume`, `type=streak`, `type=predictions`, `type=perps` all silently return the wallet leaderboard with no indication the type was invalid.

### BUG-3: HIGH -- currentUser never populated from auth cookie

**Endpoint:** `GET /api/leaderboard` (with valid privy-token cookie)
**Behavior:** `currentUser: null` always, even when authenticated
**Root Cause:** The endpoint requires an explicit `userId` query parameter -- it does not extract the user ID from the auth cookie. This means the frontend must pass the userId explicitly.
**Impact:** No way to get current user's rank without knowing their DID and passing it as a query parameter. This is a design limitation rather than a bug if the frontend always passes userId.

### BUG-4: MEDIUM -- Null username/displayName for ~73% of bottom users

**Endpoint:** `GET /api/leaderboard?page=5625`
**Observation:** 73 of 100 entries have `username: null` and `displayName: null`
**Expected:** Every user should have at least a username or display name
**Impact:** Rendering issues on the frontend leaderboard for late pages

### BUG-5: MEDIUM -- Waitlist leaderboard ignores all sorting/filtering params

**Endpoint:** `GET /api/waitlist/leaderboard?type=reputation` (and all other sort params)
**Behavior:** Always returns invite-point-sorted leaderboard regardless of parameters
**Expected:** Should support sorting by reputation points or referral count, or return error for unsupported params

### BUG-6: LOW -- NPC leaderboard includes test entries

**Endpoint:** `GET /api/npc/performance/leaderboard`
**Observation:** "Test Trader NPC" (#46) and "Test Analyst NPC" (#47) appear with 0 positions
**Expected:** Test entries should be filtered out in production

### BUG-7: LOW -- Stats endpoint shows contradictory engine status

**Endpoint:** `GET /api/stats`
**Observation:** `stats.isRunning: true` but `engineStatus.isRunning: false`; `engineStatus.currentDate` is 3+ months behind `lastTickAt`
**Expected:** Consistent status reporting

### BUG-8: LOW -- All NPC ROI/PnL values are 0

**Endpoint:** `GET /api/npc/performance/leaderboard`
**Observation:** All 50 NPCs show `roi: 0`, `unrealizedPnL: 0`, `utilization: 0`
**Expected:** With 800-1294 positions each, NPCs should have non-zero performance metrics

### BUG-9: INFO -- Inconsistent pagination patterns across endpoints

| Endpoint | Pagination Style |
|----------|-----------------|
| `/api/leaderboard` | `pagination: { page, pageSize, totalCount, totalPages }` |
| `/api/waitlist/leaderboard` | `totalShown, page, totalPages, hasMore` (flat) |
| `/api/reputation/leaderboard` | `metadata: { count, limit, minGames }` |
| `/api/npc/performance/leaderboard` | No pagination |

---

## Input Validation

### Properly Validated

| Input | Response |
|-------|----------|
| `pageSize=abc` | 400: `{"error":"Validation failed","details":[{"field":"pageSize","message":"Invalid input: expected number, received NaN"}]}` |
| `page=abc` | 400: `{"error":"Validation failed","details":[{"field":"page","message":"Invalid input: expected number, received NaN"}]}` |
| `pageSize=-5` | 400: `{"error":"Validation failed","details":[{"field":"pageSize","message":"Too small: expected number to be >=0"}]}` |
| SQL injection (`page=1;DROP TABLE`) | 400 (rejected by number coercion) |

### Edge Cases Handled

| Input | Behavior |
|-------|----------|
| `page=0` | Coerced to page=1 (correct) |
| `page=-1` | Returns empty results with empty pagination |
| `pageSize=0` | Coerced to 1 (correct) |
| `pageSize=1000` | Clamped to 100 (correct) |
| `page=99999` (beyond total) | Returns empty leaderboard, correct pagination |
| Nonexistent `userId` | Returns `currentUser: null` (no error) |

### Silently Ignored Parameters (not validated, no effect)

`type` (non-wallet/team), `sort`, `sortBy`, `order`, `search`, `q`, `username`, `period`, `category`, `gameType`, `filter`, `include`, `agents`, `isAgent`, `offset`, `limit`

---

## HTTP Method Testing

| Method | Status |
|--------|--------|
| GET | 200 (normal operation) |
| POST | 405 (correctly rejected) |
| PUT | 405 (correctly rejected) |
| DELETE | 405 (correctly rejected) |

---

## Authentication

- Leaderboard is accessible **without authentication** (same data for authed/unauthed)
- Auth cookie is NOT used to identify current user -- explicit `userId` param required
- No rate limiting observed during testing

---

## Performance

| Request | Response Time |
|---------|--------------|
| Page 1, 100 results (cached) | ~0.8s |
| Page 5000, 100 results (deep) | ~1.3s |
| Uncached requests | ~1-2s |

---

## Source Code Reference

- **Route handler:** `apps/web/src/app/api/leaderboard/route.ts`
- **Query schema:** `packages/shared/src/validation/schemas/common.ts` (line 421)
- **Valid types:** `wallet` (default), `team`
- **Cache TTL:** 120s (env: `LEADERBOARD_CACHE_MS`)
- **Services:** `PointsService.getWalletLeaderboard()`, `PointsService.getTeamLeaderboard()`, `PointsService.getUserPosition()`
