# QA Report 09: User Profile & Account Features

**Date:** 2026-03-04
**Tester:** ben.b@elizalabs.ai (user: limekiwi_dao)
**User ID:** did:privy:cml8l4kp8013xld0cm4jmcaa8
**Environment:** https://play.babylon.market

---

## 1. Full User Profile Schema

### GET /api/users/me

Returns the authenticated user's complete profile. This is the primary "whoami" endpoint.

```json
{
  "authenticated": true,
  "needsOnboarding": false,
  "needsOnchain": false,
  "user": {
    "id": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "privyId": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "privyWalletId": "jt98qw716tldtuduu8g7shpy",
    "offlineWalletReady": true,
    "offlineWalletReadyAt": "2026-03-02T11:47:19.807Z",
    "username": "limekiwi_dao",
    "displayName": "limekiwi_dao",
    "bio": "",
    "profileImageUrl": "https://play.babylon.market/assets/user-profiles/profile-32.jpg",
    "coverImageUrl": "https://play.babylon.market/assets/user-banners/banner-36.jpg",
    "walletAddress": "0x91ddb283efcaf5359cbf6e3b05be839a7f448805",
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
    "referralCode": "limekiwi_dao",
    "referredBy": null,
    "reputationPoints": 709,
    "virtualBalance": 1783.57,
    "pointsAwardedForProfile": true,
    "pointsAwardedForFarcasterFollow": false,
    "pointsAwardedForTwitterFollow": false,
    "pointsAwardedForDiscordJoin": false,
    "pointsAwardedForEmail": true,
    "hasFarcaster": false,
    "hasTwitter": false,
    "hasDiscord": false,
    "farcasterUsername": null,
    "twitterUsername": null,
    "discordUsername": null,
    "showTwitterPublic": true,
    "showFarcasterPublic": true,
    "showWalletPublic": true,
    "isAdmin": true,
    "isActor": false,
    "createdAt": "2026-02-04T22:14:14.602Z",
    "updatedAt": "2026-03-04T12:47:13.514Z",
    "gameGuideCompletedAt": "2026-03-02T11:47:24.757Z",
    "stats": {
      "followers": 0,
      "following": 1,
      "positions": 4,
      "comments": 1,
      "reactions": 2,
      "posts": 3
    }
  }
}
```

### Field Categories

| Category | Fields |
|----------|--------|
| **Identity** | id, privyId, username, displayName, email, walletAddress |
| **Profile Display** | bio, profileImageUrl, coverImageUrl |
| **Wallet/Blockchain** | privyWalletId, offlineWalletReady, offlineWalletReadyAt, onChainRegistered, nftTokenId, agent0TokenId |
| **Points/Balance** | reputationPoints, virtualBalance |
| **Social Links** | hasFarcaster, hasTwitter, hasDiscord, farcasterUsername, twitterUsername, discordUsername |
| **Social Visibility** | showTwitterPublic, showFarcasterPublic, showWalletPublic |
| **Email Notifications** | emailNotificationsEnabled, emailNotificationsRealtime, emailNotificationsDailySummary, emailNotificationsWeeklySummary, emailNotificationsMonthlySummary |
| **Points Tracking** | pointsAwardedForProfile, pointsAwardedForFarcasterFollow, pointsAwardedForTwitterFollow, pointsAwardedForDiscordJoin, pointsAwardedForEmail |
| **Profile Completion** | profileComplete, hasUsername, hasBio, hasProfileImage |
| **Referrals** | referralCode, referredBy |
| **Metadata** | isAdmin, isActor, createdAt, updatedAt, gameGuideCompletedAt |
| **Stats** | followers, following, positions, comments, reactions, posts |

---

## 2. Profile Update (Editable vs Read-Only Fields)

### POST /api/users/{userId}/update-profile

**Method:** POST (PATCH and PUT return empty responses)

**Editable Fields (confirmed via testing):**

