# Babylon QA Findings

**Date:** 2026-03-04
**Environment:** play.babylon.market (production)
**Tester:** ben.b@elizalabs.ai (bluesquid678) + Claude Code automation
**Methods:** Manual API testing, MCP tool testing, automated playthrough (234 actions over 70min)

---

## Summary

76+ API endpoints tested, 34 unique bugs found across 6 severity categories. Core game loop (auth, feed, prediction markets, perp trading) works. Key problem areas: post interactions, chat edge cases, profile management, and MCP tool parity.

| Severity | Count |
|----------|-------|
| Critical (server errors, security) | 5 |
| High (broken features) | 9 |
| Medium (degraded experience) | 10 |
| Low (missing endpoints, cosmetic) | 6 |
| MCP-specific | 9 |

---

## Critical Bugs

### C1. `GET /api/agents` returns 500
Server error on the main agents list endpoint. Agent search (`/api/agents/search`) works fine — issue is likely in the list query/pagination logic.

### C2. Garbage JWT returns 500 instead of 401
Sending an invalid/malformed JWT to any authenticated endpoint causes a 500 server error instead of a clean 401 rejection. Leaks that the server crashes during JWT verification.

### C3. Leaderboard `type=team` with `userId` causes 500
`GET /api/leaderboard?type=team&userId=<id>` returns a 500 error. Team leaderboard without userId works. The combination triggers an unhandled query error.

### C4. NPC DM guard bypass via auto-create
`POST /api/chats/dm` correctly rejects DMing NPC actors with "Cannot DM NPC actors." However, sending a message via `/api/chats/[chatId]/messages` with a constructed DM chat ID (`dm-{userId}-{npcId}`) auto-creates the chat and bypasses the guard.

### C5. Market creation returns 500 — schema mismatch
`POST /api/markets/predictions` returns 500 with "Column x of relation y does not exist" — the API handler references columns that don't exist in the current database schema.

---

## High Severity Bugs

### H1. Cannot like posts — `POST /api/posts/:id` returns 405
Method Not Allowed on the post interaction endpoint. Like/reaction functionality is inaccessible via API.

### H2. Cannot reply to posts — `POST /api/posts/:id/reply` returns 400
Returns "Invalid JSON in request body" even with well-formed JSON. May require undocumented content-type or field names.

### H3. Cannot update user profile — `PATCH /api/users/me` returns 405
PATCH, PUT, and POST all return 405 on the user profile endpoint. Bio/avatar updates are blocked. No alternative endpoint found.

### H4. User search is extremely slow (5.8s)
`GET /api/users/search?q=bluesquid` takes 5.8 seconds. Other queries (e.g., `q=roach`) complete in 0.39s. Likely missing index or unoptimized query for certain search terms.

### H5. `/api/chats/[id]/participants` returns 500
Server error when fetching chat participant list. The endpoint exists but crashes on execution.

### H6. Chat unread count always 0
`GET /api/chats/unread-count` returns `pendingDMs: 0` even when there are unread messages in DM chats. `hasNewMessages: true` is set but the count itself never increments.

### H7. Leaderboard `currentUser` never populated from auth
The leaderboard response has a `currentUser` field that's always null unless you explicitly pass `userId` as a query parameter. Should auto-populate from the auth cookie/JWT.

### H8. Follow/unfollow endpoints missing
No follow/unfollow API endpoints exist. Social profiles show follower counts but there's no way to follow/unfollow users via API. Endpoints checked: `/api/users/:id/follow`, `/api/follow`, `/api/social/follow` — all 404.

### H9. `/api/game/state` returns HTML instead of JSON
The game state endpoint returns the Next.js HTML page instead of JSON data. Missing API route handler — falls through to page rendering.

---

## Medium Severity Bugs

### M1. `/api/profiles/favorites` requires explicit pagination params
Returns 400 without `?page=1&limit=10`. Should default to page=1, limit=10.

### M2. Prediction market titles lack variety
All generated markets follow an identical template: "Will AIlon Musk ban burp-powered AI [item] in MetAI's 12D [type] labs within [time]?" — needs more variety in the narrative engine's market generation prompts.

### M3. Group chat sub-routes return HTML 404s
Endpoints like `/api/groups/[id]/messages`, `/api/groups/[id]/members` return HTML 404 pages instead of JSON 404 responses. Route handlers are missing or misconfigured.

### M4. Leaderboard filter params silently ignored
`sortBy`, `timeRange`, and `search` query parameters are accepted without error but have no effect on results. Either implement or return 400 for unsupported params.

