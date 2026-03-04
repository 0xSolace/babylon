# QA Report 06: Social Features & Profiles

**Date:** 2026-03-04
**Tester:** QA Automation (API-level)
**Base URL:** https://play.babylon.market
**Auth:** Cookie-based privy-token

---

## 1. User Profile (`GET /api/users/me`)

**Status:** 200 OK -- PASS

**Response structure:**
```json
{
  "authenticated": true,
  "needsOnboarding": false,
  "needsOnchain": false,
  "user": {
    "id": "did:privy:...",
    "privyId": "did:privy:...",
    "privyWalletId": "jt98qw...",
    "offlineWalletReady": true,
    "offlineWalletReadyAt": "ISO timestamp",
    "username": "bluesquid678",
    "displayName": "bluesquid678",
    "bio": "",
    "profileImageUrl": "https://...",
    "coverImageUrl": "https://...",
    "walletAddress": "0x...",
    "email": "ben.b@elizalabs.ai",
    "emailVerified": true,
    "emailNotificationsEnabled": false,
    "emailNotificationsRealtime": true,
    "emailNotificationsDailySummary": true,
    "emailNotificationsWeeklySummary": true,
    "emailNotificationsMonthlySummary": true,
    "profileComplete": true,
    "hasUsername": true,
    "hasBio": false,
    "hasProfileImage": true,
    "onChainRegistered": false,
    "nftTokenId": null,
    "agent0TokenId": null,
    "referralCode": "bluesquid678",
    "referredBy": null,
    "reputationPoints": 1050,
    "virtualBalance": 1791.75,
    "pointsAwardedForProfile": true,
    "pointsAwardedForFarcasterFollow": false,
    "pointsAwardedForTwitterFollow": false,
    "pointsAwardedForDiscordJoin": false,
    "pointsAwardedForEmail": true,
    "hasFarcaster": false,
    "hasTwitter": true,
    "hasDiscord": false,
    "farcasterUsername": null,
    "twitterUsername": "test",
    "discordUsername": null,
    "showTwitterPublic": true,
    "showFarcasterPublic": true,
    "showWalletPublic": true,
    "isAdmin": true,
    "isActor": false,
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "gameGuideCompletedAt": "ISO timestamp",
    "stats": {
      "followers": 0,
      "following": 1,
      "positions": 4,
      "comments": 0,
      "reactions": 0,
      "posts": 3
    }
  }
}
```

**Unauthenticated:** Returns `401` with `{"error":"Missing or invalid authorization header or cookie"}` -- PASS

---

## 2. User Search (`GET /api/users/search`)

**Status:** 200 OK -- PASS

| Test Case | Query | Status | Result |
|-----------|-------|--------|--------|
| Normal search | `?q=test` | 200 | 20 results returned |
| Two-char search | `?q=ab` | 200 | 20 results returned |
| Empty query | `?q=` | 200 | Empty array `{"users":[]}` |
| Single char | `?q=a` | 200 | Empty array |
| No param | (none) | 200 | Empty array |
| SQL injection | `?q='OR 1=1--` | 200 | Empty array (safe) |
| Very long string (500 chars) | `?q=aaa...` | 200 | Empty array |

**Response structure per user:**
```json
{
  "id": "did:privy:...",
  "displayName": "...",
  "username": "...",
  "profileImageUrl": "...",
  "bio": "..."
}
```

### BUG-SEARCH-01: No pagination support visible (LOW)
Search returns 20 results with no `total`, `page`, or `hasMore` field. Unknown if `?limit=` or `?page=` params are supported. The `?limit=3` param was tested but difficult to confirm behavior due to shell issues.

### BUG-SEARCH-02: Single-char search returns no results (LOW)
Searching `?q=a` returns empty results even though many usernames contain "a". Minimum query length appears to be 2 characters but no error message indicates this to the user.

---

## 3. View Other User Profile

### `GET /api/users/{userId}/profile` (URL-encoded DID)
**Status:** 200 OK -- PASS

**Response structure:**
```json
{
  "user": {
    "id", "walletAddress", "username", "displayName", "bio",
    "profileImageUrl", "coverImageUrl", "isActor", "isAgent",
    "managedBy", "profileComplete", "hasUsername", "hasBio",
    "hasProfileImage", "onChainRegistered", "nftTokenId",
    "virtualBalance", "lifetimePnL", "reputationPoints",
    "totalPoints", "earnedPoints", "invitePoints", "bonusPoints",
    "referralCount", "referralCode", "hasFarcaster", "hasTwitter",
    "farcasterUsername", "twitterUsername", "usernameChangedAt",
    "createdAt", "stats"
  }
}
```

