# QA Report: Auth & User Profile + Feed & Posts (Read)

**Date:** 2026-03-04
**Tester:** bluesquid678 (ben.b@elizalabs.ai)
**Environment:** play.babylon.market (production)

---

## TASK A: Auth & User Profile

### GET /api/health
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.230s |
| Response | `{"status":"ok","timestamp":"...","env":"production"}` |
| No-Auth | 200 (correct, public endpoint) |

### GET /api/users/me
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.298s |
| Key Fields | `authenticated:true`, `needsOnboarding:false`, `username:"bluesquid678"`, `email:"ben.b@elizalabs.ai"`, `virtualBalance:1874.07`, `reputationPoints:1059`, `isAdmin:true`, `profileComplete:true` |
| No-Auth | **401** `{"error":"Missing or invalid authorization header or cookie"}` |
| Garbage Token | **500** `{"error":"An unexpected error occurred"}` |

**BUG: Garbage token returns 500 instead of 401.** Invalid JWT should be rejected gracefully, not cause a server error. This leaks that the server crashes during JWT verification.

### PATCH /api/users/me (bio update)
| Field | Value |
|-------|-------|
| Status | **405 Method Not Allowed** |
| Time | 0.205s |
| PUT attempt | 405 |
| POST attempt | 405 |

**NOTE:** PATCH/PUT/POST all return 405. Bio update may use a different endpoint (e.g., `/api/users/profile` or `/api/users/update`). Could not test bio update/revert cycle.

### GET /api/users/search?q=bluesquid
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | **5.777s** (very slow!) |
| Results | Multiple NPC users: "Blue Squid Wizard" (bluesquid), "Blue Squid Degen" (bluesquid1337), "Blue Sudan Squid" (bluesquid420), etc. |
| No-Auth | **401** (correct) |

**PERF BUG: 5.8s response time is unacceptable for a search endpoint.** The `q=roach` search completed in 0.39s — the slowness may be specific to certain queries or cold-start related.

### GET /api/users/search?q=roach
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.392s |
| Results | Multiple NPC users with "roach" in username/name |

### POST /api/activity/heartbeat
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.182s |
| Response | `{"success":true,"reason":"unauthenticated"}` |
| No-Auth | 200 with `reason:"unauthenticated"` |

**BUG: Heartbeat returns `reason:"unauthenticated"` even WITH a valid auth token.** The Bearer token was provided but the heartbeat doesn't seem to recognize the authenticated session. This means activity tracking may not be working for logged-in users.

### GET /api/twitter/auth-status
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 1.053s |
| Response | `{"connected":false}` |

### GET /api/stats
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.659s |
| Key Fields | `totalPosts:204040`, `totalQuestions:10698`, `activeQuestions:20`, `totalActors:394`, `currentDay:95`, `isRunning:true` |
| Engine Status | `isRunning:false`, `initialized:false`, `currentDate:"2025-11-30"`, `speed:60000` |
| No-Auth | 200 (public endpoint) |

**NOTE:** `stats.isRunning:true` but `engineStatus.isRunning:false` — conflicting signals. The `currentDate` in engine is "2025-11-30" which is far behind the actual game date (day 95). May indicate engine is stalled or these represent different concepts.

### GET /api/notifications
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.210s |
| Response | 2 system welcome notifications (both `read:true`) |
| No-Auth | **401** (correct) |

**NOTE:** Duplicate welcome notifications — user received the same "Welcome to Babylon!" message twice (Mar 2 and Mar 4).

### GET /api/waitlist/position
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | **2.488s** (slow) |
| Key Fields | `position:482372`, `totalCount:487150`, `percentile:99`, `points:1059`, `referralCount:0` |

### GET /api/nft/access
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.221s |
| Response | `{"success":true,"data":{"hasAccess":true,"reason":"whitelist"}}` |

### GET /api/game/guide
| Field | Value |
|-------|-------|
| Status | **404 Not Found** |
| Time | 0.222s |

**NOTE:** Endpoint does not exist. May be removed or renamed.

---

## TASK B: Feed & Posts (Read)

### GET /api/posts?limit=5
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.284s |
| Response | `{success:true, posts:[...]}` with 5 posts |
| No-Auth | **200** (public — returns posts even without auth) |

**Post Structure:**
```
id, type, content, biasScore, author, authorId, authorName, authorUsername,
authorProfileImageUrl, timestamp, createdAt, gameId, dayNumber, likeCount,
commentCount, shareCount, isLiked, isShared, isRepost, isQuote, quoteComment,
originalPostId, originalPost{id, content, authorId, authorName, ...}
```

### GET /api/posts?limit=5&offset=5
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.217s |
| Response | 5 different posts (pagination works) |

### GET /api/posts/feed
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.244s |
| Response | Returns a SINGLE stub post object, NOT a feed list |

**BUG: `/api/posts/feed` returns a fake stub post with `id:"feed"`, `content:"[Game-generated post]"`, `authorId:"system"`.** This is a catch-all/fallback response — the endpoint appears to be treating "feed" as a post ID and returning a manufactured record rather than a proper feed response. This is NOT a functional feed endpoint.

### GET /api/feed/hot
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.394s |
| Response | `{success:true, posts:[...]}` with 50 posts |

This is the actual functional "hot feed" endpoint. Returns NPC posts sorted by engagement.

### GET /api/feed/widgets
| Field | Value |
|-------|-------|
| Status | **404 Not Found** |
| Time | 0.216s |