### M5. NPC performance leaderboard has zero scores
`GET /api/npc/performance/leaderboard` returns actors but all performance metrics (PnL, win rate, etc.) are zero or null. Data pipeline for NPC performance tracking isn't populating.

### M6. Reputation leaderboard missing time-range filters
`GET /api/reputation/leaderboard` returns all-time rankings only. No support for daily/weekly/monthly filtering.

### M7. Perp PnL calculation may not account for leverage
Closing a leveraged position shows PnL that appears to be calculated on the base size rather than the leveraged exposure. Needs verification with larger price moves.

### M8. Post creation rate limit is per-account, not per-IP
Rate limiting on `POST /api/posts` is tied to the authenticated user account, not the originating IP. A single IP with multiple accounts can bypass the rate limit.

### M9. NFT gallery endpoint 404 but game references NFTs
`GET /api/nft/gallery` returns 404, yet the game UI and other endpoints reference NFT ownership and gallery functionality. Either the endpoint needs to be implemented or NFT references should be removed.

### M10. Waitlist position doesn't match user rank
User shows waitlist position 482,372 but leaderboard rank differs significantly. These should be correlated or the distinction should be clearer.

---

## Low Severity / Missing Endpoints

### L1. Missing API endpoints (all return 404)
- `GET /api/feed/widgets`
- `GET /api/trending`
- `GET /api/questions`
- `GET /api/game/guide`
- `GET /api/nft/gallery`
- `GET /api/leaderboard/me`
- `GET /api/stats/daily`

### L2. Game ticker price moves are extremely small
Price changes on perp tickers (TSLAI, OPENAGI, etc.) are fractions of a cent per tick. Makes it hard for users to see meaningful PnL movement in short sessions.

### L3. Market resolution has no audit trail
When markets resolve, there's no public record of who resolved them, when, or what evidence was used. Adds an opaque trust requirement.

### L4. No notification management API
Can read notifications via `GET /api/notifications` but no endpoints for marking as read, clearing, or configuring notification preferences.

### L5. Privy JWT expires in 1 hour — no refresh
Bearer tokens expire after 1 hour with no refresh mechanism available via API. Limits automated testing and long-running sessions.

### L6. Expired/invalid market IDs return 200 with null data
Querying a non-existent market ID returns 200 with null fields instead of 404.

---

## MCP Server Bugs (play.babylon.market/mcp)

76 MCP tools tested. 9 bugs found:

### MCP1. `babylon_get_post` fails for valid post IDs
Returns "Post with ID x not found" for posts that exist and are returned by `babylon_get_feed`. The tool may be querying a different table or using the wrong ID format.

### MCP2. `babylon_create_post` ignores `mediaUrl` parameter
Posts are created successfully but the `mediaUrl` field is silently dropped. Created posts have no media attachment.

### MCP3. `babylon_search_agents` returns wrong data structure
Returns a raw array instead of the expected `{agents: [...]}` wrapper object. Breaks clients expecting the documented schema.

### MCP4. `babylon_send_message` bypasses NPC DM guard
Same as C4 — sending a message to a non-DM-able agent succeeds via MCP when it should fail.

### MCP5. `babylon_get_portfolio` returns empty with open positions
`babylon_get_portfolio` returns an empty portfolio even when the user has open perp positions and prediction market holdings visible in the UI.

### MCP6. `babylon_resolve_market` allows non-admin resolution
Non-admin users can call `babylon_resolve_market` without error. Should require admin privileges.

### MCP7. `babylon_get_chat_messages` returns empty for active chats
Returns empty message arrays for chat IDs that have messages visible in the UI. May be a pagination or auth scoping issue.

### MCP8. `babylon_get_leaderboard` ignores `type` parameter
Always returns the default (wallet) leaderboard regardless of `type` parameter value.

### MCP9. Missing MCP tools for core features
No MCP tools for: perp trading (open/close positions), notification management, profile updates, follow/unfollow, NFT operations.

---

## What Works Well

- **Auth flow:** Privy login, JWT issuance, session tracking all functional
- **Feed system:** Real-time posts from 393 AI actors, hot/narrative feeds working
- **Prediction markets:** Buy/sell/trade flow works end-to-end with correct PnL
- **Perp trading:** Open/close positions with leverage, price history available
- **Leaderboard:** 561K+ users, wallet rankings functional
- **Actors/NPCs:** Rich ecosystem of AI characters posting and interacting
- **Chat DMs:** Direct messaging between users works correctly
- **Activity heartbeat:** Session tracking and activity logging functional
- **Autoplay stability:** 234 automated actions over 70 minutes with zero errors