### `GET /api/users/by-username/{username}`
**Status:** 200 OK -- PASS

Returns similar structure but slightly different fields (no `totalPoints`, `earnedPoints`, `invitePoints`, `bonusPoints`).

| Test Case | Status | Response |
|-----------|--------|----------|
| Valid user ID | 200 | Full profile |
| Valid username | 200 | Full profile |
| Non-existent ID | 200 | `{"user": null}` |
| Non-existent username | 404 | `{"error": "User not found"}` |

### BUG-PROFILE-01: Inconsistent 404 handling (MEDIUM)
`/api/users/{id}/profile` returns HTTP 200 with `{"user":null}` for non-existent users, while `/api/users/by-username/{name}` returns HTTP 404. These should be consistent -- both should return 404 for not-found users.

### BUG-PROFILE-02: Excessive data exposure on other user profiles (MEDIUM)
The `/api/users/{userId}/profile` endpoint exposes financial data for any user:
- `virtualBalance` -- exact balance visible
- `lifetimePnL` -- exact PnL
- `totalPoints`, `earnedPoints`, `invitePoints`, `bonusPoints` -- full point breakdown
- `referralCode` -- user's referral code
- `referralCount` -- count of referrals
- `usernameChangedAt` -- timestamp of username change

Some of these fields (particularly `virtualBalance`, `lifetimePnL`, exact point breakdowns) may be considered private. The `/api/users/by-username/` endpoint is slightly more restrained but still exposes most of this data.

---

## 4. Followers & Following

### `GET /api/users/{userId}/followers?page=1&limit=10`
**Status:** 200 OK -- PASS

**Response:** `{"followers": [...], "count": 0}`

### `GET /api/users/{userId}/following?page=1&limit=10`
**Status:** 200 OK -- PASS

**Response:**
```json
{
  "following": [{
    "id": "...",
    "displayName": "...",
    "username": "...",
    "profileImageUrl": "...",
    "bio": "...",
    "isActor": false,
    "followedAt": "ISO timestamp",
    "type": "user",
    "tier": null,
    "isMutualFollow": true
  }],
  "count": 1
}
```

### BUG-FOLLOW-01: Missing pagination defaults (MEDIUM)
`GET /api/users/{userId}/followers` without `?page=` and `?limit=` returns:
```json
{"error":"Validation failed","details":[
  {"field":"page","message":"Too small: expected number to be >0"},
  {"field":"limit","message":"Too small: expected number to be >0"}
]}
```
**Status:** 400

Both `page` and `limit` should have defaults (e.g., page=1, limit=20) instead of requiring them. The validation error message is also confusing -- it says "too small" but the params were simply absent, not zero.

---

## 5. Follow/Unfollow (`POST/DELETE /api/users/{userId}/follow`)

### `GET /api/users/{userId}/follow` -- Check follow status
**Status:** 200 OK -- PASS
**Response:** `{"isFollowing": false}`

### `POST /api/users/{userId}/follow` -- Follow
**Status:** 201 Created -- PASS
```json
{
  "id": "287578417560289280",
  "following": {
    "id": "did:privy:...",
    "displayName": "...",
    "username": "...",
    "profileImageUrl": "...",
    "bio": "..."
  },
  "createdAt": "ISO timestamp"
}
```

### Follow lifecycle tests

| Test Case | Method | Status | Response |
|-----------|--------|--------|----------|
| Follow user | POST | 201 | Follow object created |
| Check status after follow | GET | 200 | `{"isFollowing": true}` |
| Follow same user again | POST | 400 | `{"error": "Already following this user"}` |
| Unfollow | DELETE | 200 | `{"message": "Unfollowed successfully"}` |
| Unfollow again | DELETE | 404 | `{"error": "Follow relationship not found"}` |
| Self-follow | POST | 400 | `{"error": "Cannot follow yourself"}` |
| Follow non-existent user | POST | 404 | `{"error": "User or actor not found"}` |
| Unauthenticated follow | POST | 401 | Auth error |

All follow/unfollow flows work correctly with proper error handling.

---

## 6. Favorites

### `GET /api/profiles/favorites?page=1&limit=10`
**Status:** 200 OK -- PASS
**Response:** `{"profiles": [], "total": 0}`

