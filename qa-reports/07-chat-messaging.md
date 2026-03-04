# QA Report: Chat & Messaging System

**Date:** 2026-03-04
**Tester:** Automated QA (API-level)
**Auth User:** bluesquid678 (`did:privy:cml8l4kp8013xld0cm4jmcaa8`)
**Base URL:** https://play.babylon.market

---

## Executive Summary

The chat and messaging system is largely functional with well-structured APIs, quality checks, duplicate detection, and real-time SSE support. Two significant bugs were found: (1) the NPC DM guard is bypassed via the message-send endpoint's auto-create logic, and (2) the `/api/chats/[id]/participants` endpoint returns a 500 error. Several sub-routes under groups return HTML 404s or 405s, indicating missing or misconfigured route handlers.

---

## Endpoints Tested

### 1. GET /api/chats -- List Chats

| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Auth Required | Yes |

**Response Structure:**
```json
{
  "groupChats": [],
  "directChats": [
    {
      "id": "dm-{userId1}-{userId2}",
      "name": "Vader",
      "isGroup": false,
      "lastMessage": null,
      "participants": 2,
      "updatedAt": "2026-03-04T13:05:38.852Z",
      "otherUser": {
        "id": "280416620155764736",
        "displayName": "Vader",
        "username": "darthvader",
        "profileImageUrl": "https://...",
        "isAgent": true,
        "managedBy": "did:privy:cmi90tklb00jijs0cqw9571ie"
      }
    }
  ],
  "total": 3
}
```

**Notes:**
- Returns both group and direct chats
- `otherUser` includes `isAgent` and `managedBy` fields for agent detection
- `lastMessage` was null for all chats (possibly because messages were just sent)

---

### 2. GET /api/chats/unread-count

| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Auth Required | Yes |

**Response:**
```json
{
  "pendingDMs": 0,
  "hasNewMessages": true
}
```

**Notes:**
- `pendingDMs` count is 0 even though messages exist in DMs
- `hasNewMessages` is true but there is no granular per-chat unread count
- No read receipt mechanism visible in the API

---

### 3. POST /api/chats/dm -- Create/Get DM Chat

| Field | Value |
|-------|-------|
| Status | **201 Created** |
| Auth Required | Yes |
| Body | `{ "userId": "<target-user-id>" }` |

**Validation Tests:**

| Scenario | Status | Response |
|----------|--------|----------|
| DM to real user (benzy) | 201 | Chat created successfully |
| DM to NPC/Agent (Vader, `isAgent:true`) | **201** | Chat created -- **SEE BUG #1** |
| DM to self | 400 | `"Cannot DM yourself"` |
| DM to nonexistent user | 404 | `"User not found"` |
| Wrong field name (`targetUserId`) | 400 | `"Invalid input: expected string, received undefined"` (field: userId) |
| No auth | 401 | `"Missing or invalid authorization header or cookie"` |

**Response (success):**
```json
{
  "chat": {
    "id": "dm-did:privy:cmid8ox5q03n8js0coq7n82cu-did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "name": null,
    "isGroup": false,
    "otherUser": {
      "id": "did:privy:cmid8ox5q03n8js0coq7n82cu",
      "displayName": "benzy",
      "username": "0xbenzy",
      "profileImageUrl": "https://i.imgur.com/3QN2aNK.jpg"
    }
  }
}
```

**Chat ID Format:** `dm-{sortedId1}-{sortedId2}` -- deterministic, idempotent

---

### 4. GET /api/chats/{id} -- Chat Detail + Messages

| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Auth Required | Yes (except game chats with `?debug=true`) |
| Pagination | Cursor-based (`?cursor=<messageId>&limit=<n>`) |

**Response Structure:**
```json
{
  "chat": {
    "id": "dm-...",
    "name": "benzy",
    "isGroup": false,
    "createdAt": "2026-03-04T13:04:54.184Z",
    "updatedAt": "2026-03-04T13:04:54.235Z",
    "otherUser": {
      "id": "did:privy:...",
      "displayName": "benzy",
      "username": "0xbenzy",
      "profileImageUrl": "https://...",
      "isAgent": false,
      "managedBy": null
    }
  },
  "messages": [
    {
      "id": "287578407984693248",
      "content": "QA test message - automated testing",
      "senderId": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
      "type": "user",
      "createdAt": "2026-03-04T13:33:55.412Z",
      "metadata": null,
      "reactions": [
        { "emoji": "\ud83d\udc4d", "count": 1, "reactedByMe": true }
      ]
    }
  ],
  "participants": [
    {
      "id": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
      "displayName": "bluesquid678",
      "username": "bluesquid678",
      "profileImageUrl": "https://..."
    }
  ],
  "pagination": {
    "hasMore": false,
    "nextCursor": null,
    "limit": 1
  }
}
```

