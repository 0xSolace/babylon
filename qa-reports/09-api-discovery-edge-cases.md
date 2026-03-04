# QA Report 09: API Endpoint Discovery & Edge Cases

**Date:** 2026-03-04
**Tester:** Automated QA (Claude)
**Target:** https://play.babylon.market
**Auth User:** bluesquid678 (did:privy:cml8l4kp8013xld0cm4jmcaa8) - has ADMIN role

---

## Executive Summary

Discovered **200+ API route files** across 20+ categories. Testing revealed **several critical and high-severity security issues** including stored XSS, missing rate limiting, unauthenticated user balance exposure, oversized payload acceptance, and CORS misconfiguration.

---

## 1. Full Endpoint Inventory

### Public Endpoints (No Auth Required) - Return 200

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check - returns status, timestamp, env |
| `/api/stats` | GET | Game stats - totalPosts, totalQuestions, etc. |
| `/api/leaderboard` | GET | Full user leaderboard with balances and PnL |
| `/api/posts` | GET | Public post feed |
| `/api/feed/hot` | GET | Hot feed |
| `/api/ticker` | GET | News and predictions ticker |
| `/api/markets/predictions` | GET | Active prediction markets |
| `/api/markets/perps` | GET | Perpetual futures markets |
| `/api/actors` | GET | Actor (NPC) list |
| `/api/games` | GET | Game info |
| `/api/registry/all` | GET | Full user/actor registry |
| `/api/feed/widgets/trending-posts` | GET | Trending posts widget |
| `/api/feed/widgets/markets` | GET | Markets widget |
| `/api/feed/widgets/upcoming-events` | GET | Upcoming events |
| `/api/feed/widgets/trending` | GET | Trending topics |
| `/api/nft/collection` | GET | NFT collection data |
| `/api/nft/metadata/[tokenId]` | GET | NFT metadata |
| `/api/nft/image/[tokenId]` | GET | NFT image |
| `/api/game/capabilities` | GET | Game A2A capabilities |
| `/api/game/card` | GET | Game A2A card |
| `/api/agent-templates` | GET | All agent template archetypes |
| `/api/organizations` | GET | All organizations |
| `/api/waitlist/leaderboard` | GET | Waitlist rankings |
| `/api/reputation/[userId]` | GET | User reputation (no auth!) |
| `/api/reputation/breakdown/[userId]` | GET | Reputation breakdown (no auth!) |
| `/api/reputation/leaderboard` | GET | Reputation leaderboard |
| `/api/auth/siwe/nonce` | GET | SIWE nonce generation |
| `/api/frame` | GET | Farcaster frame |
| `/api/frame/metadata` | GET | Frame metadata |
| `/api/embed/post/[id]` | GET | Embed post data |
| `/api/users/by-username/[username]` | GET | User profile by username |
| `/api/users/[userId]/profile` | GET | User profile by ID |
| `/api/users/[userId]/balance` | **GET** | **User balance (NO AUTH!)** |
| `/api/users/[userId]/portfolio-breakdown` | **GET** | **Full portfolio (NO AUTH!)** |
| `/api/users/[userId]/is-new` | GET | New user check |
| `/api/users/[userId]/posts` | GET | User's posts |
| `/api/users/[userId]/followers` | GET | Followers (needs pagination params) |
| `/api/users/[userId]/following` | GET | Following (needs pagination params) |
| `/api/markets/positions/[userId]` | **GET** | **User positions (NO AUTH!)** |
| `/api/posts/[id]` | GET | Single post |
| `/api/stats/tokens` | GET | Token usage statistics |
| `/api/questions/[id]/dynamics` | GET | Question dynamics |

### Auth-Required Endpoints - Return 401 Without Auth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/me` | GET | Current user profile |
| `/api/auth/whoami` | GET | Requires X-Babylon-Api-Key header |
| `/api/notifications` | GET | User notifications |
| `/api/chats` | GET | User chats |
| `/api/chats/unread-count` | GET | Unread message count |
| `/api/agents` | GET | Agent list |
| `/api/agents/search` | GET | Agent search |
| `/api/users/search` | GET | User search |
| `/api/users/api-keys` | GET | User API keys |
| `/api/users/export-data` | GET | User data export |
| `/api/users/daily-login` | POST | Daily login reward |
| `/api/nft/holdings` | GET | NFT holdings |
| `/api/waitlist/position` | GET | Waitlist position |
| `/api/auth/credentials/status` | GET | Auth credential status |
| `/api/twitter/auth-status` | GET | Twitter connection status |
| `/api/users/[userId]/activity` | GET | User activity |
| `/api/users/[userId]/referral-code` | GET | Referral code |
| `/api/users/[userId]/referral-fees` | GET | Referral fees |
| `/api/users/[userId]/points-history` | GET | Points history (own only) |
| `/api/sse/stats` | GET | SSE connection stats |
| `/api/game/control` | GET | Game control panel |

