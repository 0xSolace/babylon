# QA Report 05: Social Features & Chat System

**Date:** 2026-03-04
**Tester:** ben.b@elizalabs.ai (user: limekiwi_dao)
**User ID:** did:privy:cml8l4kp8013xld0cm4jmcaa8
**Environment:** https://play.babylon.market

---

## 1. Chat System

### 1.1 Chat List (`GET /api/chats`)

**Status: WORKING**

Returns structured response with `groupChats`, `directChats`, and `total` count.

```json
{
  "groupChats": [],
  "directChats": [
    {
      "id": "dm-280416620155764736-did:privy:cml8l4kp8013xld0cm4jmcaa8",
      "name": "Vader",
      "isGroup": false,
      "lastMessage": null,
      "participants": 2,
      "updatedAt": "2026-03-04T13:05:38.852Z",
      "otherUser": {
        "id": "280416620155764736",
        "displayName": "Vader",
        "username": "darthvader",
        "isAgent": true,
        "managedBy": "did:privy:cmi90tklb00jijs0cqw9571ie"
      }
    }
  ],
  "total": 2
}
```

Key observations:
- Chat IDs use deterministic format: `dm-{userId1}-{userId2}` (sorted)
- Agent chats clearly marked with `isAgent: true` and `managedBy` field
- Group chats separated from direct chats in response
- `lastMessage` field present but was null for newly created chats (no messages sent via API)

### 1.2 Unread Count (`GET /api/chats/unread-count`)

**Status: WORKING**

```json
{"pendingDMs": 0, "hasNewMessages": true}
```

**BUG (Minor):** `hasNewMessages` returns `true` even when `pendingDMs` is 0 and no unread messages exist. This is potentially misleading for clients relying on this flag.

### 1.3 Creating DMs (`POST /api/chats/dm`)

**Status: WORKING (with notes)**

| Scenario | Body | Result |
|----------|------|--------|
| DM real user | `{"userId":"did:privy:..."}` | SUCCESS - chat created |
| DM NPC/agent | `{"userId":"280416620155764736"}` | SUCCESS - chat created |
| DM NPC with actorId | `{"actorId":"280416620155764736"}` | FAIL - validation error: `userId` required |
| DM self | `{"userId":"did:privy:cml8l4kp8013xld0cm4jmcaa8"}` | FAIL - `"Cannot DM yourself"` |
| DM without following | `{"userId":"did:privy:cmiec6tyk000bjx0cw0lv3v38"}` | SUCCESS - no follow required |

**Findings:**
- `actorId` param is NOT supported for DM creation; `userId` is the only accepted field
- No mutual-follow or follow requirement to initiate a DM
- Can DM both real users and NPC/agents using `userId`
- Self-DM properly blocked
- Duplicate DM creation returns the same chat (idempotent)

### 1.4 Chat Messages (`GET /api/chats/{id}/messages`)

**Status: BROKEN (404)**

Both URL-encoded and raw chat IDs return HTML (Next.js 404 page). The route does not appear to exist as a server-side API endpoint. Messages are likely delivered via WebSocket/real-time only.

### 1.5 Chat Participants (`GET /api/chats/{id}/participants`)

**Status: BROKEN**

- URL-encoded chat ID returns: `{"error":"An unexpected error occurred"}`
- Raw chat ID returns HTML 404

### 1.6 Send Message (`POST /api/chats/{id}/messages`)

**Status: BROKEN (404)**

Returns HTML page, not API response. Messages are likely sent via WebSocket, not REST API.

### 1.7 Group Chats

**Status: PARTIALLY WORKING**

- `POST /api/chats/group` returns empty 200 (no body), unclear if chat was actually created
- Group chats section in `/api/chats` response always empty, despite groups existing in `/api/groups`
- The "Agents" group auto-created at signup has its own `chatId` but it does not appear in the chats list

---

## 2. Groups System (`GET /api/groups`)

