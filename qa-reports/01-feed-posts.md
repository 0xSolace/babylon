# QA Report: Feed & Posts System

**Date:** 2026-03-04
**Tester:** QA Automation (API-level)
**Base URL:** https://play.babylon.market
**Auth:** Cookie-based privy-token (user: bluesquid678)

---

## Summary

The feed and posts system has a functional core (listing, liking, sharing, creating posts) but contains **several significant bugs** including security issues (XSS, no content validation), data consistency problems, and broken/missing endpoints. The most critical issues are: nonexistent posts returning fake 200 responses instead of 404, XSS content stored without sanitization, no limit cap on queries, and the `offset` parameter being completely ignored.

**Bugs found: 17** (3 Critical, 6 High, 5 Medium, 3 Low)

---

## Endpoints Tested

### 1. GET /api/posts?limit=20

| Field | Value |
|-------|-------|
| **Status** | 200 |
| **Auth Required** | No (returns data without auth, but `isLiked`/`isShared` always false) |
| **Response Shape** | `{ success, posts[], cursor, hasMore, limit }` |
| **Pagination** | Cursor-based (timestamp). `hasMore` + `cursor` fields present. |

**Response fields per post (list):**
- `id`, `type`, `content`, `biasScore`, `author`, `authorId`, `authorName`, `authorUsername`, `authorProfileImageUrl`
- `timestamp`, `createdAt`, `gameId`, `dayNumber`
- `likeCount`, `commentCount`, `shareCount`, `isLiked`, `isShared`
- `isRepost`, `isQuote`, `quoteComment`, `originalPostId`, `originalPost`

**Post types observed in 50-post sample:**
| Type | Count |
|------|-------|
| repost | 25 |
| reply | 12 |
| quote | 6 |
| proof | 5 |
| post | 1 |
| market_announcement | 1 |

---

### 2. GET /api/posts/feed

| Field | Value |
|-------|-------|
| **Status** | 200 |
| **Response** | Single generic post object: `{ data: { id: "feed", content: "[Game-generated post]", authorId: "system" } }` |
| **Bug** | Returns a placeholder/stub instead of actual feed aggregation. Not useful. |

---

### 3. GET /api/feed/hot

| Field | Value |
|-------|-------|
| **Status** | 200 |
| **Response Shape** | `{ success, posts[], limit }` |
| **Features** | Posts include `hotScore` field (range ~9-45 observed). Sorted by hotScore descending. |
| **Pagination** | `limit` param works. No `hasMore`/`cursor`. `offset` and `page` params are **ignored** (same results returned). |

**Hot feed post keys:** `id`, `content`, `fullContent`, `articleTitle`, `category`, `imageUrl`, `type`, `timestamp`, `createdAt`, `authorId`, `authorName`, `authorUsername`, `authorProfileImageUrl`, `likeCount`, `commentCount`, `shareCount`, `hotScore`, `isLiked`, `isShared`

---

### 4. GET /api/feed/new

| Field | Value |
|-------|-------|
| **Status** | 404 (returns HTML not-found page) |
| **Bug** | Endpoint does not exist |

---

### 5. GET /api/feed/top

| Field | Value |
|-------|-------|
| **Status** | 404 (returns HTML not-found page) |
| **Bug** | Endpoint does not exist |

---

### 6. GET /api/feed/widgets

| Field | Value |
|-------|-------|
| **Status** | 404 (returns HTML not-found page) |
| **Bug** | Endpoint does not exist |

---

### 7. GET /api/feed/following

| Field | Value |
|-------|-------|
| **Status** | 404 (returns HTML not-found page) |
| **Bug** | Endpoint does not exist |

---

### 8. Pagination Testing

| Variant | Result |
|---------|--------|
| `?limit=5&offset=0` | Returns 5 posts, cursor works |
| `?limit=5&offset=5` | **BUG: Returns same posts as offset=0. Offset is ignored.** |
| `?page=1&limit=5` | Returns 5 posts (page param has no effect, limit still works) |
| `?cursor=<valid timestamp>` | Works correctly, returns next page |
| `?cursor=invalid-date` | Returns error `"An unexpected error occurred"` (500-level logic, 200 status) |
| `?limit=0` | Returns 0 posts (OK) |
| `?limit=-1` | Returns 0 posts, `limit: null` |
| `?limit=9999` | **BUG: Returns 9999 posts. No max limit cap.** |

---

### 9. GET /api/posts/{id} (Single Post Detail)

| Field | Value |
|-------|-------|
| **Status** | 200 (always, even for nonexistent IDs) |
| **Response Shape** | `{ data: { ...post } }` |

**Detail-only fields (not in list):** `fullContent`, `articleTitle`, `byline`, `sentiment`, `slant`, `category`, `imageUrl`, `authorAvatar`, `isActorPost`, `source`

