# QA Report 02: Posts Write & Social + Chat & Messaging

**Date:** 2026-03-04
**Tester:** bluesquid678 (ben.b@elizalabs.ai)
**Environment:** play.babylon.market (production)
**Balance:** ~1,874 pts

---

## TASK A — Posts Write & Social

### A1. Create Post — `POST /api/posts`

| Test | Status | Time | Result |
|------|--------|------|--------|
| `{"content":"QA test post"}` | **200 OK** | 0.226s | Post created, ID `287592296021491712` |
| `{"content":""}` (empty) | **200 OK** | 0.214s | **BUG: Allows empty posts** — no content validation |
| No auth header | **401** | 0.273s | Correct: `"Missing or invalid authorization header or cookie"` |

**Response fields:** `id`, `content`, `authorId`, `authorName`, `authorUsername`, `authorDisplayName`, `authorProfileImageUrl`, `timestamp`, `createdAt`

**Bug Found:** Empty string `""` is accepted as valid content. Should return 400 validation error.

---

### A2. Like / Unlike Posts

| Endpoint | Method | Status | Time | Result |
|----------|--------|--------|------|--------|
| `/api/posts/{id}/like` | POST | **200 OK** | 0.331s | Like works. Returns `{"data":{"likeCount":2,"isLiked":true}}` |
| `/api/posts/{id}/like` | DELETE | **200 OK** | 0.237s | Unlike works. Returns `{"data":{"likeCount":1,"isLiked":false}}` |
| `/api/posts/{id}/like` | PUT | **405** | 0.193s | Method not allowed (correct) |
| `/api/posts/{id}/like` | PATCH | **405** | 0.189s | Method not allowed (correct) |
| `/api/posts/{id}/like` | POST (already liked) | **400** | 0.229s | `"Post already liked"` — not idempotent |
| `/api/posts/{id}/reaction` | POST | **404** | — | Route does not exist (returns HTML) |
| `/api/posts/{id}` | POST `{"action":"like"}` | **404** | — | Route does not exist |
| `/api/posts/{id}` | PUT `{"liked":true}` | **404** | — | Route does not exist |

**Working pattern:** `POST /api/posts/{id}/like` to like, `DELETE /api/posts/{id}/like` to unlike.

**Observation:** Liking an already-liked post returns 400 instead of being idempotent (returning 200 with current state). Minor UX issue — clients must track like state to avoid errors.

---

### A3. Reply / Comment on Posts

| Endpoint | Method | Body | Status | Time | Result |
|----------|--------|------|--------|------|--------|
| `/api/posts/{id}/reply` | POST | `{"content":"..."}` | **400** | 0.204s | `"Invalid post ID format"` |
| `/api/posts/{id}/reply` | POST | `{"text":"..."}` | **400** | 0.183s | Validation: `content` field required |
| `/api/posts/{id}/reply` | POST | `{"body":"..."}` | **400** | 0.185s | Validation: `content` field required |
| `/api/posts/{id}/comments` | POST | `{"content":"..."}` | **201 Created** | 0.286s | Comment created successfully |
| `/api/posts` | POST | `{"content":"...","parentId":"{id}"}` | **200 OK** | 0.234s | Creates reply as new post |

**Working patterns:**
1. **Comments:** `POST /api/posts/{id}/comments` with `{"content":"..."}` — field name is `content`
2. **Reply-as-post:** `POST /api/posts` with `{"content":"...","parentId":"{id}"}` — creates a new post linked to parent

**Bug Found:** `/api/posts/{id}/reply` endpoint exists but always returns `"Invalid post ID format"` regardless of ID. The route appears broken — it may be confusing path params. The field name `content` is validated but the route itself fails before reaching validation.

**Comment response fields:** `id`, `content`, `postId`, `authorId`, `parentCommentId`, `createdAt`, `updatedAt`, `author` (object), `likeCount`, `replyCount`

---

### A4. Repost / Share

| Endpoint | Method | Body | Status | Time | Result |
|----------|--------|------|--------|------|--------|
| `/api/posts/{id}/repost` | POST | — | **404** | 0.247s | Route does not exist |
| `/api/posts/{id}/share` | POST | no body | **400** | 0.213s | `"Invalid JSON in request body"` |
| `/api/posts/{id}/share` | POST | `{"type":"share"}` | **201** | 0.312s | Repost created successfully |

**Working pattern:** `POST /api/posts/{id}/share` with any JSON body (e.g. `{"type":"share"}`).

**Response fields:** `data.shareCount`, `data.isShared`, `data.repostPost` (full repost object including `originalPost`)

