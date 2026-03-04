# QA Report 08: NFT, Rewards, and Gamification Systems

**Date:** 2026-03-04
**Tester:** Automated QA (Claude)
**Base URL:** https://play.babylon.market
**Auth:** Cookie-based privy-token (user: bluesquid678, isAdmin: true)

---

## Executive Summary

Tested 50+ endpoints across NFT, waitlist, leaderboard, rewards, gamification, notifications, and activity tracking systems. Found **3 bugs**, **2 security observations**, and **3 UX/data concerns**. The NFT system and waitlist are functional but many expected gamification endpoints (quests, achievements, rewards/claim) do not exist. The `leaderboardType` query parameter is ignored by the main leaderboard API.

---

## 1. NFT System

### 1.1 GET /api/nft/access
- **Status:** 200 OK
- **Auth Required:** Yes (401 without)
- **Response:**
```json
{"success": true, "data": {"hasAccess": true, "reason": "whitelist"}}
```
- **Notes:** Working correctly. Returns access status with reason.

### 1.2 GET /api/nft/{tokenId} - Individual NFT Data
- **Status:** 200 OK
- **Auth Required:** No (works without auth)
- **Response structure:**
```json
{
  "success": true,
  "data": {
    "tokenId": 1,
    "name": "WireMonkey",
    "description": "...",
    "imageUrl": "/api/nft/image/1",
    "thumbnailUrl": "/api/nft/image/1",
    "imageCid": null,
    "imageResolution": "4096x4096",
    "metadataUri": "ipfs://...",
    "story": {"title": "...", "content": "..."},
    "attributes": [...],
    "contractAddress": "0x509929f54c069Aa47f52Beb8264876b4e13FCda9",
    "chainId": 1,
    "currentOwner": {
      "walletAddress": "...",
      "user": {"id": "...", "username": "...", "displayName": "...", "profileImageUrl": "..."},
      "acquiredAt": "...",
      "txHash": null
    },
    "originalClaim": {
      "claimedAt": "...",
      "claimerAddress": "...",
      "claimerUserId": "...",
      "snapshotRank": 54,
      "snapshotPoints": 18600,
      "txHash": "0x..."
    }
  }
}
```
- **Edge case tests:**

| Input | Status | Response |
|-------|--------|----------|
| `/api/nft/1` | 200 | Valid NFT data |
| `/api/nft/34755` | 200 | Valid NFT data (high token) |
| `/api/nft/99999` | 404 | `{"error":"NFT with token ID 99999 not found not found"}` |
| `/api/nft/0` | 404 | `{"error":"NFT with token ID 0 not found not found"}` |
| `/api/nft/-1` | 404 | `{"error":"Invalid token ID not found"}` |
| `/api/nft/abc` | 404 | `{"error":"Invalid token ID not found"}` |

#### BUG-01: Doubled "not found" in NFT Error Messages
- **Severity:** Low (cosmetic)
- **Issue:** Error messages contain redundant "not found" text:
  - `"NFT with token ID 99999 not found not found"` -- doubled
  - `"Invalid token ID not found"` -- "not found" appended to "Invalid token ID"
- **Expected:** `"NFT with token ID 99999 not found"` and `"Invalid token ID"`

### 1.3 GET /api/nft/metadata/{tokenId} - ERC-721 Metadata
- **Status:** 200 OK
- **Auth Required:** No
- **Response:** Standard ERC-721 metadata format with `name`, `description`, `image`, `external_url`, `attributes`, `properties.story`
- **Notes:** Returns relative image URL `/api/nft/image/1` instead of absolute URL. This is fine for on-chain resolvers that prepend the base URI but could cause issues with external NFT marketplaces.

### 1.4 GET /api/nft/image/{tokenId}
- **Status:** 200 OK
- **Content-Type:** image/png
- **Cache:** `public, max-age=31536000, immutable` (1 year, good)
- **Notes:** Correctly serves PNG images with aggressive caching.

### 1.5 Non-Existent NFT Endpoints
All of these return **404** with `{"error":"Invalid token ID not found"}`:
- `/api/nft/gallery`, `/api/nft/collections`, `/api/nft/list`
- `/api/nft/mint`, `/api/nft/status`, `/api/nft/claim`
- `/api/nft/search`, `/api/nft/recent`, `/api/nft/transfers`
- `/api/nft/leaderboard`, `/api/nft/traits`, `/api/nft/stats`