| Field | Editable | Notes |
|-------|----------|-------|
| username | YES | Changes referralCode to match. Sets usernameChangedAt. **SECURITY: No rate limit or cooldown observed on username changes.** |
| displayName | YES | Freely changeable |
| bio | YES | Can be set to any string; setting to "" makes hasBio=false |
| profileImageUrl | YES | **SECURITY: Accepts ANY URL including external domains (e.g., example.com). No validation of URL pointing to approved image hosts.** |
| coverImageUrl | YES | Same URL validation concern as profileImageUrl |

**Read-Only Fields (not changeable via update-profile):**
- id, privyId, walletAddress, email
- reputationPoints, virtualBalance
- onChainRegistered, nftTokenId
- isAdmin, isActor
- All social link fields (hasFarcaster, hasTwitter, etc.)
- All stats
- createdAt

**Test Evidence - Full Profile Update:**
```bash
POST /api/users/did%3Aprivy%3Acml8l4kp8013xld0cm4jmcaa8/update-profile
{"displayName":"QA Test Display","bio":"QA test bio full",
 "profileImageUrl":"https://example.com/img.png",
 "coverImageUrl":"https://example.com/cover.png",
 "username":"qa_hacker"}

# Response: Successfully changed ALL fields including username
# referralCode automatically changed to "qa_hacker"
# usernameChangedAt set to current time
```

**FINDING: Profile update returned `profileChainSyncNeeded: false`** - this field indicates whether on-chain profile data needs re-syncing after changes.

---

## 3. Visibility Settings

### POST /api/users/{userId}/update-visibility

Controls which social links are publicly visible on the profile.

**Request format:**
```json
{"platform": "twitter", "visible": false}
```

**Platforms:** `twitter`, `farcaster`, `wallet`

**Response:**
```json
{"success": true, "visibility": {"twitter": false, "farcaster": true, "wallet": true}}
```

**BUG: Validation error message is unclear.** Sending `{"showTwitterPublic": false}` returns:
```json
{"error":"Validation failed","details":[
  {"field":"platform","message":"Invalid option: expected one of \"twitter\"|\"farcaster\"|\"wallet\""},
  {"field":"visible","message":"Invalid input: expected boolean, received undefined"}
]}
```
The API uses `{platform, visible}` format, not the field names from the user profile (`showTwitterPublic`). This is an inconsistency.

---

## 4. Social Link Management

### POST /api/users/{userId}/link-social

Links a social platform to the user profile.

**Request:**
```json
{"platform": "twitter", "username": "test"}
```

**Response:**
```json
{
  "platform": "twitter",
  "linked": true,
  "alreadyLinked": false,
  "points": {"awarded": 300, "newTotal": 1050}
}
```

**SECURITY FINDING:** The link-social endpoint accepted any username string without verification. No OAuth flow or ownership proof is required. The user simply declares their Twitter username and gets 300 points for it. This is a **points farming vulnerability**.

---

## 5. Balance & Portfolio

### GET /api/users/{userId}/balance

```json
{
  "balance": "1777.02",
  "totalDeposited": "2000.00",
  "totalWithdrawn": "0.00",
  "lifetimePnL": "0.47"
}
```

Note: balance values are strings (not numbers), while the /me endpoint returns virtualBalance as a number.

### GET /api/users/{userId}/portfolio-breakdown

```json
{
  "wallet": 1741.75,
  "agents": 4574.29,
  "positions": 159.78,
  "available": 6316.04,
  "originalAmount": 2000,
  "totalAssets": 6475.82,
  "totalPnL": 4475.82,
  "agentCount": 1,
  "totalPoints": 2601.53
}
```

**Key Metrics:**
- `wallet`: Liquid balance in wallet
- `agents`: Value invested in agents
- `positions`: Value in open perp positions
- `available`: wallet + agents + positions
- `originalAmount`: Starting deposit (2000 virtual currency)
- `totalPnL`: Total profit/loss since start
- `totalPoints`: Aggregate points including portfolio value