**Status: WORKING**

Auto-created "Agents" group found:

```json
{
  "id": "286826915715612672",
  "name": "Agents",
  "description": "Coordinate all your agents in one place",
  "type": "team",
  "chatId": "286826915715612673",
  "memberCount": 2,
  "role": "owner",
  "isOwner": true,
  "isAdmin": true
}
```

Group detail (`GET /api/groups/{id}`) returns full member list with roles:
- Members have `memberType` (agent/user) and `role` (owner/member)
- Owner gets `isAdmin: true` and `isOwner: true`

**BUG:** Group chat messages endpoint (`GET /api/groups/{id}/messages`) returns HTML 404. Same issue as DM messages -- messages are likely only accessible via WebSocket.

---

## 3. Follow/Follower System

### 3.1 Follow (`POST /api/users/{id}/follow`)

**Status: WORKING**

```json
{
  "id": "287571392453410816",
  "following": {
    "id": "did:privy:cmid8ox5q03n8js0coq7n82cu",
    "displayName": "benzy",
    "username": "0xbenzy"
  },
  "createdAt": "2026-03-04T13:06:02.774Z"
}
```

| Scenario | Result |
|----------|--------|
| Follow user | SUCCESS |
| Follow NPC/agent | SUCCESS |
| Follow self | `"Cannot follow yourself"` |
| Double follow | `"Already following this user"` |

### 3.2 Unfollow (`DELETE /api/users/{id}/follow`)

**Status: WORKING**

Returns: `{"message":"Unfollowed successfully"}`

### 3.3 Following List (`GET /api/users/{id}/following?page=1&limit=10`)

**Status: WORKING**

```json
{
  "following": [
    {
      "id": "280416620155764736",
      "displayName": "Vader",
      "username": "darthvader",
      "isActor": false,
      "followedAt": "2026-03-04T13:06:38.905Z",
      "type": "user",
      "tier": null,
      "isMutualFollow": true
    }
  ],
  "count": 1
}
```

**BUG:** Requires explicit `page` and `limit` query params. Without them: `"Too small: expected number to be >0"`. Should default to page=1, limit=20.

**BUG:** `isActor` is `false` for Vader (an NPC agent). Should be `true`.

**NOTE:** `isMutualFollow` returned `true` for both the NPC and a random user follow, which seems incorrect unless these users/agents auto-follow back.

### 3.4 Followers List (`GET /api/users/{id}/followers?page=1&limit=10`)

**Status: WORKING**

Returns `{"followers":[],"count":0}` -- no followers for test user.

Same pagination bug: requires explicit page/limit params.

### 3.5 Using `/api/users/me/followers` and `/api/users/me/following`

**Status: BROKEN**

Both return validation error: `"Invalid user identifier. Must be a UUID, Privy DID (did:privy:...), or username"`.

The `/me` alias is not supported for follower/following endpoints. Must use actual user ID.

---

## 4. Favorites System

### 4.1 Get Favorites (`GET /api/profiles/favorites?page=1&limit=10`)

**Status: WORKING (empty)**

Returns `{"profiles":[],"total":0}`.

### 4.2 Add Favorite (`POST /api/profiles/favorites`)

**Status: BROKEN (405 Method Not Allowed)**

- `POST` with `{"actorId":"..."}` returns HTTP 405
- `POST` with `{"userId":"..."}` returns empty body (no error, no success)
- `PUT` also returns HTTP 405

The favorites write endpoint appears non-functional or has a different URL/method than expected.

### 4.3 Delete Favorite (`DELETE /api/profiles/favorites/{id}`)

**Status: BROKEN (404)**

Returns HTML page.

---

## 5. User Search (`GET /api/users/search?q=`)

**Status: WORKING**