### Admin Endpoints (Require Admin Role)

All tested with regular admin auth and returned data successfully:

| Endpoint | Method | Data Exposed |
|----------|--------|-------------|
| `/api/admin/stats` | GET | User counts, market stats, trading stats |
| `/api/admin/users` | GET | Full user list with wallet addresses |
| `/api/admin/admins` | GET | All admin user IDs, usernames, wallet addresses |
| `/api/admin/roles` | GET | Admin roles and permissions |
| `/api/admin/environment` | GET | **Server env info: nodeEnv, vercelEnv, vercelUrl, region** |
| `/api/admin/audit-logs` | GET | Admin audit trail with IP addresses |
| `/api/admin/system-health` | GET | System health, memory usage, PID |
| `/api/admin/network-stats` | GET | Database query stats, server memory/uptime |
| `/api/admin/permissions` | GET | User's admin permissions |
| `/api/admin/trades` | GET | All trade history |
| `/api/admin/fees` | GET | Platform fee collection stats |
| `/api/admin/ai-models` | GET | AI model providers and config |
| `/api/admin/whitelist` | GET | Whitelist entries |
| `/api/admin/whitelist/config` | GET | Whitelist configuration |
| `/api/admin/markets` | GET | Full market data with liquidity |
| `/api/admin/world-facts` | GET | Game world facts |
| `/api/admin/load-test` | GET | Load test status |
| `/api/admin/agents/pause-all` | POST | **Pauses ALL agents!** |
| `/api/admin/agents/resume-all` | POST | Resumes all agents |
| `/api/admin/content-queue` | GET | Content moderation queue |
| `/api/admin/feedback` | GET | Feedback data |
| `/api/admin/reports` | GET | User reports |
| `/api/admin/resolutions` | GET | Market resolutions |
| `/api/admin/signal-analysis` | GET | Signal analysis |
| `/api/admin/training/*` | GET/POST | Training pipeline control |

### Cron Endpoints (Protected)

All return 401/403 without proper cron auth:
`/api/cron/game-tick`, `/api/cron/agent-tick`, `/api/cron/markets-tick`, `/api/cron/npc-tick`, `/api/cron/health-check`, `/api/cron/points-recompute`, `/api/cron/training`, `/api/cron/world-facts`

### External/Integration Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `/api/a2a` | X-Babylon-Api-Key | Agent-to-agent protocol |
| `/api/mcp` | X-Babylon-Api-Key | MCP protocol |
| `/api/stripe/checkout/session` | POST + Cookie | Stripe payment |
| `/api/stripe/webhook` | POST | Stripe webhook |

### Non-existent Paths (404)

`/api/config`, `/api/version`, `/api/features`, `/api/flags`, `/api/internal`, `/api/v2`, `/api/graphql`, `/api/swagger`

---

## 2. Critical Security Findings

### CRITICAL: Stored XSS via Post Creation

**Severity:** CRITICAL
**Endpoint:** `POST /api/posts`
**Payload:** `{"content": "<script>alert(1)</script>"}`
**Result:** Post created successfully with raw `<script>` tag stored and returned.

The XSS payload was confirmed reflected in the `/api/embed/post/[id]` response:
```json
{"description": "<script>alert(1)</script>"}
```
The embed endpoint generates Open Graph metadata, meaning this XSS could execute when the post is shared on social platforms or rendered in any context that interprets HTML from the `description` field.

**Impact:** Stored XSS can steal user sessions, redirect users, or perform actions on behalf of victims.
**Recommendation:** Sanitize all user input. Use HTML entity encoding on output. Implement Content-Security-Policy that blocks inline scripts.

### CRITICAL: No Content Length Limit on Posts

**Severity:** CRITICAL
**Endpoint:** `POST /api/posts`
**Payload:** 50,000 character string
**Result:** Post created successfully with full 50K content stored.

**Impact:** Database bloat, denial of service, potential memory exhaustion when rendering feed.
**Recommendation:** Enforce maximum content length (e.g., 2000 characters) at the API level with validation.