### `POST /api/profiles/{id}/favorite` -- Add favorite

### BUG-FAV-01: Favorite endpoint unusable with DID or username (HIGH)
The `[id]` param is validated by `IdParamSchema` which only accepts Snowflake IDs:
```
{"error":"Validation failed","details":[{"field":"id","message":"Invalid Snowflake ID format"}]}
```
**Status:** 400

Both `did:privy:...` (URL-encoded) and username strings fail validation. However, the handler code (lines 95-104) is designed to look up by ID first, then by username. The validation schema (`IdParamSchema = z.object({ id: SnowflakeIdSchema })`) blocks all non-Snowflake formats before the handler logic runs.

**Impact:** Users cannot favorite profiles via this API. The frontend may work around this differently, but the API is broken for external consumers. The route uses `profiles/[id]` but user IDs in this system are Privy DIDs, not Snowflake IDs.

---

## 7. Profile Update (`POST /api/users/{userId}/update-profile`)

**Method:** POST only (PUT returns 405, PATCH returns 405)
**Status:** 200 OK -- PASS

| Test Case | Status | Result |
|-----------|--------|--------|
| Update bio | 200 | Bio updated successfully |
| Update username | 200 | Username + referralCode updated |
| Empty bio `""` | 200 | Bio set to null, `hasBio: false` |
| Very long bio (10000 chars) | 400 | `"Too big: expected string to have <=500 characters"` |
| XSS in bio `<script>alert(1)</script>` | 200 | **Stored as-is** |

**Response structure:**
```json
{
  "user": { ...updated fields... },
  "message": "Profile updated successfully",
  "pointsAwarded": [],
  "onchain": null
}
```

### BUG-PROFILE-03: XSS stored in bio without sanitization (HIGH - SECURITY)
The bio field `<script>alert(1)</script>` is accepted and stored without any HTML sanitization or escaping. While the frontend may escape on render (React does by default), the raw HTML is stored in the database and returned in API responses. If any consumer renders this without escaping, it creates an XSS vulnerability.

**Stored value in response:** `"bio":"<script>alert(1)</script>"`

### BUG-PROFILE-04: Username change updates referralCode silently (LOW)
When username is changed, the `referralCode` automatically changes to match the new username. This could break existing referral links that used the old code. There's no warning about this side effect.

---

## 8. Block & Mute

### `POST /api/users/{userId}/block`

| Test Case | Body | Status | Response |
|-----------|------|--------|----------|
| Block | `{"action":"block"}` | 200 | Block object with IDs and timestamp |
| Unblock | `{"action":"unblock"}` | 200 | Success message |
| No action | `{"reason":"test"}` | 400 | Validation: expected "block" or "unblock" |
| No body | (empty) | 400 | "Invalid JSON in request body" |

### `POST /api/users/{userId}/mute`

| Test Case | Body | Status | Response |
|-----------|------|--------|----------|
| Mute | `{"action":"mute"}` | 200 | Mute object with IDs and timestamp |
| Unmute | `{"action":"unmute"}` | 200 | Success message |
| No action | `{"reason":"test"}` | 400 | Validation: expected "mute" or "unmute" |

Both work correctly. Notifications from blocked/muted users are filtered out.

---

## 9. Notifications

### `GET /api/notifications`
**Status:** 200 OK -- PASS

**Response:**
```json
{
  "notifications": [
    {
      "id": "...",
      "type": "system",
      "actorId": "",
      "actor": null,
      "postId": null,
      "commentId": null,
      "chatId": null,
      "groupId": null,
      "inviteId": null,
      "message": "Welcome to Babylon!...",
      "read": false,
      "createdAt": "ISO timestamp"
    }
  ],
  "unreadCount": 1
}
```

### `POST /api/notifications/mark-read`
**Status:** 200 OK -- PASS

| Test Case | Body | Status | Response |
|-----------|------|--------|----------|
| Mark specific IDs | `{"notificationIds":["id"]}` | 200 | `"1 notification(s) marked as read"` |
| Empty array | `{"notificationIds":[]}` | 200 | `"No notifications to mark"` |
| No body | (none) | 400 | "Invalid JSON in request body" |

### `PATCH /api/notifications` -- Alternative mark-read
Also exists per source code with `notificationIds` or `markAllAsRead: true` body.