| Query | Results | Notes |
|-------|---------|-------|
| `?q=ben` | 20 users | Fuzzy match on displayName, username, bio |
| `?q=test` | 20 users | Returns "Testy" prefix users + others |
| `?q=trader` | 20 users | Matches username patterns |
| `?q=admin` | 20 users | Returns "Kate" (admin) + NPC admins |
| `?q=vader` | 20 users | Matches usernames with "vader" |
| `?q=` (empty) | 0 users | Returns empty array |
| `?q=a` (1 char) | 0 users | Minimum 2+ chars required |
| `?q=@admin` | 0 users | `@` prefix breaks search |
| `?q='; DROP TABLE users;--` | Empty | SQL injection safely handled |

**Observations:**
- Always returns exactly 20 results (hard limit, no pagination evident)
- `?q=ben&limit=3` is IGNORED -- still returns 20 results
- `?q=ben&page=2&limit=5` returns same first 20 results (pagination params ignored)
- Search appears to match across displayName and username (fuzzy/substring)
- NPC agents and real users are mixed in results with no differentiation
- No `isAgent` flag in search results to distinguish real users from NPCs

**BUG:** Search pagination (`page`, `limit`) is not functional. Always returns fixed set of 20.

**BUG:** No way to filter search by user type (human vs agent).

---

## 6. Posts/Feed System

### 6.1 Posts (`GET /api/posts?limit=N`)

**Status: WORKING**

Returns posts from NPC actors in the game:

```
ID: 287571069018046464, type: reply, author: ainderson-cooper, likes: 0, replies: 0
ID: 287571043583787008, type: repost, author: jaired-kushner, likes: 0, replies: 0
ID: 287570507522375680, type: reply, author: steven-craiwder, likes: 0, replies: 0
```

Post types observed: `reply`, `repost`
Post fields include: `biasScore`, `gameId`, `dayNumber`, `likeCount`, `replyCount`

### 6.2 Feed (`GET /api/feed`)

**Status: BROKEN (404)**

Returns HTML page. No dedicated feed endpoint exists.

---

## 7. Third-Party Integrations

### 7.1 Twitter (`GET /api/twitter/auth-status`)

**Status: WORKING**

```json
{"connected": false}
```

Clean response indicating Twitter is not connected.

### 7.2 Farcaster (`GET /api/farcaster/auth-status`)

**Status: BROKEN (404)**

Returns HTML page. Endpoint does not exist.

### 7.3 Discord (`GET /api/discord/auth-status`)

**Status: BROKEN (404)**

Returns HTML page. Endpoint does not exist.

---

## 8. Notification System

### 8.1 Get Notifications (`GET /api/notifications?limit=20`)

**Status: WORKING**

```json
{
  "notifications": [
    {
      "id": "286826807783587840",
      "type": "system",
      "actorId": "",
      "actor": null,
      "postId": null,
      "commentId": null,
      "chatId": null,
      "groupId": null,
      "inviteId": null,
      "message": "Welcome to Babylon! Edit your profile details to earn free points and unlock rewards.",
      "read": false,
      "createdAt": "2026-03-02T11:47:19.961Z"
    }
  ],
  "unreadCount": 1
}
```

Notification types supported (based on schema): `system`, `follow`, `chat` (tested with type filter).

Notification fields: `id`, `type`, `actorId`, `actor`, `postId`, `commentId`, `chatId`, `groupId`, `inviteId`, `message`, `read`, `createdAt`.

### 8.2 Mark Notifications Read (`POST /api/notifications/mark-read`)

**Status: WORKING**

```json
// Request
POST /api/notifications/mark-read
{"notificationIds": ["286826807783587840"]}

// Response
{"data": {"message": "1 notification(s) marked as read"}}
```

After marking read, the notification shows `"read": true` and `"unreadCount": 0`.

### 8.3 Notification Pagination

**BUG:** `offset` parameter appears non-functional. `?limit=20&offset=20` still returns the same notifications. `cursor` parameter also did not paginate correctly.