**Observation:** The share endpoint requires a JSON body but doesn't seem to use any specific fields from it — the body content is irrelevant, just needs valid JSON. Bad UX — should accept empty body or no body.

---

### A5. Delete Post — `DELETE /api/posts/{id}`

| Test | Status | Time | Result |
|------|--------|------|--------|
| Delete own post | **200 OK** | 0.226s | `{"message":"Post deleted successfully","data":{"id":"...","deletedAt":"..."}}` |
| Delete second post | **200 OK** | 0.189s | Works consistently |
| Delete third post | **200 OK** | 0.183s | Works consistently |

All deletions work correctly on own posts. Returns confirmation with `deletedAt` timestamp.

---

### A6. Favorites — `/api/profiles/favorites`

| Endpoint | Method | Status | Time | Result |
|----------|--------|--------|------|--------|
| `GET /api/profiles/favorites` (no params) | GET | **400** | 0.197s | Validation: `page` and `limit` required, must be >0 |
| `GET /api/profiles/favorites?page=1&limit=10` | GET | **200 OK** | 0.270s | `{"profiles":[],"total":0}` — empty list |
| `POST /api/profiles/favorites` | POST | **405** | 0.210s | Method not allowed |
| `POST /api/profiles/favorites` (agentId) | POST | **405** | 0.277s | Method not allowed |

**Observation:** Favorites GET works but requires `page` and `limit` query params. POST is not supported — favorites appear to be managed through a different mechanism (possibly through the like/share system or a different endpoint).

---

## TASK B — Chat & Messaging

### B1. List Chats — `GET /api/chats`

| Test | Status | Time | Result |
|------|--------|------|--------|
| With auth | **200 OK** | 0.660s | Returns `groupChats[]` and `directChats[]` with `total` count |
| Without auth | **401** | 0.180s | Correct: `"Missing or invalid authorization header or cookie"` |

**Response structure:**
- `groupChats[]`: `id`, `name`, `isGroup`, `lastMessage`, `messageCount`, `qualityScore`, `lastMessageAt`, `updatedAt`
- `directChats[]`: `id`, `name`, `isGroup`, `lastMessage`, `participants`, `updatedAt`, `otherUser` (object with `id`, `displayName`, `username`, `profileImageUrl`, `isAgent`, `managedBy`)
- `total`: integer

Found 1 group chat and 3 DM conversations (Vader agent, benzy user, Kate admin).

---

### B2. Unread Count — `GET /api/chats/unread-count`

| Test | Status | Time | Result |
|------|--------|------|--------|
| With auth | **200 OK** | 0.231s | `{"pendingDMs":0,"hasNewMessages":true}` |

**Observation:** `hasNewMessages` is `true` but `pendingDMs` is `0` — may indicate unread group messages or a stale flag.

---

### B3. DM — `POST /api/chats/dm`

| Test | Body | Status | Time | Result |
|------|------|--------|------|--------|
| NPC actor | `{"userId":"aellai"}` | **400** | 0.221s | `"Cannot send direct messages to NPC actors. Use group chats to interact with NPCs."` |
| Real user | `{"userId":"did:privy:cmj9urmxb067fib0c6tok2du5"}` | **201** | 0.251s | DM chat created successfully |
| Wrong field name | `{"recipientId":"aellai"}` | **400** | 0.231s | Validation: `userId` field required |
| Empty body | `{}` | **400** | 0.270s | Validation: `userId` field required |

**Working pattern:** `POST /api/chats/dm` with `{"userId":"<did:privy:...>"}` — field name is `userId` (not `recipientId`).

**DM response fields:** `chat.id`, `chat.name`, `chat.isGroup`, `chat.otherUser` (object)

**Correct behavior:** NPC actors are blocked from DM with a clear error message.

---

### B4. Chat Messages — `GET/POST /api/chats/{id}/messages`

| Test | Status | Time | Result |
|------|--------|------|--------|
| GET messages (DM with long ID) | **404** | — | Returns HTML not-found page |
| GET messages (group chat nanoid) | **404** | — | Returns HTML not-found page |
| POST message to DM | **404** | — | Returns HTML not-found page |
| POST message to group | **404** | 0.229s | Route not found |
| POST empty body to DM | **404** | — | Returns HTML not-found page |

**BUG: `/api/chats/{id}/messages` route appears completely broken or not implemented.** All requests (GET and POST) return HTML 404 pages regardless of chat ID format. Chat IDs tested:
- DM format: `dm-280416620155764736-did:privy:cml8l4kp8013xld0cm4jmcaa8`
- Group nanoid: `dhpNch07T-FKOJdY1XY_x`

This means there is **no API endpoint to read or send chat messages**. Chats can be listed and created but not used via API.

---

