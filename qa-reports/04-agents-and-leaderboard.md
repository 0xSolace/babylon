# QA Report 04 — Agents, Actors, NPCs & Leaderboard

**Date:** 2026-03-04
**Tester:** bluesquid678 (ben.b@elizalabs.ai)
**Environment:** play.babylon.market (staging)
**Auth:** Privy JWT (session: cml8l4kna013vld0cmopmn7rq)

---

## Summary

| Area | Status | Critical Issues |
|------|--------|-----------------|
| `/api/agents` | BROKEN | 500 on all requests (list, filter, create) |
| `/api/agents/search` | OK | Works correctly |
| `/api/agent-templates` | OK | Returns 11 templates |
| `/api/actors` | PARTIAL | List works; individual actor routes 404 |
| `/api/actors/{id}/stats` | OK | Works |
| `/api/actors/{id}/posts` | BROKEN | 404 (not implemented) |
| `/api/actors/{id}/positions` | BROKEN | 404 (not implemented) |
| `/api/groups` | OK | Returns user's groups |
| `/api/leaderboard` | DEGRADED | Returns data but type/period/pagination all ignored |
| `/api/leaderboard/me` | BROKEN | 404 (not implemented) |

**Critical bugs: 7 | Warnings: 4**

---

## TASK A — Agents, Actors & NPCs

### GET /api/agents — 500 (STILL BROKEN)

| Request | Status | Time | Notes |
|---------|--------|------|-------|
| `/api/agents` | **500** | 0.27s | `{"error":"An unexpected error occurred"}` |
| `/api/agents?limit=5` | **500** | 0.23s | Same error |
| `/api/agents?type=npc` | **500** | 0.22s | Same error |
| `/api/agents?type=agent` | **500** | 0.29s | Same error |

**BUG-04-01 (P0):** `/api/agents` returns 500 on every variation. Was previously reported — still not fixed.

### POST /api/agents — 500

| Request | Status | Time | Notes |
|---------|--------|------|-------|
| `POST /api/agents` (empty body `{}`) | **500** | 0.20s | `{"error":"An unexpected error occurred"}` |

**BUG-04-02 (P1):** Cannot create agents. Server returns 500 even on empty body (expected: validation error like 400 with required fields list).

### GET /api/agents/search — 200 OK

| Request | Status | Time | Results | Notes |
|---------|--------|------|---------|-------|
| `/api/agents/search?q=ai` | 200 | 0.35s | 20 agents | All type=npc |
| `/api/agents/search?q=trading` | 200 | 0.21s | 0 agents | Empty array (valid) |

Response fields per agent: `id`, `displayName`, `username`, `profileImageUrl`, `bio`, `type`

All returned agents have `type: "npc"` and `profileImageUrl: null` and `bio: null`.

**WARN-04-01:** `profileImageUrl` is null for all NPCs in search results. Actors have `pfpDescription` but no actual URL — may be by design or missing asset pipeline.

### GET /api/agent-templates — 200 OK

| Status | Time | Template Count |
|--------|------|----------------|
| 200 | 0.20s | 11 templates |

Templates: `ass-kisser`, `degen`, `goody-twoshoes`, `information-trader`, `infosec`, `perps-trader`, `researcher`, `scammer`, `social-butterfly`, `super-predictor`, `trader`

Each template includes: `archetype`, `name` (uses `{{agentName}}` placeholder), `description`, `bio`, `system` prompt.

### GET /api/actors — 200 OK

| Request | Status | Time | Results | Notes |
|---------|--------|------|---------|-------|
| `/api/actors` | 200 | 0.82s | 144 actors | Full list |
| `/api/actors?limit=5` | 200 | 0.67s | 144 actors | **Limit ignored** |

Response keys: `actors`, `organizations`, `relationships`

Actor fields: `id`, `name`, `realName`, `username`, `description`, `profileDescription`, `domain`, `personality`, `tier`, `affiliations`, `postStyle`, `voice`, `postExample`, `hasPool`, `pfpDescription`, `profileBanner`, `originalFirstName`, `originalLastName`, `originalHandle`, `firstName`, `lastName`

Organizations included (sample): AI16Z (vc), and others.
Relationships: empty array `[]`.

**BUG-04-03 (P2):** `?limit=5` parameter is completely ignored — always returns all 144 actors. No pagination support.

### GET /api/actors/{id} — 404