### BUG-NOTIF-01: Incorrect unread filter param name (MEDIUM)
The query param is `unreadOnly` (per source code line 211 and OpenAPI docs), but a user might intuitively try `?unread=true`. Using `?unread=true` silently returns ALL notifications (both read and unread) without any error, because the param is ignored by the schema. Should either:
1. Accept `?unread=true` as an alias, or
2. Return 400 for unknown query params

### BUG-NOTIF-02: Duplicate welcome notifications (LOW)
Two identical "Welcome to Babylon!" system notifications were created (IDs 287577292450824192 and 286826807783587840, from different dates). This suggests the welcome notification is sent on every login/session rather than once.

---

## 10. Visibility Settings

### `POST /api/users/{userId}/update-visibility`
**Status:** 200 OK -- PASS

**Required body:** `{"platform": "twitter"|"farcaster"|"wallet", "visible": boolean}`
**Response:** `{"success": true, "visibility": {"twitter": false, "farcaster": true, "wallet": true}}`

Works correctly. Toggling visibility on/off is idempotent.

---

## 11. Email Notification Preferences

### `GET /api/users/{userId}/notification-email-preferences`
**Status:** 200 OK -- PASS

**Response:**
```json
{
  "success": true,
  "preferences": {
    "enabled": false,
    "realtime": true,
    "dailySummary": true,
    "weeklySummary": true,
    "monthlySummary": true
  },
  "email": "ben.b@elizalabs.ai",
  "emailVerified": true
}
```

---

## 12. Activity Heartbeat (`POST /api/activity/heartbeat`)

**Method:** POST only (GET returns 405)
**Status:** 200 OK -- PASS

**Required body:** `{"sessionId": "string", "page": "/path"}`

| Test Case | Status | Response |
|-----------|--------|----------|
| Valid body | 200 | `{"success": true, "sessionId": "test-session-123"}` |
| Empty body `{}` | 400 | `{"success": false, "error": "Invalid sessionId"}` |
| No body | 400 | "Invalid JSON in request body" |

---

## 13. Twitter Integration

### `GET /api/twitter/auth-status`
**Status:** 200 OK -- PASS
**Response:** `{"connected": false}`

### `POST /api/twitter/disconnect`
**Status:** 200 OK -- PASS
**Response:** `{"success": true}`

### `POST /api/users/{userId}/link-social`
**Status:** 200 OK
**Response:** `{"platform": "twitter", "linked": true, "alreadyLinked": true, "points": null}`

---

## 14. Points & Referrals

### `GET /api/users/{userId}/points-history?page=1&limit=5`
**Status:** 200 OK -- PASS

Returns array of point transactions with fields:
`id, userId, amount, pointsBefore, pointsAfter, reason, metadata, createdAt, paymentAmount, paymentRequestId, paymentTxHash, paymentVerified, paymentProvider`

### `GET /api/users/{userId}/referrals`
**Status:** 200 OK -- PASS

Returns user referral info, stats, referral URL, and lists of referred/pending users.

---

## 15. Other Profile Endpoints

### `GET /api/users/{userId}/balance`
**Status:** 200 OK
**Response:** `{"balance": "1778.31", "totalDeposited": "2000.00", "totalWithdrawn": "0.00", "lifetimePnL": "0.26"}`

### `GET /api/users/{userId}/portfolio-breakdown`
**Status:** 200 OK
**Response:** `{"wallet": 1778.28, "agents": 4574.29, "positions": 171.10, "available": 6352.57, "originalAmount": 2000, "totalAssets": 6523.67, "totalPnL": 4523.67, "agentCount": 1, "totalPoints": 2999.38}`

### `GET /api/users/{userId}/activity`
**Status:** 200 OK
Returns array of trade/post activities with timestamps and data.

### `GET /api/users/{userId}/posts?page=1&limit=5`
**Status:** 200 OK
Returns user's posts.

### `GET /api/users/{userId}/is-new`
**Status:** 200 OK
**Response:** `{"needsSetup": false}`

### `POST /api/users/daily-login`
**Status:** 200 OK
**Response:** `{"success": false, "reward": 0, "milestoneBonus": 0, "totalAwarded": 0, "nextReward": 75, "nextMilestone": 7, "daysUntilMilestone": 6, "streakReset": false, "streak": 1, "error": "Cannot claim yet - must wait 24 hours between claims"}`

### BUG-DAILY-01: Daily login returns success:false with 200 status (LOW)
When the user cannot claim yet, the response has `"success": false` but HTTP status is 200. Should arguably be 429 (Too Many Requests) or at minimum a different HTTP status to indicate the action was not performed.