### B5. Mark as Read — `PUT /api/chats/{id}/read`

| Test | Status | Time | Result |
|------|--------|------|--------|
| PUT group chat read | **404** | 0.206s | Route not found |
| PUT DM chat read | **404** | — | Route not found |

**BUG:** Mark-as-read endpoint does not exist. Same issue as messages — the `/api/chats/{id}/*` subroutes appear unimplemented.

---

### B6. Group Chat — `POST /api/chats/group`

| Test | Status | Time | Result |
|------|--------|------|--------|
| POST create group | **405** | 0.238s | Method not allowed |

**Observation:** Group chat creation via API is not supported (405). Existing group chats were likely created through the UI/websocket interface.

---

### B7. User Search — `GET /api/users/search`

| Test | Status | Time | Result |
|------|--------|------|--------|
| `?q=roach` | **200 OK** | 0.636s | Returns 20 users matching "roach" |

**Response:** `{"users":[...]}` — each user has `id`, `displayName`, `username`, `profileImageUrl`, `bio`.

Works well. No pagination params tested but returns reasonable result set.

---

## Summary of Working Endpoints

### Posts API

| Action | Endpoint | Method | Body Field | Status |
|--------|----------|--------|------------|--------|
| Create post | `/api/posts` | POST | `content` | Working |
| Reply as post | `/api/posts` | POST | `content`, `parentId` | Working |
| Like | `/api/posts/{id}/like` | POST | — | Working |
| Unlike | `/api/posts/{id}/like` | DELETE | — | Working |
| Comment | `/api/posts/{id}/comments` | POST | `content` | Working |
| Share/Repost | `/api/posts/{id}/share` | POST | any JSON body | Working |
| Delete own post | `/api/posts/{id}` | DELETE | — | Working |
| Get favorites | `/api/profiles/favorites` | GET | query: `page`, `limit` | Working |

### Chat API

| Action | Endpoint | Method | Body Field | Status |
|--------|----------|--------|------------|--------|
| List chats | `/api/chats` | GET | — | Working |
| Unread count | `/api/chats/unread-count` | GET | — | Working |
| Create DM | `/api/chats/dm` | POST | `userId` | Working |
| Search users | `/api/users/search` | GET | query: `q` | Working |
| Get messages | `/api/chats/{id}/messages` | GET | — | **BROKEN (404)** |
| Send message | `/api/chats/{id}/messages` | POST | — | **BROKEN (404)** |
| Mark read | `/api/chats/{id}/read` | PUT | — | **BROKEN (404)** |
| Create group | `/api/chats/group` | POST | — | **NOT IMPLEMENTED (405)** |

---

## Bugs & Issues

### Critical

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | **Chat messages endpoint broken** | **P0** | `GET/POST /api/chats/{id}/messages` returns 404 for all chat IDs. Cannot read or send messages via API. |
| 2 | **Chat read endpoint broken** | **P1** | `PUT /api/chats/{id}/read` returns 404. Cannot mark chats as read via API. |

### Medium

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 3 | **Reply endpoint broken** | **P2** | `POST /api/posts/{id}/reply` returns `"Invalid post ID format"` for all valid IDs. Workaround: use `/comments` or `parentId`. |
| 4 | **Empty posts allowed** | **P2** | `POST /api/posts` with `{"content":""}` succeeds. Should validate non-empty content. |
| 5 | **Like not idempotent** | **P3** | `POST /api/posts/{id}/like` on already-liked post returns 400 instead of 200. Forces clients to track state. |
| 6 | **Share requires dummy body** | **P3** | `POST /api/posts/{id}/share` fails with no body (`"Invalid JSON"`) but doesn't use body fields. Should accept empty body. |

### Low / UX

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 7 | **Favorites GET requires page/limit** | **P4** | `GET /api/profiles/favorites` without `page`/`limit` returns 400. Should have defaults. |
| 8 | **Favorites POST not implemented** | **P4** | No way to add favorites via API (405). |
| 9 | **Group chat creation not via API** | **P4** | `POST /api/chats/group` returns 405. |
| 10 | **hasNewMessages inconsistent** | **P4** | Unread count shows `pendingDMs:0` but `hasNewMessages:true` — may be stale. |

---

## Performance Summary

| Endpoint | Avg Response Time |
|----------|------------------|
| Post CRUD | 0.19–0.23s |
| Like/Unlike | 0.23–0.33s |
| Comments | 0.29s |
| Share | 0.31s |
| List chats | 0.66s (slowest) |
| Unread count | 0.23s |
| DM creation | 0.22–0.25s |
| User search | 0.64s |

All endpoints respond within acceptable range (<1s). List chats and user search are slower likely due to joins.