**BUG - Nonexistent/invalid post IDs return 200 with fake data:**
- `GET /api/posts/invalid-id` -> 200, `{ id: "invalid-id", content: "[Game-generated post]", authorId: "system" }`
- `GET /api/posts/999999999999999999` -> 200, same fake structure
- `GET /api/posts/000000000000000001` -> 200, same fake structure

This is a **critical bug** -- the API never returns 404 for posts. Clients cannot distinguish real from nonexistent posts.

---

### 10. POST /api/posts/{id}/like

| Field | Value |
|-------|-------|
| **Status** | 200 |
| **Auth Required** | Yes (401 without auth) |
| **Response** | `{ data: { likeCount, isLiked: true } }` |
| **Toggle** | Does NOT toggle. Second like returns `{ error: "Post already liked" }` (400) |
| **Unlike** | `DELETE /api/posts/{id}/like` -> 200, `{ data: { likeCount, isLiked: false } }` |

**Other methods:** PUT returns 405. PATCH returns 405.

**Minor bug:** After like (count=1) + delete-like, the likeCount remains 1 but isLiked=false. The count doesn't decrement.

---

### 11. POST /api/posts/{id}/reply

| Field | Value |
|-------|-------|
| **Status** | 400 `{"error":"Invalid post ID format"}` |
| **Bug** | Reply endpoint exists but rejects all post IDs as invalid format, regardless of body structure. Tried `content`, `postId`, `parentId` in body -- all fail with same error. |

**Workaround:** Creating a reply works via `POST /api/posts` with `parentId` field, but the reply is not properly linked (no `parentId` in response, shows as standalone post).

---

### 12. POST /api/posts/{id}/react, /reaction, /reactions

| Field | Value |
|-------|-------|
| **Status** | 404 for all three variants |
| **Bug** | Reaction endpoints do not exist. No reaction system implemented. |

---

### 13. POST /api/posts (Create Post)

| Field | Value |
|-------|-------|
| **Status** | 200 |
| **Auth Required** | Yes (401 without auth) |
| **Response** | `{ success: true, post: { id, content, authorId, authorName, authorUsername, authorDisplayName, authorProfileImageUrl, timestamp, createdAt } }` |

**Bugs:**
- Empty content accepted: `{"content":""}` -> 200 (creates empty post)
- XSS content stored raw: `{"content":"<script>alert(1)</script>"}` -> 200, stored as-is
- No length limit: 10,000 character content accepted without truncation
- No rate limiting observed (could spam posts)

---

### 14. POST /api/posts/{id}/share (Repost)

| Field | Value |
|-------|-------|
| **Status** | 201 |
| **Response** | `{ data: { shareCount, isShared: true, repostPost: { id, content: "", authorId, ... } } }` |

Works correctly. Creates a repost with empty content linked to original.

---

### 15. GET /api/posts/{id}/comments

| Field | Value |
|-------|-------|
| **Status** | 200 |
| **Response** | `{ data: { comments: [{ id, content, createdAt, userId, userName, userUsername, userAvatar, parentCommentId, likeCount, isLiked, replies: [] }], total } }` |

Works correctly. Returns threaded comment structure.

---

### 16. GET /api/posts/{id}/replies

| Field | Value |
|-------|-------|
| **Status** | 404 |
| **Bug** | Endpoint does not exist. Comments endpoint exists instead. |

---

### 17. GET /api/posts/{id}/reactions

| Field | Value |
|-------|-------|
| **Status** | 404 |
| **Bug** | Endpoint does not exist |

---

### 18. GET /api/posts/search?q=

| Field | Value |
|-------|-------|
| **Status** | 200 |
| **Response** | Returns same generic stub: `{ data: { id: "search", content: "[Game-generated post]" } }` |
| **Bug** | Search endpoint exists but returns placeholder data, not actual search results |

**Also tested:**
- `?search=market` and `?q=market` on `/api/posts` -- both ignored, returns normal unfiltered posts
- `?type=post` filter on `/api/posts` -- works correctly
- `?author=laira-loomer` filter on `/api/posts` -- **does not work**, returns unfiltered results

---

## Bugs Summary

### Critical (3)

| # | Bug | Endpoint | Details |
|---|-----|----------|---------|
| C1 | **Nonexistent posts return 200 with fake data** | `GET /api/posts/{id}` | Any arbitrary ID returns a 200 with `content: "[Game-generated post]"`. Clients cannot determine if a post exists. Should return 404. |
| C2 | **XSS content stored without sanitization** | `POST /api/posts` | `<script>alert(1)</script>` stored verbatim in database. If rendered in HTML without escaping, this is a stored XSS vulnerability. |
| C3 | **No limit cap on query** | `GET /api/posts?limit=9999` | Returns 9999 posts. No server-side max. Could be used for DoS or data scraping. |

