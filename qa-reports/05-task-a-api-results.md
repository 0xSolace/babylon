# API Endpoint Test Results

**Date:** 2026-03-04
**Base URL:** https://play.babylon.market
**Auth:** Bearer JWT (Privy, user did:privy:cml8l4kp8013xld0cm4jmcaa8)

## Summary

- **Total endpoints tested:** 32 (28 GET + 4 OPTIONS)
- **200 OK:** 4
- **204 No Content (CORS preflight):** 4
- **404 Not Found:** 22
- **500 Internal Server Error:** 1
- **404 returning HTML (no API route):** 21
- **404 returning JSON (API route exists, resource missing):** 2

## Results Table

| Endpoint | Method | Status | Time | Response Summary |
|----------|--------|--------|------|------------------|
| /api/nft/access | GET | 200 | 0.18s | `{"success":true,"data":{"hasAccess":true,"reason":"whitelist"}}` |
| /api/nft/gallery | GET | 404 | 0.20s | JSON: `{"error":"Invalid token ID not found"}` - route exists but needs tokenId param |
| /api/nft/collection | GET | 200 | 0.58s | JSON array of NFTs with tokenId, name, owner, thumbnailUrl. Working correctly. |
| /api/nft/mint | GET | 404 | 0.20s | JSON: `{"error":"Invalid token ID not found"}` - route exists but needs tokenId param |
| /api/waitlist/position | GET | 200 | 1.08s | JSON: position=482372, points=1059, inviteCode=bluesquid678, referralCount=0. Working. |
| /api/waitlist/status | GET | 404 | 0.22s | HTML page (no API route defined) |
| /api/waitlist/referrals | GET | 404 | 0.23s | HTML page (no API route defined) |
| /api/rewards | GET | 404 | 0.23s | HTML page (no API route defined) |
| /api/rewards/history | GET | 404 | 0.34s | HTML page (no API route defined) |
| /api/rewards/claim | GET | 404 | 0.26s | HTML page (no API route defined) |
| /api/referrals | GET | 404 | 0.27s | HTML page (no API route defined) |
| /api/referrals/stats | GET | 404 | 0.22s | HTML page (no API route defined) |
| /api/quests | GET | 404 | 0.24s | HTML page (no API route defined) |
| /api/achievements | GET | 404 | 0.21s | HTML page (no API route defined) |
| /api/daily-rewards | GET | 404 | 0.20s | HTML page (no API route defined) |
| /api/organizations | GET | 200 | 0.22s | JSON: `{"success":true,"organizations":[...]}` with org objects (id, name, type, description). Working. |
| /api/search?q=test | GET | 404 | 0.22s | HTML page (no API route defined) |
| /api/portfolio | GET | 404 | 0.22s | HTML page (no API route defined) |
| /api/portfolio/summary | GET | 404 | 0.21s | HTML page (no API route defined) |
| /api/transactions | GET | 404 | 0.20s | HTML page (no API route defined) |
| /api/events | GET | 404 | 0.21s | HTML page (no API route defined) |
| /api/explore | GET | 404 | 0.22s | HTML page (no API route defined) |
| /api/discover | GET | 404 | 0.21s | HTML page (no API route defined) |
| /api/config | GET | 404 | 0.22s | HTML page (no API route defined) |
| /api/version | GET | 404 | 0.21s | HTML page (no API route defined) |
| /api/docs | GET | 500 | 0.21s | JSON: `{"error":"An unexpected error occurred"}` - route exists but crashes |
| /api/swagger | GET | 404 | 0.23s | HTML page (no API route defined) |
| /api/admin | GET | 404 | 0.33s | HTML page (no API route defined) |
| /api/nft/access | OPTIONS | 204 | 0.06s | CORS OK: allow-origin=play.babylon.market, allow-methods=GET,POST,PUT,PATCH,DELETE,OPTIONS, credentials=true |
| /api/rewards | OPTIONS | 204 | 0.08s | CORS OK: same headers as above |
| /api/waitlist/status | OPTIONS | 204 | 0.06s | CORS OK: same headers as above |
| /api/markets | OPTIONS | 204 | 0.07s | CORS OK: same headers as above |

## CORS Configuration

All OPTIONS preflight requests return proper CORS headers:
- `access-control-allow-origin: https://play.babylon.market`
- `access-control-allow-credentials: true`
- `access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
- `access-control-allow-headers: Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, x-admin-token, x-dev-admin-token`
- `access-control-max-age: 86400`

**Note:** CORS middleware runs globally (even on non-existent routes), which is correct behavior.

## Key Findings

### Working Endpoints (4)
1. **GET /api/nft/access** - Returns access status with whitelist reason
2. **GET /api/nft/collection** - Returns full NFT collection data (slowest at 0.58s)
3. **GET /api/waitlist/position** - Returns detailed waitlist/leaderboard data (slowest overall at 1.08s)
4. **GET /api/organizations** - Returns list of organizations with metadata

### Partially Working (2)
5. **GET /api/nft/gallery** - Route exists but returns 404 JSON error (expects tokenId parameter)
6. **GET /api/nft/mint** - Route exists but returns 404 JSON error (expects tokenId parameter)

### Server Error (1)
7. **GET /api/docs** - Returns 500 with generic error message. Route exists but throws unhandled exception.

### Non-Existent Routes (21)
All remaining endpoints return 404 with HTML (Next.js default 404 page), meaning no API route handler is defined for them. This includes all rewards, referrals, quests, achievements, daily-rewards, search, portfolio, transactions, events, explore, discover, config, version, swagger, and admin endpoints.

## Issues / Bugs

| Severity | Issue |
|----------|-------|
| HIGH | `/api/docs` returns 500 - unhandled server error |
| MEDIUM | `/api/nft/gallery` and `/api/nft/mint` return unhelpful error "Invalid token ID not found" when called without params - should return usage info or 400 |
| MEDIUM | `/api/waitlist/position` response time of 1.08s is notably slow compared to other endpoints (~0.2s) |
| INFO | 21 of 28 GET endpoints do not exist - many tested endpoints are speculative/not yet implemented |
| INFO | CORS allows `x-admin-token` and `x-dev-admin-token` headers - verify these are intentional in production |