---

## 16. API Keys Endpoint

### `GET /api/users/api-keys`
**Status:** 401 Unauthorized

Returns auth error even with valid privy-token cookie. This endpoint may require Bearer token auth specifically or additional admin permissions.

---

## Summary of Bugs

| ID | Severity | Description |
|----|----------|-------------|
| BUG-PROFILE-03 | **HIGH** | XSS content stored in bio without sanitization |
| BUG-FAV-01 | **HIGH** | Favorite endpoint validates with SnowflakeIdSchema, rejecting both DID and username formats -- endpoint is effectively broken |
| BUG-PROFILE-02 | **MEDIUM** | Other user profile exposes financial data (virtualBalance, lifetimePnL, point breakdowns) |
| BUG-PROFILE-01 | **MEDIUM** | Inconsistent 404 handling between `/users/{id}/profile` (200 + null) and `/users/by-username/{name}` (404) |
| BUG-FOLLOW-01 | **MEDIUM** | Followers/following endpoints require page/limit params with no defaults |
| BUG-NOTIF-01 | **MEDIUM** | Unread filter uses `unreadOnly` param but `?unread=true` silently ignored |
| BUG-SEARCH-01 | **LOW** | Search lacks pagination metadata (total count, hasMore) |
| BUG-SEARCH-02 | **LOW** | Single-char search silently returns empty with no guidance |
| BUG-PROFILE-04 | **LOW** | Username change silently updates referralCode, breaking existing links |
| BUG-NOTIF-02 | **LOW** | Duplicate welcome notifications created across sessions |
| BUG-DAILY-01 | **LOW** | Daily login returns HTTP 200 with success:false |

---

## Endpoint Inventory

| Method | Endpoint | Status | Auth Required |
|--------|----------|--------|---------------|
| GET | `/api/users/me` | 200 | Yes |
| GET | `/api/users/search?q=` | 200 | Yes |
| GET | `/api/users/{userId}/profile` | 200 | Yes |
| GET | `/api/users/by-username/{username}` | 200 | Yes |
| GET | `/api/users/{userId}/followers?page=&limit=` | 200 | Yes |
| GET | `/api/users/{userId}/following?page=&limit=` | 200 | Yes |
| GET | `/api/users/{userId}/follow` | 200 | Optional |
| POST | `/api/users/{userId}/follow` | 201 | Yes |
| DELETE | `/api/users/{userId}/follow` | 200 | Yes |
| GET | `/api/profiles/favorites?page=&limit=` | 200 | Yes |
| POST | `/api/profiles/{id}/favorite` | 400* | Yes |
| DELETE | `/api/profiles/{id}/favorite` | 400* | Yes |
| POST | `/api/users/{userId}/update-profile` | 200 | Yes |
| POST | `/api/users/{userId}/update-visibility` | 200 | Yes |
| POST | `/api/users/{userId}/block` | 200 | Yes |
| POST | `/api/users/{userId}/mute` | 200 | Yes |
| GET | `/api/notifications` | 200 | Yes |
| POST | `/api/notifications/mark-read` | 200 | Yes |
| PATCH | `/api/notifications` | 200 | Yes |
| GET | `/api/users/{userId}/notification-email-preferences` | 200 | Yes |
| POST | `/api/activity/heartbeat` | 200 | Yes |
| GET | `/api/twitter/auth-status` | 200 | Yes |
| POST | `/api/twitter/disconnect` | 200 | Yes |
| POST | `/api/users/{userId}/link-social` | 200 | Yes |
| GET | `/api/users/{userId}/points-history?page=&limit=` | 200 | Yes |
| GET | `/api/users/{userId}/referrals` | 200 | Yes |
| GET | `/api/users/{userId}/balance` | 200 | Yes |
| GET | `/api/users/{userId}/portfolio-breakdown` | 200 | Yes |
| GET | `/api/users/{userId}/activity` | 200 | Yes |
| GET | `/api/users/{userId}/posts` | 200 | Yes |
| GET | `/api/users/{userId}/is-new` | 200 | Yes |
| POST | `/api/users/daily-login` | 200 | Yes |
| POST | `/api/users/me/game-guide` | 200 | Yes |
| GET | `/api/users/api-keys` | 401* | Yes (Bearer?) |

*Endpoints marked with asterisk have issues documented above.