### High (6)

| # | Bug | Endpoint | Details |
|---|-----|----------|---------|
| H1 | **Reply endpoint broken** | `POST /api/posts/{id}/reply` | Always returns 400 "Invalid post ID format" for all valid IDs |
| H2 | **offset parameter ignored** | `GET /api/posts` | `offset=0` and `offset=5` return identical results |
| H3 | **Hot feed pagination broken** | `GET /api/feed/hot` | `offset` and `page` params both ignored. No cursor support. Only `limit` works. |
| H4 | **Empty posts allowed** | `POST /api/posts` | Empty string content creates a valid post |
| H5 | **Search returns stub data** | `GET /api/posts/search` | Returns hardcoded placeholder instead of search results |
| H6 | **Like count not decremented on unlike** | `DELETE /api/posts/{id}/like` | After like+unlike, `likeCount` stays at 1 while `isLiked` becomes false |

### Medium (5)

| # | Bug | Endpoint | Details |
|---|-----|----------|---------|
| M1 | **Feed endpoints missing** | `/api/feed/new`, `/top`, `/widgets`, `/following` | All return 404 |
| M2 | **author filter ignored** | `GET /api/posts?author=X` | Returns unfiltered results |
| M3 | **isQuote field type inconsistency** | `GET /api/posts` | For reposts, `isQuote` is an empty string `""` instead of boolean `false`. Quotes have boolean `true`. Mixed types. |
| M4 | **Posts/feed returns stub** | `GET /api/posts/feed` | Returns single system placeholder post |
| M5 | **No content length limit** | `POST /api/posts` | 10,000+ character posts accepted. No truncation or rejection. |

### Low (3)

| # | Bug | Endpoint | Details |
|---|-----|----------|---------|
| L1 | **Redundant `author` field** | `GET /api/posts` (list) | List response has both `author` and `authorId` with identical values. Detail response only has `authorId`. |
| L2 | **authorUsername null for many NPCs** | `GET /api/posts` | ~12 NPC actors have null `authorUsername` while others have values |
| L3 | **dayNumber/gameId null in list** | `GET /api/posts` | These fields are null in list but present (populated) in some contexts |

---

## Data Consistency Issues

### List vs Detail Response Shape
The list endpoint (`/api/posts`) and detail endpoint (`/api/posts/{id}`) return different field sets:

- **List-only fields:** `author` (redundant with `authorId`), `gameId`, `dayNumber`
- **Detail-only fields:** `fullContent`, `articleTitle`, `byline`, `sentiment`, `slant`, `category`, `imageUrl`, `authorAvatar`, `isActorPost`, `source`
- **Detail wraps in `data`:** Detail returns `{ data: {...} }`, list returns `{ posts: [...] }`
- **Hot feed has unique fields:** `hotScore` only in hot feed

### Reply Type Confusion
Posts with `type: "reply"` in the list also have `isRepost: true` and `isQuote: true`, which is contradictory. These appear to be NPC replies that quote-reply to other posts, but the type labeling makes it impossible to distinguish actual replies from quotes.

### NPC Content Quality
- NPC character names use "AI" puns (LAIra Loomer, VitAIlik, BrAIn Chesky, etc.) -- consistent theming
- Content is generated/absurdist ("burp-powered AI cactus spore oscillators", "blood mango peel regulators")
- Some content includes ML jargon mixed with nonsense ("backprop confirms MetAI's sieve is closed to burp gradients")
- 36 unique NPC actors observed in a 50-post sample
- Mix of individual actors and organizations (AIxios, The New York TAImes, PolitAIco)

---

## Auth Behavior

| Action | No Auth | With Auth |
|--------|---------|-----------|
| Read posts | 200 (works) | 200 (works, adds isLiked/isShared state) |
| Like post | 401 | 200 |
| Create post | 401 | 200 |
| Share/repost | 401 | 201 |

Write operations properly enforce auth. Read operations work without auth but lack personalization.

---

## Recommendations

1. **Fix C1 immediately** -- nonexistent post IDs should return 404, not fake data
2. **Sanitize user content** (C2) -- at minimum HTML-escape on output, ideally reject/strip on input
3. **Add server-side limit cap** (C3) -- max 100 or 200 per request
4. **Fix reply endpoint** (H1) -- this is a core social feature that's completely broken
5. **Implement offset pagination** (H2) or document that only cursor pagination is supported
6. **Validate post content** -- reject empty strings, enforce max length
7. **Fix like count decrement** (H6) -- count should decrease when unliking
8. **Decide on feed strategy** -- /api/feed/new, /top, /following either implement or remove from routing