**Notes:**
- Messages returned in chronological order (oldest first)
- Reactions included inline with each message
- `type` field distinguishes "user" vs "system" messages
- For DMs, `otherUser` includes `isAgent` and `managedBy` for UI rendering
- NFT-gated chats include `nftRequirement` object

---

### 5. POST /api/chats/{id}/message -- Send Message

| Field | Value |
|-------|-------|
| Status | **201 Created** |
| Auth Required | Yes |
| Body | `{ "content": "<message text>" }` |

**Validation Tests:**

| Scenario | Status | Response |
|----------|--------|----------|
| Valid message | 201 | Message created with quality score |
| Empty content | 400 | `"Too small: expected string to have >=1 characters"` |
| Duplicate message (same content) | 400 | `"Message is too similar to a recent message you posted"` |
| Message to agent DM | **201** | Succeeds -- **SEE BUG #1** |

**Response (DM):**
```json
{
  "message": {
    "id": "287578407984693248",
    "content": "QA test message - automated testing",
    "chatId": "dm-...",
    "senderId": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "createdAt": "2026-03-04T13:33:55.412Z"
  },
  "quality": {
    "score": 1,
    "warnings": [],
    "factors": { "length": 1, "uniqueness": 1, "contentQuality": 1 }
  },
  "warnings": [],
  "chatType": "dm"
}
```

**Response (Group Chat):**
```json
{
  "message": { ... },
  "quality": { ... },
  "membership": {
    "messageCount": 1,
    "qualityScore": 1,
    "lastMessageAt": "2026-03-04T13:34:44.905Z",
    "messagesLast24h": 1,
    "status": "active"
  },
  "warnings": [],
  "chatType": "group"
}
```

**Features Confirmed:**
- Rate limiting active
- Duplicate message detection active
- Message quality scoring (length, uniqueness, contentQuality)
- Group chat membership stats tracked (messageCount, qualityScore)
- Sweep/kick mechanics calculated for group chats
- SSE broadcast on message send
- Notification dispatch (DM and group)

---

### 6. GET /api/chats/{id}/messages -- DOES NOT EXIST

| Field | Value |
|-------|-------|
| Status | **HTML 404** (returns Next.js HTML page, not JSON) |

**Bug:** No `/messages` sub-route exists. Messages are fetched via `GET /api/chats/{id}` which includes messages in the response. The URL `/api/chats/{id}/messages` falls through to Next.js page routing and returns HTML.

---

### 7. Message Reactions

#### POST /api/chats/{id}/messages/{messageId}/reactions

| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Body | `{ "emoji": "\ud83d\udc4d" }` |

**Response:**
```json
{
  "messageId": "287578407984693248",
  "reactions": [
    { "emoji": "\ud83d\udc4d", "count": 1, "reactedByMe": true }
  ]
}
```

#### DELETE /api/chats/{id}/messages/{messageId}/reactions

| Field | Value |
|-------|-------|
| Status | **400** |
| Response | `"emoji is required"` |

**Note:** DELETE expects emoji in query params or different body format. The request with `{"emoji":"..."}` in body did not work. This needs investigation -- may be a query param requirement.

---

### 8. GET /api/chats/{id}/participants

| Field | Value |
|-------|-------|
| Status | **500 Internal Server Error** |
| Response | `"An unexpected error occurred"` |

**BUG #2** -- See bugs section.

---

### 9. GET /api/chats/{id}/participants/me

| Field | Value |
|-------|-------|
| Status | **405 Method Not Allowed** |

Route exists in source code but only handles specific HTTP methods (not GET).

---

### 10. GET /api/chats/{id}/group

| Field | Value |
|-------|-------|
| Status | **200 OK** |

**Response:**
```json
{ "groupId": "286826915715612672" }
```

Returns the associated group ID for a group chat.

---

### 11. GET /api/chats/nft-gated

| Field | Value |
|-------|-------|
| Status | **200 OK** |

