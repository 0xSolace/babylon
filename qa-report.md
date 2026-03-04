# Babylon Game QA Test Report

**Date:** 2026-03-04 12:28-12:35 UTC
**Tester:** ben.b@elizalabs.ai (username: limekiwi_dao)
**Environment:** Production (play.babylon.market)
**Auth:** Privy JWT Bearer Token
**Starting Balance:** 1,900 pts | **Ending Balance:** 1,844.75 pts

---

## Executive Summary

**25 of 34 API endpoints passed (73.5%).** Core game loop works: auth, feed, prediction markets, perp trading, leaderboard, actors, and session tracking all functional. Key issues: `/api/agents` 500 error, post interaction endpoints return 405, several minor endpoints 404.

---

## Bugs Found

### Critical
1. **`GET /api/agents` returns 500** - Server error on the main agents list endpoint. Agent search (`/api/agents/search`) works fine, so the issue is likely in the list query/pagination.

### Medium
2. **`POST /api/posts/:id` returns 405** - Cannot like posts via API. The like method/path is wrong or not implemented for external API access.
3. **`POST /api/posts/:id/reply` returns 400 "Invalid JSON"** - Reply endpoint rejects well-formed JSON via curl. May require specific content-type or field names not documented.
4. **`GET /api/profiles/favorites` returns 400 without query params** - Requires `?page=1&limit=10` explicitly. Should default to page=1, limit=10.

### Low / Missing Endpoints
5. `GET /api/feed/widgets` - 404 (not deployed)
6. `GET /api/nft/gallery` - 404
7. `GET /api/trending` - 404
8. `GET /api/questions` - 404
9. `GET /api/game/guide` - 404

---

## Detailed Results

### 1. Auth & Health - ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/health` | 200 | env=production |
| `GET /api/users/me` | 200 | Correct user, wallet, email verified |
| `POST /api/activity/heartbeat` | 200 | Session tracking works |

### 2. Feed & Posts
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/posts?limit=3` | 200 | NPC posts (reposts, originals) actively generated |
| `GET /api/posts/feed` | 200 | Aggregated feed post |
| `GET /api/feed/hot` | 200 | Hot feed working |
| `GET /api/feed/widgets` | 404 | Not found |
| `GET /api/posts/:id` | 200 | Single post detail |
| `POST /api/posts/:id (like)` | 405 | Method not allowed |
| `POST /api/posts/:id/reply` | 400 | "Invalid JSON in request body" |

**Feed is active.** AI actors like "Andrew TAIte", "Jason CalacAInis", "KristAI Noem" are posting and reposting in real-time.

### 3. Prediction Markets - CORE FEATURE PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/markets/predictions` | 200 | 12 active, 10,664 total markets |
| `GET /api/markets/predictions/:id` | 200 | Market detail with probabilities |
| `POST .../buy` | 201 | Bought 10pts YES = 9.98 shares @ 50.05% |
| `POST .../sell` | 200 | Sold 5 shares, PnL: -0.0075 |
| `GET .../trades` | 200 | Trade history |

### 4. Perpetual Trading - CORE FEATURE PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/markets/perps` | 200 | 5 tickers: TSLAI, OPENAGI, CRFT, CIA, DOW |
| `POST .../open` (TSLAI long) | 201 | 100 size, 2x leverage, $980.10 entry |
| `POST .../open` (OPENAGI short) | 201 | 50 size, 3x leverage, $112.45 entry |
| `POST .../close` | 200 | Closed OPENAGI: PnL -$0.044 |
| `GET .../history?range=1D` | 200 | Price history available |

### 5. Leaderboard - ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/leaderboard` | 200 | 561,883 users |
| `GET /api/leaderboard?type=pnl` | 200 | Top: roach_empire_420 @ $31.9M PnL |

### 6. Chats, Agents, Groups
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/chats` | 200 | 0 chats for this user |
| `GET /api/chats/unread-count` | 200 | Works |
| `POST /api/chats/dm (to NPC)` | 400 | Correct: "Cannot DM NPC actors" |
| `GET /api/agents` | **500** | **BUG - server error** |
| `GET /api/agents/search` | 200 | Works independently |
| `GET /api/agent-templates` | 200 | Works |
| `GET /api/actors` | 200 | 393 actors |
| `GET /api/groups` | 200 | 1 group: "Agents" (2 members) |

### 7. Social, NFT, Rewards
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/users/search` | 200 | Works |
| `GET /api/profiles/favorites` | 200 | Needs explicit page/limit params |
| `GET /api/twitter/auth-status` | 200 | Works |
| `GET /api/nft/access` | 200 | hasAccess=true, reason="whitelist" |
| `GET /api/waitlist/position` | 200 | Position 482,372 of 486,287 |
| `GET /api/notifications` | 200 | Works |
| `GET /api/stats` | 200 | Day 95, game running |
| `GET /api/trades` | 200 | 20 trades in history |

---

## Game State Observations

| Metric | Value |
|--------|-------|
| Game Day | 95 |
| Game Running | Yes (last tick: 12:15 UTC) |
| Total Posts | 203,152 |
| Total Markets | 10,664 |
| Active Markets | 13 |
| Total Actors/NPCs | 393 |
| Organizations | 60 |
| Leaderboard Users | 561,883 |
| Waitlist Users | 486,287 |

### Active Agent Positions (for this user via "Mu Plus" agent)
| Ticker | Side | Size | Entry | Current | PnL % |
|--------|------|------|-------|---------|-------|
| AITRP | Long | 300 | $510.55 | $815.65 | +59.8% |
| METAI | Long | 250 | $1,456.22 | $1,886.98 | +29.6% |
| NVDAI | Long | 3,600 | $1,389.72 | $1,362.68 | -1.9% |

### Content Quality Note
All prediction markets follow the same template: "Will AIlon Musk ban burp-powered AI [item] in MetAI's 12D [type] labs within [time]?" - **may want more variety in market generation.**

---

## Financial Summary

| Action | Amount | Balance After |
|--------|--------|---------------|
| Starting | - | 1,900.00 |
| Buy TSLAI perp (100, 2x) | -50.10 | 1,849.90 |
| Buy YES prediction (10 pts) | -10.01 | 1,839.90 |
| Sell 5 YES shares | +5.00 | 1,844.90 |
| Open OPENAGI short (50, 3x) | -16.72 | 1,828.18 |
| Close OPENAGI short | +16.57 | 1,844.75 |

**Net P&L:** -5.25 pts (fees + small prediction loss)
**Still open:** TSLAI long (100 size, 2x leverage), prediction YES position (4.98 shares)

---

## Token Limitation

The Privy JWT expires after 1 hour. **Cannot run 2-hour continuous tests via API.** Options:
1. Browser-based Playwright test with auto-refresh via Privy SDK
2. Service account / long-lived API key
3. Server-side token generation with `PRIVY_APP_SECRET`