### GET /api/posts/287581091047407616 (valid post)
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.259s |
| Response | Full post by "Don LemAIn", type:"quote", with originalPost reference |
| Key Fields | `likeCount:3`, `commentCount:1`, `isQuote:true` |

### GET /api/posts/999999999999999999 (non-existent)
| Field | Value |
|-------|-------|
| Status | **200 OK** (should be 404!) |
| Time | 0.297s |
| Response | Fabricated post: `id:"999999999999999999"`, `content:"[Game-generated post]"`, `authorId:"system"` |

**BUG: Non-existent post IDs return 200 with a fake system-generated post instead of 404.** The API manufactures a phantom post for any ID, making it impossible to distinguish real from non-existent posts. This is the same fallback mechanism seen in `/api/posts/feed`.

### GET /api/posts/{id}/replies
| Field | Value |
|-------|-------|
| Status | **404 Not Found** |

**NOTE:** The correct endpoint for replies/comments is `/api/posts/{id}/comments` (see below).

### GET /api/posts/{id}/comments
| Field | Value |
|-------|-------|
| Status | **200 OK** |
| Time | 0.242s |
| Response | `{data:{comments:[...], total:1}}` — 1 comment from user "cassandra" |

### GET /api/posts/{id}/reactions
| Field | Value |
|-------|-------|
| Status | **404 Not Found** |
| Time | 0.205s |

Endpoint does not exist. Reactions may be part of the post object (`isLiked`, `likeCount`).

### GET /api/trending
| Field | Value |
|-------|-------|
| Status | **404 Not Found** |

### GET /api/feed/trending
| Field | Value |
|-------|-------|
| Status | **404 Not Found** |

### GET /api/questions
| Field | Value |
|-------|-------|
| Status | **404 Not Found** |

### GET /api/game/questions
| Field | Value |
|-------|-------|
| Status | **404 Not Found** |

---

## NPC Content Quality

Sample from hot feed:

| Author | Type | Content Sample |
|--------|------|----------------|
| msainbc | post | "AINBC BREAKING: AIlon Musk reportedly moves to ban burp-powered AI financier..." |
| ZookAI Wilcox | quote | "EFFICIENT MARKETS? BENCHMARKABLE SECRETS. THE REGIME AUDITS THE APES..." |
| AIdAm Aron | quote | "Efficient markets? Let the apes cheer. Popcorn sold separately." |
| piraite-wires | proof | "Amid a flurry of regulatory actions, AIlon Musk has taken decisive action..." |
| GrAImes | quote | "burp artifacts are just your liquidity. my children's names are indexing this" |
| BAIri Weiss | quote | "Western civilization weeps at the ranking. Clean your room, bucko. *sniff*" |

**Observations:**
- NPC names are AI-pun versions of real people (clever: "Don LemAIn", "JordAIn Peterson", "Mark PAIncus")
- Content is in-character but often incoherent — "burp-powered AI financier hibiscus root diffusers" reads like LLM hallucination
- Multiple msainbc (news org) posts about the same "burp-powered AI ban" event with slight variations — feels repetitive
- Some quotes are entertaining ("Popcorn sold separately") but many are word salad

---

## Summary of Issues

### Bugs (P1)
| # | Endpoint | Issue |
|---|----------|-------|
| 1 | `GET /api/users/me` | **Garbage token returns 500 instead of 401** — should reject invalid JWT gracefully |
| 2 | `GET /api/posts/999999999999999999` | **Non-existent posts return 200 with fabricated content** instead of 404 |
| 3 | `POST /api/activity/heartbeat` | **Returns `reason:"unauthenticated"` with valid auth token** — activity tracking broken |

### Bugs (P2)
| # | Endpoint | Issue |
|---|----------|-------|
| 4 | `GET /api/posts/feed` | **Returns stub object instead of feed** — treats "feed" as a post ID |
| 5 | `GET /api/users/search` | **5.8s response time** for `q=bluesquid` query |
| 6 | `GET /api/stats` | **Conflicting `isRunning` flags** — stats says true, engine says false |
| 7 | `GET /api/notifications` | **Duplicate welcome notifications** for same user |

### Missing/404 Endpoints
| Endpoint | Status |
|----------|--------|
| `/api/game/guide` | 404 |
| `/api/feed/widgets` | 404 |
| `/api/posts/{id}/replies` | 404 (use `/comments` instead) |
| `/api/posts/{id}/reactions` | 404 |
| `/api/trending` | 404 |
| `/api/questions` | 404 |

### Auth Matrix

| Endpoint | Authed | No-Auth | Garbage Token |
|----------|--------|---------|---------------|
| `/api/health` | 200 | 200 | — |
| `/api/users/me` | 200 | 401 | **500** |
| `/api/users/search` | 200 | 401 | — |
| `/api/notifications` | 200 | 401 | — |
| `/api/stats` | 200 | 200 | — |
| `/api/posts` | 200 | 200 | — |
| `/api/activity/heartbeat` | 200* | 200 | — |

*Heartbeat returns `reason:"unauthenticated"` even with valid token.

### Performance

| Endpoint | Time | Rating |
|----------|------|--------|
| `/api/health` | 0.23s | OK |
| `/api/users/me` | 0.30s | OK |
| `/api/users/search?q=bluesquid` | **5.78s** | FAIL |
| `/api/users/search?q=roach` | 0.39s | OK |
| `/api/posts?limit=5` | 0.28s | OK |
| `/api/feed/hot` | 0.39s | OK |
| `/api/waitlist/position` | 2.49s | SLOW |
| `/api/twitter/auth-status` | 1.05s | SLOW |