---

## 6. Activity Feed

### GET /api/users/{userId}/activity

Returns a chronological feed of user actions.

**Activity types observed:**
- `trade` with subtypes: `perp_open`, `perp_close`

**Activity item schema:**
```json
{
  "type": "trade",
  "id": "287572219016511488",
  "timestamp": "2026-03-04T13:09:19.838Z",
  "data": {
    "tradeType": "perp_open",
    "marketId": null,
    "marketQuestion": null,
    "amount": 5.01,
    "description": "Open 2x long STRAT"
  }
}
```

**NOTE:** `marketId` is null for open trades but populated for close trades. `marketQuestion` is always null for perp trades.

---

## 7. Points System

### GET /api/users/{userId}/points-history

Returns a log of all point transactions.

**Point transaction schema:**
```json
{
  "id": "287571516604809216",
  "userId": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
  "amount": 100,
  "pointsBefore": 609,
  "pointsAfter": 709,
  "reason": "email_submit",
  "metadata": null,
  "createdAt": "2026-03-04T13:06:32.382Z",
  "paymentAmount": null,
  "paymentRequestId": null,
  "paymentTxHash": null,
  "paymentVerified": false,
  "paymentProvider": null
}
```

**Point reasons observed:**
| Reason | Amount | Notes |
|--------|--------|-------|
| `profile_completion` | +200 | One-time on completing profile |
| `email_submit` | +100 | One-time for adding email |
| `trading_pnl` | +1/-1 | Dynamic based on PnL changes |
| Daily login (via daily-login) | +50 | Streak-based rewards |

**Points awarded by social actions:**
| Action | Points |
|--------|--------|
| Link Twitter | 300 |
| Link Farcaster | Unknown (not tested) |
| Join Discord | Unknown (not tested) |
| Profile completion | 200 |
| Email submission | 100 |

**BUG: Points inconsistency.** The `pointsBefore` of 1500 dropped to 599 in one transaction with amount -1, suggesting a bulk recalculation happened silently (the delta should have been -1, not -901).

---

## 8. Referral System

### GET /api/users/{userId}/referrals

```json
{
  "user": {
    "id": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "username": "limekiwi_dao",
    "referralCode": "limekiwi_dao",
    "reputationPoints": 700,
    "totalPoints": 2508.73,
    "totalFeesEarned": "0.00"
  },
  "stats": {
    "totalReferrals": 0,
    "pendingReferrals": 0,
    "totalFeesEarned": 0,
    "feeShareRate": 0.5,
    "followingCount": 0,
    "weeklyReferralCount": 0,
    "weeklyLimit": 10
  },
  "referredUsers": [],
  "pendingReferredUsers": [],
  "referralUrl": "https://play.babylon.market?ref=limekiwi_dao"
}
```

### GET /api/users/{userId}/referral-code

```json
{
  "referralCode": "limekiwi_dao",
  "referralCount": 0,
  "referralUrl": "https://play.babylon.market?ref=limekiwi_dao"
}
```

### GET /api/users/{userId}/referral-fees

```json
{
  "totalEarned": 0,
  "totalReferrals": 0,
  "topReferrals": [],
  "recentFees": []
}
```

**Referral System Details:**
- Referral code = username (auto-synced on username change)
- Fee share rate: 50%
- Weekly referral limit: 10
- Referral URL format: `https://play.babylon.market?ref={referralCode}`

---

## 9. Onboarding & New User Detection

### GET /api/users/{userId}/is-new

```json
{
  "needsSetup": false,
  "profileComplete": true,
  "hasUsername": true,
  "hasBio": false,
  "hasProfileImage": true
}
```

The `/api/users/me` endpoint also returns onboarding flags:
- `needsOnboarding: false`
- `needsOnchain: false`