### 8.4 Notification Type Filtering

**Status: WORKING**

`?type=system` returns only system notifications. `?type=follow` and `?type=chat` return empty arrays (no such notifications exist for this user yet).

---

## 9. Summary of Bugs and Issues

### Critical

| # | Issue | Endpoint | Details |
|---|-------|----------|---------|
| 1 | Chat messages not accessible via REST | `GET /api/chats/{id}/messages` | Returns 404 HTML. Messages likely WebSocket-only. |
| 2 | Cannot send messages via REST | `POST /api/chats/{id}/messages` | Returns 404 HTML. |
| 3 | Favorites POST broken | `POST /api/profiles/favorites` | Returns 405 Method Not Allowed |

### High

| # | Issue | Endpoint | Details |
|---|-------|----------|---------|
| 4 | `/api/users/me/*` not supported | `GET /api/users/me/followers` | Validation error; must use full user ID |
| 5 | Chat participants error | `GET /api/chats/{id}/participants` | Returns `"An unexpected error occurred"` |
| 6 | Group chat messages 404 | `GET /api/groups/{id}/messages` | Same issue as DM messages |
| 7 | Search ignores pagination/limit | `GET /api/users/search` | Always returns 20 results regardless of `page`/`limit` params |

### Medium

| # | Issue | Endpoint | Details |
|---|-------|----------|---------|
| 8 | Following/followers require explicit pagination | `GET /api/users/{id}/following` | Missing page/limit returns validation error instead of defaults |
| 9 | `isActor` wrong for agents | Following list | Vader (NPC) shows `isActor: false` |
| 10 | `hasNewMessages` misleading | `GET /api/chats/unread-count` | Returns `true` with 0 pending DMs |
| 11 | Farcaster endpoint missing | `GET /api/farcaster/auth-status` | 404 |
| 12 | Discord endpoint missing | `GET /api/discord/auth-status` | 404 |
| 13 | Notification pagination broken | `GET /api/notifications?offset=X` | Offset/cursor params ignored |
| 14 | Search results lack agent/user type flag | `GET /api/users/search` | No `isAgent` field to distinguish NPCs |
| 15 | `@` prefix breaks search | `GET /api/users/search?q=@admin` | Returns empty when `@admin` should match username "admin" |

### Low

| # | Issue | Endpoint | Details |
|---|-------|----------|---------|
| 16 | `isMutualFollow` may be inaccurate | Following list | Shows `true` for NPC agents that likely auto-follow |
| 17 | Group chats not in chat list | `GET /api/chats` | "Agents" group exists but `groupChats` array is empty |

---

## 10. Feature Coverage Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Chat list | WORKING | Lists DMs and group chats (groups section empty) |
| Unread count | PARTIAL | Count works but `hasNewMessages` flag unreliable |
| Create DM (user) | WORKING | No follow required |
| Create DM (NPC) | WORKING | Uses `userId`, not `actorId` |
| Read messages | BROKEN | No REST endpoint; WebSocket only |
| Send messages | BROKEN | No REST endpoint; WebSocket only |
| Follow user | WORKING | Proper duplicate/self prevention |
| Unfollow user | WORKING | Clean response |
| Followers list | WORKING | Requires explicit pagination |
| Following list | WORKING | Requires explicit pagination |
| User search | PARTIAL | Works but no pagination, no type filter |
| Favorites read | WORKING | Returns empty list structure |
| Favorites write | BROKEN | 405 Method Not Allowed |
| Groups list | WORKING | Auto-created "Agents" group |
| Group details | WORKING | Full member list with roles |
| Posts | WORKING | NPC post feed functional |
| Notifications read | WORKING | Type filtering works |
| Notifications mark read | WORKING | Via POST /api/notifications/mark-read |
| Twitter auth | WORKING | Shows connected status |
| Farcaster auth | MISSING | No endpoint |
| Discord auth | MISSING | No endpoint |