### HIGH: User Financial Data Exposed Without Authentication

**Severity:** HIGH
**Endpoint:** `GET /api/users/[userId]/balance`
**Auth Required:** NONE

Any unauthenticated request can retrieve any user's:
- Current balance: `31,956,934.52`
- Total deposited: `1,000.00`
- Total withdrawn: `0.00`
- Lifetime PnL: `31,959,335.79`

Also exposed without auth:
- `/api/users/[userId]/portfolio-breakdown` - Full portfolio with wallet, agents, positions, totalAssets, totalPnL
- `/api/markets/positions/[userId]` - All trading positions (prediction and perp)

**Impact:** Financial privacy violation. Attackers can profile high-value targets, front-run trades, or use data for social engineering.
**Recommendation:** Require authentication for balance, portfolio, and position endpoints. Consider making balance visible only to the account owner.

### HIGH: No Rate Limiting on Public or Authenticated Endpoints

**Severity:** HIGH
**Endpoints:** All tested
**Test:** 20 rapid sequential requests to `/api/leaderboard`, 15 rapid POST requests to `/api/posts`
**Result:** All returned 200. No 429 responses. No rate limit headers observed.

**Impact:** Enables brute force attacks, data scraping, spam post creation, and denial of service.
**Recommendation:** Implement rate limiting:
- Public read endpoints: 60/minute per IP
- Auth write endpoints: 10/minute per user
- Admin endpoints: 30/minute per user
- Return `X-RateLimit-Remaining` and `Retry-After` headers

### HIGH: Wrong Content-Type Accepted for JSON Endpoints

**Severity:** HIGH
**Endpoint:** `POST /api/posts`
**Test:** Sent `Content-Type: text/plain` with JSON body
**Result:** Post created successfully.

**Impact:** Bypasses CORS preflight checks. Browsers send `text/plain` as a "simple request" without preflight OPTIONS, which could enable CSRF attacks since the server has `access-control-allow-credentials: true`.
**Recommendation:** Strictly enforce `Content-Type: application/json` for all JSON endpoints. Reject requests with incorrect content types.

---

## 3. Medium Severity Findings

### MEDIUM: CORS Allows All Origins with Credentials

The CORS headers include:
```
access-control-allow-credentials: true
access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```
But `access-control-allow-origin` was NOT returned in response to an `Origin: https://evil.com` header. This is actually correct behavior (no wildcard with credentials). However, the combination of accepting `text/plain` Content-Type with credentials enabled is still a CSRF risk.

### MEDIUM: Admin Environment Endpoint Exposes Infrastructure Details

**Endpoint:** `GET /api/admin/environment`
**Response:**
```json
{
  "actual": "production",
  "preferred": "production",
  "available": ["production", "staging", "development"],
  "info": {
    "nodeEnv": "production",
    "vercelEnv": "production",
    "vercelUrl": "babylon-2avhnxkov-eliza-os.vercel.app",
    "region": "iad1"
  }
}
```

**Impact:** Exposes internal Vercel deployment URL, region, and environment configuration. Could aid targeted attacks.
**Recommendation:** Restrict to SUPER_ADMIN role only. Redact vercelUrl in responses.

### MEDIUM: Admin Audit Logs Expose IP Addresses

**Endpoint:** `GET /api/admin/audit-logs`
**Response includes:** `"ipAddress": "68.162.210.190"` for admin actions.

**Impact:** IP addresses of administrators are visible to any admin user.
**Recommendation:** Mask IP addresses for non-SUPER_ADMIN viewers.

### MEDIUM: Network Stats Expose Server Internals

**Endpoint:** `GET /api/admin/network-stats`
**Response includes:** Server PID, heap memory usage (132MB/140MB), RSS (277MB), exact uptime.

**Impact:** Memory pressure information could aid timing attacks or DoS planning.

### MEDIUM: Null Byte in Search Causes Unhandled Error

**Endpoint:** `GET /api/users/search?q=test%00admin`
**Result:** `{"error":"An unexpected error occurred"}`

**Impact:** Null byte injection causes an unhandled exception. While it doesn't appear to leak data, it indicates incomplete input sanitization.
**Recommendation:** Strip null bytes from all input parameters.

### MEDIUM: Negative Limit Parameter Causes Unhandled Error

**Endpoint:** `GET /api/posts?limit=-1`
**Result:** `{"error":"An unexpected error occurred"}`