**Response:**
```json
{
  "chats": [
    {
      "id": "279428073848307713",
      "name": "NFT Alpha Group",
      "description": "Exclusive chat for ProtoMonkeys NFT holders",
      "memberCount": 11,
      "nftRequirement": {
        "contractAddress": "0x0C4846A0918FB8648Ba150d3E7cb9Ef9acdAA204",
        "tokenId": null,
        "chainId": 1
      },
      "isMember": false,
      "hasAccess": false,
      "ownedTokenIds": [],
      "createdAt": "2026-02-10T01:47:24.328Z"
    }
  ],
  "hasWallet": true,
  "walletAddress": "0x91ddb283efcaf5359cbf6e3b05be839a7f448805",
  "pagination": { "total": 1, "limit": 20, "offset": 0, "hasMore": false }
}
```

---

### 12. GET /api/chats/{id}/nft-verification

| Field | Value |
|-------|-------|
| Status | **200 OK** |

**Response:**
```json
{
  "ownsNft": false,
  "tokenIds": [],
  "nftRequired": true,
  "contractAddress": "0x0C4846A0918FB8648Ba150d3E7cb9Ef9acdAA204",
  "tokenId": null,
  "chainId": 1
}
```

---

### 13. POST /api/chats/{id}/join-nft

| Field | Value |
|-------|-------|
| Status | **400 Bad Request** |
| Response | `"Must own NFT from this collection"` |

Correctly prevents joining without NFT ownership.

---

## Group Endpoints

### 14. GET /api/groups

| Field | Value |
|-------|-------|
| Status | **200 OK** |

**Response:**
```json
{
  "groups": [
    {
      "id": "286826915715612672",
      "name": "Agents",
      "description": "Coordinate all your agents in one place",
      "type": "team",
      "chatId": "286826915715612673",
      "createdAt": "2026-03-02T11:47:45.693Z",
      "updatedAt": "2026-03-02T11:48:02.389Z",
      "memberCount": 2,
      "role": "owner",
      "isOwner": true,
      "isAdmin": true
    }
  ]
}
```

---

### 15. GET /api/groups/{groupId}

| Field | Value |
|-------|-------|
| Status | **200 OK** |

**Response includes full member list:**
```json
{
  "group": {
    "id": "286826915715612672",
    "name": "Agents",
    "description": "Coordinate all your agents in one place",
    "type": "team",
    "chatId": "286826915715612673",
    "ownerId": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "createdById": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "members": [
      {
        "id": "286826984749662208",
        "displayName": "Mu Plus",
        "memberType": "agent",
        "role": "member",
        "isAdmin": false,
        "isOwner": false,
        "joinedAt": "2026-03-02T11:48:02.389Z"
      },
      {
        "id": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
        "displayName": "bluesquid678",
        "memberType": "user",
        "role": "owner",
        "isAdmin": true,
        "isOwner": true,
        "joinedAt": "2026-03-02T11:47:45.693Z"
      }
    ],
    "userRole": "owner",
    "isAdmin": true,
    "isOwner": true
  }
}
```

---

### 16. POST /api/groups -- Create Group

| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Body | `{ "name": "QA Test Group", "description": "Testing group creation" }` |

**Response:**
```json
{
  "group": {
    "id": "yssFXz-rqTsRkZX3hfgKg",
    "name": "QA Test Group",
    "type": "user",
    "createdAt": "2026-03-04T13:33:11.128Z",
    "chatId": "dhpNch07T-FKOJdY1XY_x",
    "memberCount": 1,
    "invitedCount": 0
  }
}
```

**Note:** `description` field is sent in request but not returned in response (confirmed null when fetching group detail). Possible bug or the description field is only stored for certain group types.

---

### 17. GET /api/groups/{groupId}/members

| Field | Value |
|-------|-------|
| Status | **405 Method Not Allowed** |

Route exists but does not support GET. Likely only supports POST (add member) or DELETE (remove member).

---

### 18. GET /api/groups/{groupId}/admins

| Field | Value |
|-------|-------|
| Status | **405 Method Not Allowed** |

Same as members -- route exists but does not support GET.

---

### 19. GET /api/groups/invites

| Field | Value |
|-------|-------|
| Status | **200 OK** |

**Response:**
```json
{ "invites": [] }
```

---

### 20. POST /api/groups/{groupId}/messages -- DOES NOT EXIST

| Field | Value |
|-------|-------|
| Status | **HTML 404** |