**Note:** The NFT API uses a catch-all route `/api/nft/[tokenId]`. Any unrecognized path segment gets treated as an invalid tokenId. This means there is no proper 404 for non-existent sub-routes -- they all look like NFT lookup failures.

---

## 2. Waitlist System

### 2.1 GET /api/waitlist/position
- **Status:** 200 OK
- **Auth Required:** Yes (401 without)
- **Response:**
```json
{
  "position": 482372,
  "leaderboardRank": 482372,
  "waitlistPosition": 472774,
  "totalAhead": 482371,
  "totalCount": 486936,
  "percentile": 99,
  "inviteCode": "bluesquid678",
  "points": 1050,
  "basePoints": 100,
  "pointsBreakdown": {
    "total": 1050,
    "invite": 0,
    "earned": 0,
    "bonus": 950,
    "base": 100
  },
  "referralCount": 0,
  "weeklyReferralCount": 0,
  "weeklyLimit": 10,
  "invitedUsers": [],
  "qualifiedUsers": [],
  "invitedCount": 0,
  "qualifiedCount": 0,
  "totalReferralPoints": 0
}
```

#### Data Consistency Checks:
- `position (482372) == totalAhead + 1 (482372)`: **PASS**
- `points (1050) == pointsBreakdown.total (1050)`: **PASS**
- `breakdown sum (0+0+950+100=1050) == total (1050)`: **PASS**
- `position - waitlistPosition = 9598` -- indicates ~9,598 whitelisted users who bypass the waitlist queue

#### BUG-02: Ambiguous Percentile Meaning
- **Severity:** Medium (UX confusion)
- **Issue:** `percentile: 99` for user ranked 482,372 out of 486,936. This means the user is at the 99th percentile FROM THE BOTTOM (i.e., 99% of users are ahead of them). However, in common usage "99th percentile" implies being in the top 1%.
- **Impact:** Users may misinterpret this as being in the top 1% when they are actually in the bottom 1%.
- **Recommendation:** Either invert the percentile (return 1 for bottom, 99 for top) or rename the field to `percentileFromBottom` or `percentBelowYou`.

### 2.2 GET /api/waitlist/leaderboard
- **Status:** 200 OK
- **Auth Required:** Yes
- **Response:**
```json
{
  "leaderboard": [{
    "id": "...",
    "userId": "...",
    "username": "blue_barnacle_king",
    "displayName": "Blue Barnacle King",
    "points": 29100,
    "invitePoints": 29100,
    "reputationPoints": 60100,
    "referralCount": 304,
    "rank": 1
  }, ...],
  "totalShown": 10,
  "page": 1,
  "totalPages": 10,
  "hasMore": true,
  "pointsType": "invite"
}
```
- **Pagination:** Works correctly (page=2 shows ranks 11+)
- **Note:** `pointsType` parameter in query is ignored -- always returns `invite` type regardless of `?pointsType=reputation` or `?pointsType=referral`

### 2.3 POST /api/waitlist/join
- **Status:** Returns HTML (not a valid API endpoint)
- **Notes:** This endpoint does not exist as an API route. Waitlist joining is likely handled through the auth/onboarding flow automatically.

### 2.4 Non-Existent Waitlist Endpoints
All return **404 (HTML page)**:
- `/api/waitlist/stats`, `/api/waitlist/info`
- `/api/waitlist/referral`, `/api/waitlist/bonus`
- `/api/waitlist/email-bonus`, `/api/waitlist/social-bonus`

---

## 3. Leaderboard System

### 3.1 GET /api/leaderboard
- **Status:** 200 OK
- **Auth Required:** No (but `currentUser` is null without auth)
- **Response structure:**
```json
{
  "leaderboard": [{
    "id": "...",
    "username": "roach_empire_420",
    "displayName": "Roach Emperor",
    "profileImageUrl": "...",
    "totalPoints": 35155667.52,
    "balance": 31956934.52,
    "lifetimePnL": 31959335.79,
    "createdAt": "...",
    "isAgent": false,
    "managedBy": null,
    "onChainRegistered": true,
    "nftTokenId": 34755,
    "rank": 1
  }, ...],
  "pagination": {"page": 1, "pageSize": 100, "totalCount": 562527, "totalPages": 5626},
  "leaderboardType": "wallet",
  "currentUser": null
}
```