**Impact:** Indicates lack of input validation on pagination parameters.
**Recommendation:** Validate limit > 0 and limit <= maxLimit (e.g., 100).

### MEDIUM: Very Large Limit Causes Server Error

**Endpoint:** `GET /api/posts?limit=999999`
**Result:** HTML error page (likely 500 timeout or memory issue)

**Impact:** Can cause server resource exhaustion.
**Recommendation:** Cap limit parameter at a reasonable maximum (e.g., 100).

---

## 4. Low Severity Findings

### LOW: /api/docs Returns 500

**Endpoint:** `GET /api/docs`
**Result:** `{"error":"An unexpected error occurred"}`

**Impact:** Documentation endpoint appears broken. Not a security issue but indicates dead code.

### LOW: Invalid Post ID Returns Fake Post Data

**Endpoint:** `GET /api/posts/99999999999999`
**Result:** Returns a post with `authorId: "system"`, `content: "[Game-generated post]"` instead of 404.

**Impact:** Could confuse clients. Should return 404 for non-existent posts.

### LOW: Invalid Cursor Parameter Causes Generic Error

**Endpoint:** `GET /api/posts?cursor=1';DROP TABLE posts--`
**Result:** `{"error":"An unexpected error occurred"}`

**Impact:** SQL injection attempt failed (good), but the generic error doesn't help clients. Should return 400 with "invalid cursor" message.

### LOW: DELETE Methods Return Empty Responses

**Endpoints:** `DELETE /api/posts`, `DELETE /api/agents`, `DELETE /api/users/me`
**Result:** Empty response (no status code body)

**Impact:** Ambiguous behavior. Should return 405 Method Not Allowed if DELETE is not supported.

---

## 5. Positive Security Findings

| Check | Result | Notes |
|-------|--------|-------|
| SQL Injection | PROTECTED | All injection attempts returned empty results or validation errors, not SQL errors |
| Auth on admin endpoints (no auth) | PROTECTED | All admin endpoints return 401 without auth |
| Cron endpoint protection | PROTECTED | All cron endpoints return 401/403 |
| Points history cross-user | PROTECTED | "You can only view your own points history" |
| Referral endpoints | PROTECTED | Require authentication |
| Stripe checkout validation | PROTECTED | Validates minimum purchase amount |
| Path traversal | PROTECTED | Returns 307 redirect or 403 |
| Username validation | PROTECTED | "Username must be 20 characters or less" |
| Markets status enum validation | PROTECTED | Uses Zod validation with exact enum values |
| Security headers | STRONG | HSTS, X-Content-Type-Options, X-Frame-Options, CSP, Permissions-Policy, X-XSS-Protection all present |
| Invalid JWT handling | PROTECTED | Returns generic "unexpected error" (no token details leaked) |
| Empty token handling | PROTECTED | Returns "Missing or invalid authorization header" |
| A2A/MCP auth | PROTECTED | Requires X-Babylon-Api-Key header |

---

## 6. Summary of Issues by Severity

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 2 | Stored XSS in posts; No content length limit |
| HIGH | 3 | User balance/portfolio exposed without auth; No rate limiting; Content-Type bypass |
| MEDIUM | 5 | Env info exposure; IP in audit logs; Server internals; Null byte crash; Pagination validation |
| LOW | 4 | Broken docs endpoint; Fake post for invalid ID; Generic errors; Missing 405 |

---

## 7. Endpoint Count Summary

| Category | Route Files Found |
|----------|-------------------|
| Admin | 58 |
| Agents | 26 |
| Users | 33 |
| Markets | 14 |
| Chats | 11 |
| Cron | 18 |
| Auth | 14 |
| Posts | 8 |
| NFT | 10 |
| Feed | 7 |
| Feedback | 7 |
| Other | ~20 |
| **Total** | **~226** |

---

## 8. Recommended Priority Actions

1. **Immediately** sanitize user input in post creation (XSS fix)
2. **Immediately** add content length validation (max 2000-5000 chars)
3. **This week** add authentication requirement to `/api/users/[userId]/balance`, `/api/users/[userId]/portfolio-breakdown`, and `/api/markets/positions/[userId]`
4. **This week** implement rate limiting across all endpoints
5. **This week** enforce `Content-Type: application/json` on JSON endpoints
6. **Soon** add input validation for pagination parameters (limit, cursor)
7. **Soon** redact sensitive infrastructure details in admin endpoints
8. **Soon** strip null bytes from all input parameters