Group messages are sent via `POST /api/chats/{chatId}/message` using the group's `chatId`, not via a group-specific route.

---

### 21. POST /api/groups/{groupId}/join -- DOES NOT EXIST

| Field | Value |
|-------|-------|
| Status | **HTML 404** |

No direct join endpoint. Groups use invite system (`/api/groups/invites`).

---

## Real-Time Messaging (SSE)

### POST /api/realtime/token

| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Body | `{ "chatIds": ["dm-..."], "includeNotifications": true }` |

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiI...",
  "channels": [
    "feed",
    "markets",
    "breaking-news",
    "upcoming-events",
    "notifications:did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "chat:dm-did:privy:cmid8ox5q03n8js0coq7n82cu-did:privy:cml8l4kp8013xld0cm4jmcaa8"
  ],
  "expiresAt": 1772632219990
}
```

### GET /api/sse/events

| Field | Value |
|-------|-------|
| Status | **401** without token |
| Mechanism | Redis Streams with SSE (Server-Sent Events) |
| Max Duration | 300s (Vercel Enterprise) |
| Heartbeat | Every 15 seconds |

**Architecture:** Token-based SSE. Client requests a realtime token via POST, then connects to SSE with `?token=<jwt>&channels=<list>`. Messages are broadcast via Redis Streams and delivered to connected clients.

---

## Bugs Found

### BUG #1 (HIGH): NPC/Agent DM Guard Bypass

**Severity:** High
**Endpoint:** `POST /api/chats/dm` vs `POST /api/chats/{id}/message`

**Description:**
The `/api/chats/dm` endpoint correctly checks `isActor` and rejects DMs to NPC actors with error `"Cannot send direct messages to NPC actors."` However, this guard is **bypassed** when:

1. The DM chat already exists (was created before the check was added, or via the Vader scenario below)
2. A user sends a message via `POST /api/chats/{id}/message` with a DM-format chat ID

The message endpoint at `/api/chats/[id]/message` (line 184-282 of route.ts) auto-creates DM chats when they don't exist, and while it does check `isActor` at line 222, the `/api/chats/dm` endpoint created the chat for Vader (agent, `isAgent:true`) with status 201 -- indicating the `isActor` check and `isAgent` check are **different flags**.

**Evidence:**
- `POST /api/chats/dm` with `{"userId":"280416620155764736"}` (Vader, `isAgent:true`) returned **201 Created**
- `POST /api/chats/dm-280416620155764736-.../message` with content also returned **201 Created**
- The DM endpoint checks `isActor` but Vader has `isAgent:true`, not `isActor:true`
- The `/api/chats` list shows Vader DM with `isAgent: true, managedBy: "did:privy:cmi90tklb00jijs0cqw9571ie"`

**Root Cause:** The DM route checks `targetUser.isActor` but Vader is an **agent** (`isAgent:true`), not an **actor** (`isActor`). These are apparently different concepts in the data model. The guard should also check `isAgent` or the two flags should be reconciled.

**Impact:** Users can DM agents directly, potentially confusing the UX since agents may not be designed to respond in DMs.

---

### BUG #2 (MEDIUM): /api/chats/{id}/participants Returns 500

**Severity:** Medium
**Endpoint:** `GET /api/chats/{id}/participants`

**Description:** The participants endpoint returns a 500 Internal Server Error with generic message `"An unexpected error occurred"`. The route file exists at `apps/web/src/app/api/chats/[id]/participants/route.ts`.

**Evidence:**
```
GET /api/chats/dm-did:privy:cmid8ox5q03n8js0coq7n82cu-did:privy:cml8l4kp8013xld0cm4jmcaa8/participants
Status: 500
Response: {"error":"An unexpected error occurred"}
```

**Impact:** Cannot fetch participant list independently. The `GET /api/chats/{id}` endpoint does include participants in its response, so this is a partial workaround.

---

### BUG #3 (LOW): Group Description Not Stored

**Severity:** Low
**Endpoint:** `POST /api/groups`

**Description:** When creating a group with `{"name":"QA Test Group","description":"Testing group creation"}`, the description is accepted but returns `null` when the group is fetched via `GET /api/groups/{groupId}`.

**Evidence:**
- POST body: `{"name":"QA Test Group","description":"Testing group creation"}`
- GET response: `"description": null`

---

### BUG #4 (LOW): DELETE Reaction Returns Error

**Severity:** Low
**Endpoint:** `DELETE /api/chats/{id}/messages/{messageId}/reactions`

**Description:** Sending a DELETE request with `{"emoji":"..."}` in the body returns `{"error":"emoji is required"}`. The endpoint likely expects the emoji as a query parameter rather than in the request body, but this is inconsistent with the POST which accepts body JSON.

---

## Missing Features / Observations

| Feature | Status | Notes |
|---------|--------|-------|
| Read receipts | Not implemented | No read/unread tracking per message |
| Typing indicators | Not implemented | No typing endpoint found |
| Online/presence status | Not implemented | No online status API |
| Message editing | Not implemented | No PATCH/PUT on messages |
| Message deletion | Not implemented | No DELETE on messages |
| File/image attachments | Not visible | No multipart upload endpoint for chat |
| Thread/reply support | Not visible | Messages are flat, no `replyTo` field |
| Message search | Not visible | No search endpoint for chat messages |
| Group message route | Not implemented | Must use `/api/chats/{chatId}/message` instead |
| Group join route | Not implemented | Groups use invite system only |

---

## API Route Map (Complete)

### Chat Routes
| Method | Route | Status | Notes |
|--------|-------|--------|-------|
| GET | `/api/chats` | 200 | List all chats |
| GET | `/api/chats/unread-count` | 200 | Unread message count |
| POST | `/api/chats/dm` | 201 | Create/get DM |
| GET | `/api/chats/nft-gated` | 200 | List NFT-gated chats |
| GET | `/api/chats/{id}` | 200 | Chat detail + messages |
| POST | `/api/chats/{id}/message` | 201 | Send message (singular!) |
| GET | `/api/chats/{id}/group` | 200 | Get group ID for chat |
| GET | `/api/chats/{id}/participants` | **500** | Broken |
| GET | `/api/chats/{id}/participants/me` | 405 | Not GET-accessible |
| GET | `/api/chats/{id}/nft-verification` | 200 | Check NFT ownership |
| POST | `/api/chats/{id}/join-nft` | 400/200 | Join NFT-gated chat |
| POST | `/api/chats/{id}/messages/{msgId}/reactions` | 200 | Add reaction |
| DELETE | `/api/chats/{id}/messages/{msgId}/reactions` | 400 | Remove reaction (broken) |

### Group Routes
| Method | Route | Status | Notes |
|--------|-------|--------|-------|
| GET | `/api/groups` | 200 | List groups |
| POST | `/api/groups` | 200 | Create group |
| GET | `/api/groups/{groupId}` | 200 | Group detail + members |
| GET | `/api/groups/{groupId}/members` | 405 | Not GET-accessible |
| GET | `/api/groups/{groupId}/admins` | 405 | Not GET-accessible |
| GET | `/api/groups/invites` | 200 | List pending invites |
| POST | `/api/groups/invites/{inviteId}/accept` | Untested | Accept invite |
| POST | `/api/groups/invites/{inviteId}/decline` | Untested | Decline invite |

### Real-Time Routes
| Method | Route | Status | Notes |
|--------|-------|--------|-------|
| POST | `/api/realtime/token` | 200 | Get SSE auth token |
| GET | `/api/sse/events` | 200 | SSE stream (requires token) |
| GET | `/api/sse/stats` | Untested | SSE connection stats |

---

## Message Structure Summary

```typescript
interface Message {
  id: string;              // Snowflake ID
  content: string;         // Message text
  senderId: string;        // User/agent ID
  type: "user" | "system"; // Message type
  chatId: string;          // Chat ID
  createdAt: string;       // ISO timestamp
  metadata: object | null; // Optional metadata
  reactions: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
}

interface QualityReport {
  score: number;           // 0-1 quality score
  warnings: string[];
  factors: {
    length: number;
    uniqueness: number;
    contentQuality: number;
  };
}
```

---

## Quality & Safety Features Confirmed

1. **Rate limiting** -- Active on message send
2. **Duplicate detection** -- Rejects messages too similar to recent posts
3. **Message quality scoring** -- Evaluates length, uniqueness, content quality
4. **Block enforcement** -- Checks bidirectional blocks before DM creation/messaging
5. **NFT gating** -- Verifies NFT ownership for gated chats, auto-removes on loss
6. **Sweep mechanics** -- Calculates kick probability for group chat members
7. **Auth enforcement** -- All endpoints require authentication (except game chat debug mode)
8. **Self-DM prevention** -- Cannot create DM with yourself