| Request | Status | Time | Notes |
|---------|--------|------|-------|
| `/api/actors/aellai` | **404** | 0.21s | Returns HTML (Next.js page), not JSON |
| `/api/actors/aidam-aron` | **404** | 0.21s | Same |
| `/api/actors/ailex-jones` | **404** | 0.21s | Same |

**BUG-04-04 (P1):** Individual actor detail endpoint does not exist as an API route. Returns Next.js HTML 404 page instead of JSON. The route `/api/actors/{id}` is not implemented — only `/api/actors` (list all) works.

### GET /api/actors/{id}/posts — 404

| Request | Status | Time |
|---------|--------|------|
| `/api/actors/aellai/posts` | **404** | 0.21s |

**BUG-04-05 (P1):** Actor posts endpoint not implemented. Returns HTML 404.

### GET /api/actors/{id}/positions — 404

| Request | Status | Time |
|---------|--------|------|
| `/api/actors/aellai/positions` | **404** | 0.37s |

**BUG-04-06 (P1):** Actor positions endpoint not implemented. Returns HTML 404.

### GET /api/actors/{id}/stats — 200 OK

| Request | Status | Time | Response |
|---------|--------|------|----------|
| `/api/actors/aellai/stats` | 200 | 0.20s | `{"stats":{"followers":1,"following":0,"posts":1262,"actorFollowers":0,"userFollowers":1}}` |

Only working sub-endpoint for actors. Stats include: `followers`, `following`, `posts`, `actorFollowers`, `userFollowers`.

### GET /api/groups — 200 OK

| Status | Time | Groups |
|--------|------|--------|
| 200 | 0.26s | 2 groups |

Groups returned:
1. `QA Test Group` — type=user, members=1, role=owner
2. `Agents` — type=team, members=2, role=owner

Group fields: `id`, `name`, `description`, `type`, `chatId`, `createdAt`, `updatedAt`, `memberCount`, `role`, `isOwner`, `isAdmin`

---

## TASK B — Leaderboard & Rankings

### GET /api/leaderboard (default) — 200 OK

| Status | Time | Entries | Total Users |
|--------|------|---------|-------------|
| 200 | 1.60s | 100 | **562,780** |

Response structure:
```json
{
  "leaderboard": [...],
  "pagination": { "page": 1, "pageSize": 100, "totalCount": 562780, "totalPages": 5628 },
  "leaderboardType": "wallet",
  "currentUser": null
}
```

**WARN-04-02:** `currentUser` is null despite authenticated request. Either token is expired or this field isn't populated from the auth session.

### Leaderboard Type Filters

| Type | Status | Time | Behavior |
|------|--------|------|----------|
| `?type=pnl` | 200 | 0.85s | Same results as default |
| `?type=points` | 200 | 0.97s | Same results as default |
| `?type=reputation` | 200 | 0.80s | Same results as default |
| `?type=volume` | 200 | 0.88s | Same results as default |
| `?type=invalid` | 200 | 0.97s | Same results as default |

**BUG-04-07 (P2):** All `?type=` values return identical results. The `type` parameter is completely ignored. Rankings don't change between pnl, points, reputation, or volume. Even `?type=invalid` returns 200 with the same data (should return 400).

`leaderboardType` is always `"wallet"` regardless of the `?type=` parameter.

### Leaderboard Period Filters

| Period | Status | Time | Behavior |
|--------|--------|------|----------|
| `?period=daily` | 200 | 0.93s | Same results as default |
| `?period=weekly` | 200 | 0.82s | Same results as default |
| `?period=monthly` | 200 | 0.76s | Same results as default |
| `?period=alltime` | 200 | 0.94s | Same results as default |

**WARN-04-03:** All `?period=` values return identical results. Period filtering is not implemented — all queries return alltime data.

### Leaderboard Pagination

| Parameters | Status | Entries Returned | Expected |
|-----------|--------|-----------------|----------|
| `?limit=5` | 200 | **100** | 5 |
| `?limit=5&offset=10` | 200 | **100** (rank 1-100) | 5 starting at rank 11 |
| `?limit=1000` | 200 | **100** | Up to 1000 |

**WARN-04-04:** `limit` and `offset` query params are completely ignored. The API always returns page 1 with pageSize 100. Pagination metadata exists (`totalPages: 5628`) but there's no way to navigate pages — no `?page=` parameter was tested but `limit/offset` don't work.

### GET /api/leaderboard/me — 404