Profile completion criteria:
- hasUsername (required)
- hasBio (tracked but not required for profileComplete)
- hasProfileImage (required)

**Game guide tracking:** `gameGuideCompletedAt` timestamp recorded when user completes the tutorial.

---

## 10. Email Notification Preferences

### GET /api/users/{userId}/notification-email-preferences

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

### POST /api/users/{userId}/notification-email-preferences

**Status:** Returns 500 "An unexpected error occurred"

The POST endpoint requires authentication via `authenticate()` middleware. While the GET works with the bearer token, the POST handler's authentication appears to fail. This may indicate the `authenticate` function requires a different token format (possibly a Privy access token vs the session JWT being used).

**Available preferences:**
- `enabled`: Master toggle
- `realtime`: Real-time event notifications
- `dailySummary`: Daily digest
- `weeklySummary`: Weekly digest
- `monthlySummary`: Monthly digest

---

## 11. User Lookup & Search

### GET /api/users/search?q={query}

Public search endpoint. Returns matching users by username, display name, or bio content.

**Response schema:**
```json
{
  "users": [
    {
      "id": "did:privy:...",
      "displayName": "Kate",
      "username": "admin",
      "profileImageUrl": "https://...",
      "bio": "..."
    }
  ]
}
```

**Observations:**
- Search returns partial matches (fuzzy)
- No pagination parameters observed (returns all matches)
- Search fields: username, displayName, bio
- **Does NOT expose email, walletAddress, or other sensitive fields in search results**

### GET /api/users/{userId}/profile

Public profile endpoint (no auth required). Accepts userId as Privy DID format.

**Returns more fields than search**, including:
- virtualBalance, lifetimePnL
- reputationPoints, totalPoints, earnedPoints, invitePoints, bonusPoints
- referralCount, referralCode
- isAgent, managedBy
- Social links and stats

### GET /api/users/by-username/{username}

Returns user data by exact username match. Returned "User not found" after username was changed back, suggesting possible caching delay.

---

## 12. Social Features

### GET /api/users/{userId}/followers?page=1&limit=10

```json
{"followers": [], "count": 0}
```

Requires pagination parameters (page and limit are required, not optional).
**BUG:** Missing page/limit returns validation error with "Too small: expected number to be >0" suggesting defaults should be 0 but validation expects >0.

### GET /api/users/{userId}/following?page=1&limit=10

```json
{"following": [], "count": 0}
```

Same pagination requirements as followers.

### POST /api/users/{userId}/follow

Follow a user. The userId in the path is the target user to follow.

```json
{
  "id": "287573001401008128",
  "following": {
    "id": "did:privy:cmiec6tyk000bjx0cw0lv3v38",
    "displayName": "Kate",
    "username": "admin",
    "profileImageUrl": "https://i.imgur.com/RslM9a9.gif",
    "bio": "..."
  },
  "createdAt": "2026-03-04T13:12:26.378Z"
}
```

### DELETE /api/users/{userId}/follow

Unfollow. Returns 500 error (same auth issue as other write endpoints).

### GET /api/users/{userId}/block

Check block status: `{"isBlocked": false, "block": null}`

### GET /api/users/{userId}/mute

Check mute status: `{"isMuted": false, "mute": null}`

### GET /api/users/{userId}/share

Share tracking: `{"shares": [], "count": 0}`

### GET /api/users/{userId}/posts?page=1&limit=5

User's posts: `{"type": "posts", "items": [], "total": 0}`

---

## 13. Daily Login Rewards

### POST /api/users/daily-login

```json
{
  "success": true,
  "streak": 1,
  "reward": 50,
  "milestoneBonus": 0,
  "totalAwarded": 50,
  "nextReward": 75,
  "nextMilestone": 7,
  "daysUntilMilestone": 6,
  "streakReset": false
}
```

**Streak reward progression:**
- Day 1: 50 points
- Day 2: 75 points (increasing)
- Milestone at day 7
- Streak resets if daily login is missed