#### BUG-03: leaderboardType Query Parameter Ignored
- **Severity:** Medium (feature not working)
- **Issue:** The `leaderboardType` query parameter has no effect. All of these return identical `wallet` type results:
  - `?leaderboardType=reputation` -> returns `wallet`
  - `?leaderboardType=pnl` -> returns `wallet`
  - `?leaderboardType=wallet` -> returns `wallet`
- **Note:** `?period=weekly`, `?period=daily`, `?period=allTime` all work but also return `leaderboardType: "wallet"` with no apparent difference in data.

#### Pagination Edge Cases:
| Input | Behavior |
|-------|----------|
| `?page=2&pageSize=5` | Works correctly (ranks 6-10) |
| `?page=-1` | Returns empty leaderboard, no pagination object |
| `?pageSize=0` | Clamps to pageSize=1, returns 1 entry |
| `?pageSize=100000` | Clamps to pageSize=100, returns 100 entries |

- **currentUser:** Always `null` even with auth (test user not on main leaderboard due to low balance)

---

## 4. Rewards / Gamification Endpoints

### ALL of these return 404 (HTML page, not API routes):
- `/api/rewards`, `/api/rewards/daily`, `/api/rewards/claim`, `/api/rewards/history`, `/api/rewards/status`
- `/api/quests`, `/api/missions`, `/api/challenges`
- `/api/achievements`, `/api/badges`
- `/api/game/guide`, `/api/game/status`, `/api/game/config`
- `/api/game-guide`, `/api/game-guide/complete`
- `/api/points`, `/api/points/history`
- `/api/trending`, `/api/discover`
- `/api/questions`, `/api/questions?status=active`

**Conclusion:** There are no dedicated rewards, quests, achievements, or gamification API endpoints. Gamification is embedded in other systems:
- **Points:** Managed via `waitlist/position` (pointsBreakdown) and user profile (reputationPoints)
- **Bonuses:** Tracked via user profile flags (`pointsAwardedForProfile`, `pointsAwardedForEmail`, `pointsAwardedForTwitterFollow`, etc.)
- **Game guide:** Tracked via `user.gameGuideCompletedAt`
- **Referral system:** Built into waitlist (`inviteCode`, `referralCount`, `invitedUsers`)

---

## 5. Activity Tracking

### 5.1 POST /api/activity/heartbeat
- **Status:** 200 OK
- **Auth Required:** No (works without auth)
- **Request:** Requires `sessionId` field
- **Responses:**
  - With auth + sessionId: `{"success":true,"sessionId":"test-session-123"}`
  - Without auth + sessionId: `{"success":true,"reason":"unauthenticated"}`
  - Without sessionId: `{"success":false,"error":"Invalid sessionId"}`
- **GET method:** Returns 405 (correct)

#### SECURITY-01: Heartbeat Accepts Unauthenticated Requests
- **Severity:** Low
- **Issue:** The heartbeat endpoint accepts and succeeds for unauthenticated requests. While it returns `reason: "unauthenticated"`, it still returns `success: true`.
- **Impact:** Could be used for basic availability probing or to pollute analytics if the backend tracks unauthenticated heartbeats.

---

## 6. Notifications

### 6.1 GET /api/notifications
- **Status:** 200 OK
- **Auth Required:** Yes
- **Response:**
```json
{
  "notifications": [{
    "id": "287577292450824192",
    "type": "system",
    "actorId": "",
    "actor": null,
    "postId": null,
    "commentId": null,
    "chatId": null,
    "groupId": null,
    "inviteId": null,
    "message": "Welcome to Babylon! Edit your profile details to earn free points and unlock rewards.",
    "read": true,
    "createdAt": "2026-03-04T13:29:29.450Z"
  }],
  "unreadCount": 0
}
```
- **Notes:** Working correctly. 2 notifications for test user (both system type).

---

## 7. Stats Endpoints