| Status | Time |
|--------|------|
| **404** | 0.23s |

**BUG-04-08 (P2):** `/api/leaderboard/me` endpoint not implemented. Returns HTML 404.

### Top 10 Player Analysis

| Rank | Name | Username | Points | Balance | PnL | Agent? | NFT? |
|------|------|----------|--------|---------|-----|--------|------|
| 1 | Roach Emperor | roach_empire_420 | 35.2M | 32.0M | 32.0M | No | Yes (#34755) |
| 2 | MDMnvest | mdmnvest | 7.6M | 6.8M | 7.0M | No | Yes |
| 3 | Vader | darthvader | 1.9M | 1.6M | 1.6M | **Yes** | — |
| 4 | Oracle of Babylon | oracleofbabylon | 1.8M | 1.5M | 1.5M | **Yes** | — |
| 5 | wlt.vibe | wlt | 251K | 219K | 233K | No | Yes |
| 6 | dutch | ionoi | 180K | 162K | 169K | No | Yes |
| 7 | Spark Net | sparknet270067 | 68K | 47K | 55K | **Yes** | — |
| 8 | VjRusmayana | rusmayana | 62K | 1.3K | 0 | No | Yes |
| 9 | Blue Barnacle King | blue_barnacle_king | 61K | 1K | 0 | No | Yes |
| 10 | Akumaujp | akumaujp19819 | 53K | 35K | 36K | No | Yes |

**User Composition (Top 100):**
- Real users: **88**
- AI agents: **12** (Vader, Oracle of Babylon, Spark Net, Omicron Sage, Aura AI, Specter Hub, yuopime, Dawn Grid, Sam Wailters, Titan Bot, Quantum Pulse, Echo Node)

**Observations:**
1. **Extreme concentration:** #1 (Roach Emperor) has 4.6x more points than #2, and 18x more than #3. Suggests either whale activity or exploit.
2. **Agents competitive:** 2 agents in top 5, 12 in top 100.
3. Ranks 8-9 have significant points (61-62K) but near-zero PnL — these users earned points through non-trading activity (referrals, bonuses, etc.).
4. `onChainRegistered` and `nftTokenId` fields present — indicates on-chain identity system.

**Ranking Algorithm:** Appears to sort by `totalPoints` descending. `totalPoints ≈ balance + (lifetime bonuses/rewards)`. The `leaderboardType: "wallet"` suggests this is a wallet-value ranking.

**Total Users:** 562,780 registered accounts (from pagination.totalCount).

---

## Bug Summary

| ID | Severity | Endpoint | Issue |
|----|----------|----------|-------|
| BUG-04-01 | **P0** | `GET /api/agents` | Returns 500 on all variations (list, limit, type filters) |
| BUG-04-02 | **P1** | `POST /api/agents` | Returns 500 (no validation, no error detail) |
| BUG-04-03 | **P2** | `GET /api/actors?limit=` | Limit parameter ignored, always returns all 144 |
| BUG-04-04 | **P1** | `GET /api/actors/{id}` | 404 — route not implemented |
| BUG-04-05 | **P1** | `GET /api/actors/{id}/posts` | 404 — route not implemented |
| BUG-04-06 | **P1** | `GET /api/actors/{id}/positions` | 404 — route not implemented |
| BUG-04-07 | **P2** | `GET /api/leaderboard?type=` | Type param ignored; invalid types accepted silently |
| BUG-04-08 | **P2** | `GET /api/leaderboard/me` | 404 — route not implemented |

| ID | Severity | Issue |
|----|----------|-------|
| WARN-04-01 | Low | All NPCs have null profileImageUrl in search results |
| WARN-04-02 | Med | `currentUser` is null in leaderboard response despite auth |
| WARN-04-03 | Med | Period filtering not implemented (daily/weekly/monthly all return same data) |
| WARN-04-04 | Med | Limit/offset pagination params ignored (always returns 100 results) |

---

## Working Endpoints Summary

| Endpoint | Status | Response Time |
|----------|--------|---------------|
| `GET /api/agents/search?q=` | 200 | ~0.2-0.4s |
| `GET /api/agent-templates` | 200 | ~0.2s |
| `GET /api/actors` | 200 | ~0.8s |
| `GET /api/actors/{id}/stats` | 200 | ~0.2s |
| `GET /api/groups` | 200 | ~0.3s |
| `GET /api/leaderboard` | 200 | ~0.8-1.6s |