---

## 14. Data Export

### GET /api/users/export-data

Full GDPR-style data export. Includes:
- All personal information (including waitlist data)
- Content (posts)
- Transaction history
- Blockchain notice about immutable on-chain data

**Notable fields in export not visible in regular profile:**
- `waitlistPosition`: 472774
- `waitlistJoinedAt`: "2026-03-03T19:46:15.279Z"
- `isWaitlistActive`: true
- `waitlistGraduatedAt`: null
- `tosAccepted`: true
- `tosAcceptedVersion`: "2025-11-11"
- `privacyPolicyAccepted`: true
- `privacyPolicyAcceptedVersion`: "2025-11-11"
- `totalDeposited`: "2000.00"
- `totalWithdrawn`: "0.00"

---

## 15. API Keys

### GET /api/users/api-keys

Returns: `{"keys": []}`

### POST /api/users/api-keys

Returns 500 error (same auth issue). Endpoint exists per source code.

---

## 16. Complete API Route Map

Discovered from source code at `apps/web/src/app/api/users/`:

| Route | Methods | Auth | Status |
|-------|---------|------|--------|
| `/api/users/me` | GET | Bearer | Working |
| `/api/users/me/game-guide` | POST | Auth | 500 error |
| `/api/users/search` | GET | Public | Working |
| `/api/users/by-username/{username}` | GET | Bearer | Working |
| `/api/users/daily-login` | POST | Bearer | Working |
| `/api/users/delete-account` | ? | Auth | Empty response |
| `/api/users/export-data` | GET | Bearer | Working |
| `/api/users/signup` | POST | Auth | Empty response |
| `/api/users/points/award` | POST | Auth | Requires userId |
| `/api/users/api-keys` | GET, POST | Auth | GET works, POST 500 |
| `/api/users/api-keys/{keyId}` | ? | Auth | Not tested |
| `/api/users/onboarding/onchain` | POST | Auth | Empty response |
| `/api/users/register-onchain` | POST | Auth | Empty response |
| `/api/users/{userId}/activity` | GET | Public | Working |
| `/api/users/{userId}/balance` | GET | Public | Working |
| `/api/users/{userId}/block` | GET, POST | Mixed | GET works |
| `/api/users/{userId}/follow` | GET, POST, DELETE | Mixed | GET/POST work, DELETE 500 |
| `/api/users/{userId}/followers` | GET | Public | Working (requires page/limit) |
| `/api/users/{userId}/following` | GET | Public | Working (requires page/limit) |
| `/api/users/{userId}/is-new` | GET | Public | Working |
| `/api/users/{userId}/link-social` | POST | Bearer | Working |
| `/api/users/{userId}/mute` | GET, POST | Mixed | GET works |
| `/api/users/{userId}/notification-email-preferences` | GET, POST | Auth | GET works, POST 500 |
| `/api/users/{userId}/points-history` | GET | Public | Working |
| `/api/users/{userId}/portfolio-breakdown` | GET | Public | Working |
| `/api/users/{userId}/posts` | GET | Public | Working |
| `/api/users/{userId}/profile` | GET | Public | Working |
| `/api/users/{userId}/referral-code` | GET | Public | Working |
| `/api/users/{userId}/referral-fees` | GET | Public | Working |
| `/api/users/{userId}/referrals` | GET | Public | Working |
| `/api/users/{userId}/share` | GET | Public | Working |
| `/api/users/{userId}/update-profile` | POST | Bearer | Working |
| `/api/users/{userId}/update-visibility` | POST | Bearer | Working |
| `/api/users/{userId}/verify-discord-join` | POST | Auth | 500 error |
| `/api/users/{userId}/verify-farcaster-follow` | POST | Auth | 500 error |
| `/api/users/{userId}/verify-share` | POST | Auth | Not tested |
| `/api/users/{userId}/verify-twitter-follow` | POST | Auth | 500 error |