### 7.1 GET /api/stats
- **Status:** 200 OK
- **Auth Required:** No (works without auth)
- **Response:**
```json
{
  "success": true,
  "stats": {
    "totalPosts": 203631,
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

#### DATA-01: Contradictory Engine Status
- **Severity:** Low (informational)
- **Issue:** `stats.isRunning: true` but `engineStatus.isRunning: false` and `engineStatus.initialized: false`. Also `engineStatus.currentDate` is "2025-11-30" which is in the past relative to `lastTickAt` of "2026-03-04".
- **Impact:** Could confuse developers or monitoring systems.

### 7.2 GET /api/admin/stats
- **Status:** 200 OK (with admin auth), 401 (without auth)
- **Auth Required:** Yes (admin only)
- **Security:** Properly gated behind admin authentication.
- **Exposes:** Detailed user counts, market stats, trading volumes, financial totals, top users by balance and reputation, recent signups with wallet addresses and PIIs.

#### SECURITY-02: Admin Stats Exposes Sensitive Financial Aggregates
- **Severity:** Informational
- **Issue:** Admin stats endpoint reveals total financial data including:
  - `totalVirtualBalance: "777682530.76"`
  - `totalDeposited: "589799356"`
  - `totalWithdrawn: "15864"`
  - `totalLifetimePnL: "-126860745.58"` (net negative across all users)
- **Note:** This is expected for admin endpoints but worth documenting. The endpoint is properly auth-gated.

---

## 8. User Profile Gamification Fields

From `/api/users/me`, gamification state is tracked in the user object:

| Field | Value | Purpose |
|-------|-------|---------|
| `reputationPoints` | 1050 | Overall reputation score |
| `virtualBalance` | 1781.31 | In-game currency |
| `nftTokenId` | null | User's NFT (none claimed) |
| `agent0TokenId` | null | Agent NFT |
| `onChainRegistered` | false | On-chain status |
| `pointsAwardedForProfile` | true | Profile completion bonus (done) |
| `pointsAwardedForEmail` | true | Email verification bonus (done) |
| `pointsAwardedForFarcasterFollow` | false | Farcaster follow bonus (not done) |
| `pointsAwardedForTwitterFollow` | false | Twitter follow bonus (not done) |
| `pointsAwardedForDiscordJoin` | false | Discord join bonus (not done) |
| `gameGuideCompletedAt` | 2026-03-02T11:47:24.757Z | Game guide completion |
| `referralCode` | "bluesquid678" | User's referral code (same as username) |
| `referredBy` | null | Who referred this user |

---

## 9. Security Summary

| Test | Result |
|------|--------|
| NFT SQL injection (`1 OR 1=1`) | Safe -- parseInt parses as "1" |
| NFT XSS (`<script>alert(1)</script>`) | Safe -- returns HTML 404 page |
| NFT path traversal (`../../../etc/passwd`) | Safe -- redirects |
| Admin stats without auth | Blocked (401) |
| NFT data without auth | Accessible (by design for public NFT data) |
| Leaderboard without auth | Accessible (currentUser=null) |
| Metadata without auth | Accessible (by design for ERC-721 compatibility) |
| Waitlist without auth | Blocked (401) |

---

## Bug Summary

| ID | Severity | Component | Description |
|----|----------|-----------|-------------|
| BUG-01 | Low | NFT API | Doubled "not found" in error messages (`"not found not found"`) |
| BUG-02 | Medium | Waitlist | Percentile=99 is ambiguous/misleading for bottom-ranked users |
| BUG-03 | Medium | Leaderboard | `leaderboardType` query parameter is completely ignored |
| SECURITY-01 | Low | Activity | Heartbeat accepts unauthenticated requests with `success:true` |
| SECURITY-02 | Info | Admin | Admin stats exposes detailed financial aggregates (expected but documented) |
| DATA-01 | Low | Stats | Contradictory `isRunning` between stats and engineStatus objects |

---

## Observations

1. **No dedicated rewards/gamification API exists.** Points, bonuses, and achievements are embedded in the user profile and waitlist systems rather than exposed as separate endpoints.
2. **NFT catch-all route** causes all unknown `/api/nft/*` paths to return "Invalid token ID not found" rather than proper 404s for non-existent sub-routes.
3. **Waitlist leaderboard** `pointsType` parameter is ignored -- always returns `invite` type.
4. **Leaderboard pagination** handles edge cases well: clamps pageSize to 1-100 range, handles negative pages gracefully (empty result).
5. **NFT image caching** is excellent: `max-age=31536000, immutable` with proper CDN headers.
6. **Referral system** is functional: `inviteCode` matches username, `weeklyLimit: 10` enforces rate limiting, `qualifiedUsers` vs `invitedUsers` distinction exists.