---

## 17. Security Findings

### CRITICAL

1. **Unverified Social Link Claims (Points Farming)**
   - `POST /api/users/{userId}/link-social` accepts any username without verification
   - Awards 300 points for linking Twitter with no OAuth/ownership proof
   - Attacker can claim any Twitter handle and receive points

2. **Unrestricted Profile Image URLs**
   - `profileImageUrl` and `coverImageUrl` accept any URL
   - No allowlist of approved image hosts
   - Could be used for:
     - Tracking pixels (privacy violation)
     - Offensive content injection
     - SSRF if server-side fetches the URL

3. **Username Change Has No Cooldown**
   - Username can be changed repeatedly in quick succession
   - Each change updates `referralCode` and `usernameChangedAt`
   - Could be exploited to impersonate other users temporarily

### HIGH

4. **Followers/Following Pagination Validation Bug**
   - Default values of 0 fail validation that requires >0
   - Should default to page=1, limit=20 or similar

5. **Points History Anomaly**
   - Transaction shows `pointsBefore: 1500` dropping to `pointsAfter: 599` with `amount: -1`
   - This is a 901-point discrepancy suggesting silent bulk recalculation
   - Points recalculations should be logged as separate transactions

### MEDIUM

6. **/api/users/me Exposes isAdmin Flag**
   - The `isAdmin: true` flag is visible to the client
   - Could be used for reconnaissance

7. **Inconsistent Data Types**
   - `/api/users/{userId}/balance` returns string values ("1777.02")
   - `/api/users/me` returns `virtualBalance` as number (1783.57)
   - `/api/users/{userId}/profile` returns `virtualBalance` as number
   - Should be consistent across endpoints

8. **Export Endpoint Leaks Internal Metadata**
   - Waitlist position, TOS acceptance timestamps, and version strings exposed
   - While this is the user's own data, the waitlist position could be used to estimate total user count

---

## 18. Bugs Summary

| # | Severity | Description | Endpoint |
|---|----------|-------------|----------|
| 1 | CRITICAL | Social links accept unverified usernames for points | POST link-social |
| 2 | CRITICAL | Profile image URLs not validated/restricted | POST update-profile |
| 3 | CRITICAL | No username change cooldown | POST update-profile |
| 4 | HIGH | Followers/following requires explicit page/limit (no defaults) | GET followers/following |
| 5 | HIGH | Points history shows impossible delta (-901 from amount -1) | GET points-history |
| 6 | MEDIUM | /api/users/me returns 405 for PATCH/PUT (no error body) | PATCH/PUT /api/users/me |
| 7 | MEDIUM | isAdmin exposed to client | GET /api/users/me |
| 8 | MEDIUM | Balance type inconsistency (string vs number) | Multiple |
| 9 | LOW | Multiple authenticated POST endpoints return generic 500 | Various POST endpoints |
| 10 | LOW | by-username returns "User not found" after username revert (cache?) | GET by-username |

---

## 19. Test Actions Performed & Reverted

During testing, the following changes were made and reverted:

1. **Username changed** to `qa_hacker` -> reverted to `limekiwi_dao`
2. **Display name changed** to `QA Test Display` -> reverted to `limekiwi_dao`
3. **Bio changed** to `QA test bio full` -> reverted to `""`
4. **Profile/cover images** changed to example.com URLs -> reverted to originals
5. **Twitter visibility** set to false -> reverted to true
6. **Twitter linked** with username "test" (300 points awarded) -> attempted DELETE (empty response)
7. **Followed user "admin" (Kate)** -> DELETE unfollow returned 500 (may still be following)
8. **Daily login claimed** -> 50 points awarded (cannot be reverted)

**WARNING:** Twitter link may still be active and 300 points were permanently awarded. The follow of user "admin" may also still be active due to DELETE endpoint failure.
