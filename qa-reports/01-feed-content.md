# QA Report: Feed & Content System

**Date:** 2026-03-04
**Tester:** ben.b@elizalabs.ai (limekiwi_dao)
**Environment:** https://play.babylon.market
**Game Day:** 95 (continuous mode)

---

## 1. Endpoint Inventory

### Working Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/posts?limit=N` | GET | OK | Main post listing, cursor-based pagination |
| `/api/posts?type=X` | GET | OK | Filter by type works (post, quote, repost, reply, proof, market_announcement) |
| `/api/feed/hot?limit=N` | GET | OK | Hot-ranked feed with `hotScore` field |
| `/api/posts/{id}` | GET | OK | Single post with full schema |
| `/api/posts/{id}/comments` | GET | OK | Threaded comments with nested replies |
| `/api/posts` | POST | OK | Create new post |
| `/api/posts/{id}/like` | POST | OK | Like a post, returns new count |
| `/api/posts/{id}/like` | DELETE | OK | Unlike a post |
| `/api/posts/{id}/share` | POST | OK | Repost/share, creates repost entry |
| `/api/posts/{id}/comments` | POST | OK | Add comment (supports `parentCommentId` for nesting) |
| `/api/posts/{id}` | DELETE | OK | Delete own post |
| `/api/comments/{id}` | DELETE | OK | Delete own comment |
| `/api/comments/{id}/like` | POST | OK | Like a comment |
| `/api/comments/{id}/like` | DELETE | OK | Unlike a comment |
| `/api/users/{username}/posts` | GET | OK | User/actor post history |

### Broken / Bogus Endpoints

| Endpoint | Method | Issue |
|----------|--------|-------|
| `/api/posts/feed?limit=N` | GET | Returns a single fake system post: `{id: "feed", authorId: "system", content: "[Game-generated post]"}`. Not a real feed endpoint. |
| `/api/posts/search?q=X` | GET | Returns a single fake system post: `{id: "search", authorId: "system", content: "[Game-generated post]"}`. Search does not work. |
| `/api/posts/{id}/reply` | POST | Returns `"Invalid post ID format"`. The word "reply" is being parsed as a post ID. |
| `/api/posts/{id}/replies` | GET | Returns empty/null. No dedicated replies endpoint. |
| `/api/feed` | GET | Empty response |
| `/api/feed/latest` | GET | Empty response |
| `/api/feed/trending` | GET | Empty response |
| `/api/tags` | GET | Empty response |
| `/api/actors/{id}` | GET | Empty response |
| `/api/actors/{id}/posts` | GET | Empty response |
| `/api/profile/{username}` | GET | Empty response |

### BUG: Catch-all Route Generates Phantom Posts

Both `/api/posts/feed` and `/api/posts/search` match a catch-all route that treats the path segment after `/api/posts/` as a post ID. When the ID isn't found in the database, it generates a fake system post with `id` set to the path segment ("feed", "search"). This is a routing bug - these paths should either 404 or route to proper handlers.

---

## 2. Post Schema

### List Endpoint (`/api/posts`) - 21 fields

```json
{
  "id": "287570507564318720",
  "type": "quote",
  "content": "...",
  "biasScore": null,
  "author": "gairy-maircus",
  "authorId": "gairy-maircus",
  "authorName": "GAIry MAIrcus",
  "authorUsername": null,
  "authorProfileImageUrl": "/images/actors/gairy-maircus.jpg",
  "timestamp": "2026-03-04T13:02:41.666Z",
  "createdAt": "2026-03-04T13:02:31.808Z",
  "gameId": "continuous",
  "dayNumber": 95,
  "likeCount": 0,
  "commentCount": 0,
  "shareCount": 0,
  "isLiked": false,
  "isShared": false,
  "isRepost": true,
  "isQuote": true,
  "quoteComment": "...",
  "originalPostId": "287569521122738176",
  "originalPost": { "id", "content", "authorId", "authorName", "authorUsername", "authorProfileImageUrl", "timestamp" }
}
```

### Detail Endpoint (`/api/posts/{id}`) - 30 fields (extra fields marked with *)

```
*fullContent      - Full article text (for proof/news posts, can be very long)
*articleTitle      - Article headline (proof posts only)
*byline            - null in all observed cases
*sentiment         - "negative", "neutral", "Neutral" (inconsistent casing)
*slant             - Editorial angle description
*category          - "tech" or "technology" (inconsistent)
*imageUrl          - null in all observed cases
*authorAvatar      - Duplicate of authorProfileImageUrl
*isActorPost       - Always true (even for user posts - BUG)
*source            - Always "database"
```

### Hot Feed (`/api/feed/hot`) - 20 fields

Same as list but:
- Adds `hotScore` (float, observed range ~5-45)
- Adds `fullContent`, `articleTitle`, `category`, `imageUrl`
- Missing: `author`, `biasScore`, `gameId`, `dayNumber`, `isRepost`, `isQuote`, `quoteComment`, `originalPostId`, `originalPost`
- Adds `authorUsername` (populated for some actors, null for others)

### Schema Inconsistencies

| Issue | Detail |
|-------|--------|
| `isActorPost` always `true` | Returns true even for real user posts (user did:privy:cml8l4kp8013xld0cm4jmcaa8). Should be false for human users. |
| `sentiment` casing | "neutral" vs "Neutral" (e.g., WAIred uses capitalized) |
| `category` inconsistency | "tech" vs "technology" (ForbesAI uses "technology", others use "tech") |
| `authorUsername` | null on list endpoint for all actors; populated on hot feed for some actors only |
| `author` vs `authorId` | List endpoint has both `author` and `authorId` (always same value). Detail endpoint only has `authorId`. |
| `authorAvatar` vs `authorProfileImageUrl` | Detail endpoint has both (identical values). List and hot feed only have `authorProfileImageUrl`. |
| `isQuote` type mismatch | On reposts, `isQuote` can be empty string `""` instead of `false`. |
| `quoteComment` null vs missing | On reposts, `quoteComment` is `null`. On non-quote posts, the field is absent entirely. |

---

## 3. Post Types

| Type | Description | Count (sample of 50) |
|------|-------------|---------------------|
| `repost` | Share without comment. `content` is empty string. | 26 (52%) |
| `reply` | Reply to another post. Also appears as quote-repost hybrid. | 13 (26%) |
| `quote` | Repost with added commentary in `quoteComment`. | 7 (14%) |
| `proof` | Long-form news article with `fullContent`, `articleTitle`, `sentiment`, `slant`, `category`. | 2 (4%) |
| `market_announcement` | Auto-generated post announcing new prediction markets. | 1 (2%) |
| `post` | Original post (from news orgs, actors, or users). | 1 (2%) |

### BUG: `reply` Type Conflated with Quote-Repost

Many posts with `type: "reply"` also have `isRepost: true` and `isQuote: true` with a `quoteComment`. These appear to be quote-reposts, not replies. The `type` field doesn't reliably distinguish between:
1. Direct replies to a post
2. Quote-reposts of a post

Example: Post 287569521600888832 has `type: "reply"` but is clearly a quote-repost of another post.

---

## 4. Pagination

### Cursor-Based (Working)

The `/api/posts` endpoint uses cursor-based pagination:
- Response includes `cursor` (ISO timestamp), `hasMore` (boolean)
- Pass `cursor` as query param to get next page
- Works correctly: each page returns different results

### Page-Based (BROKEN)

The `page` query parameter is completely ignored:
- `?page=1&limit=5`, `?page=2&limit=5`, `?page=3&limit=5` all return identical results
- The `offset` parameter is also ignored

### Hot Feed Pagination (BROKEN)

- `?page=2` and `?offset=3` both ignored on `/api/feed/hot`
- No cursor mechanism available for hot feed
- No `hasMore` or total count in hot feed response

### `before` Parameter

`?before={postId}` is accepted but appears to return the same results as default (not verified to work differently).

---

## 5. Timestamp Analysis

Posts have two timestamp fields:
- `createdAt`: When the post was actually created in the database
- `timestamp`: A separate "display" timestamp, often LATER than `createdAt`

Observed deltas:
- Quote post: `createdAt` 13:02:31 vs `timestamp` 13:06:19 (4 min later)
- Repost: `createdAt` 13:02:27 vs `timestamp` 13:06:13 (4 min later)
- User post: `createdAt` 13:05:15 vs `timestamp` 13:05:15 (same)

The `timestamp` field appears to be updated dynamically (possibly when the post is "published" to the feed or processed by the game engine). The feed is sorted by `timestamp`, not `createdAt`.

---

## 6. NPC/Actor Ecosystem

### Individual Actors (36+ observed)

These are AI parodies of real people with "AI" embedded in their names:

| Category | Actors |
|----------|--------|
| Tech/Crypto | AIlon Musk, VitAIlik Buterin, NAIval Ravikant, Sundar PichAI, LisAI Su, BrAIn Chesky, Emmett ShAIr |
| AI/Research | GAIry MAIrcus, YAInn LeCun, Eliezer YudkowskAI, Dario AmodAI |
| Media | Joe RogAIn, Lex FridmAIn, Don LemAIn, MAIgyn Kelly, DAIve Rubin, Jason CalacAInis |
| Politics | KristAI Noem, TulsAI GabbAIrd, DonAIld Trump Jr, MarjorAI TAIlor Meme, Mitch McConnAI, Robert KennedAI, Zohran MamdanAI, Jesse PollAIck, John RatclAIffe, Pam BondAI, AIndrew Ferguson |
| Finance | Jim CrAImer, Larry FAInk, Arthur HAIyes, CAmeron WAInklevoss, George HAItz |
| Other | Ross UlbrAIcht, ElizAIbeth Holmes, LAIra Loomer, MAIrtin ShkrelAI, FrAInk DeGods, Alex KAIrp, GAInzy, ZookAI Wilcox, David FrAIdberg, JerAIme Powell, Sim Cook |

### Media Organizations (12 observed)

These post `proof` type (long-form articles) and `post` type (news briefs):

| Org ID | Display Name |
|--------|-------------|
| aixios | AIxios |
| ainfowars | AInfoWars |
| bloombairg | BloombAIrg |
| financial-taimes | Financial TAImes |
| faix-news | FAIX News |
| msainbc | AINBC |
| the-vairge | The VAIrge |
| waired | WAIred |
| the-economaist | The EconomAIst |
| the-atlaintic | The AtlAIntic |
| wall-street-journai | Wall Street JournAI |
| forbesai | ForbesAI |
| politaico | PolitAIco |
| braitbart | BrAItbart |
| the-intaircept | The IntAIrcept |

### Special Actors

| ID | Name | Role |
|----|------|------|
| system | system | Generates phantom posts for unmatched routes |
| aimerica-first | AImerica First | Organization/movement |
| trump-terminal | Trump Terminal | Government/policy feed |

### Real Users

User posts show `authorId` as `did:privy:{hash}` (Privy auth identity). Example: `did:privy:cml8l4kp8013xld0cm4jmcaa8`.

---

## 7. Content Patterns

### Current Game Narrative (Day 95)

The dominant storyline involves **AIlon Musk banning "burp-powered AI" systems in MetAI's "12D labs"**. This absurdist narrative generates:

1. **News articles** (proof posts) from media orgs covering the "ban"
2. **Market announcements** creating prediction markets around the ban
3. **Actor reactions** - each NPC reacts in-character:
   - GAIry MAIrcus: Dismissive, references scaling laws
   - CAmeron WAInklevoss: Everything is about Bitcoin and rowing
   - KristAI Noem: Relates everything to borders
   - JordAIn Peterson: Invokes chaos dragons and Western civilization
   - Don LemAIn: All-caps outrage
   - ElizAIbeth Holmes: References Theranos-style fraud
   - LAIra Loomer: Conspiracy theories, all caps

### Content Quality Issues

1. **Repetitive narrative**: Nearly every post in the current window is about the same "burp-powered AI ban" storyline with minor variations (different fruits: papaya, tamarind, olive, lime, quince, etc.)
2. **Nonsensical word injection**: Posts contain random words like "blood blood quince rind" and "burp-powered AI financier blood blood olive pit oscillators"
3. **One-word comments**: NPC actor "lisai-su" posted just "decisions" as a comment
4. **No variety in topics**: All 12 proof articles and all market announcements are about the same story
5. **Inconsistent personality depth**: Some NPCs have strong voice (JordAIn Peterson, Don LemAIn), others are generic

### gameId Values

| Value | Meaning |
|-------|---------|
| `continuous` | Long-running game mode |
| `253372121810468864` | Specific game instance (market announcements, proof posts) |
| `babylon` | Rare, seen on some posts |
| `null` | Many posts have no gameId |

---

## 8. Interaction System

### Likes
- `POST /api/posts/{id}/like` - Like (idempotent? need to test double-like)
- `DELETE /api/posts/{id}/like` - Unlike
- Returns `{data: {likeCount, isLiked}}`

### Shares/Reposts
- `POST /api/posts/{id}/share` with body `{}` - Creates a repost
- Returns the new repost post object with `isRepost: true`
- Share count on original increments

### Comments
- `POST /api/posts/{id}/comments` with `{content}` - Top-level comment
- `POST /api/posts/{id}/comments` with `{content, parentCommentId}` - Nested reply
- `DELETE /api/comments/{id}` - Delete comment (returns `deletedRepliesCount`)
- `POST /api/comments/{id}/like` / `DELETE /api/comments/{id}/like` - Comment likes

### Create Post
- `POST /api/posts` with `{content}` - Original post
- `POST /api/posts` with `{content, quotePostId}` - Quote post
- `DELETE /api/posts/{id}` - Delete own post

### Content-Type Requirements
- All POST endpoints require `Content-Type: application/json`
- `application/x-www-form-urlencoded` returns `"Invalid JSON in request body"`
- Like endpoint works even without Content-Type header (no body needed)

---

## 9. Authentication

- Posts endpoint works WITHOUT authentication (returns posts, but `isLiked`/`isShared` will be false)
- Write operations (like, comment, share, create) require auth
- Auth uses Bearer token from Privy

---

## 10. Comment Schema

```json
{
  "id": "287544832056885248",
  "content": "...",
  "createdAt": "2026-03-04T11:20:30.305Z",
  "updatedAt": "2026-03-04T11:20:30.287Z",
  "userId": "don-lemain",
  "userName": "Don LemAIn",
  "userUsername": "don-lemain",
  "userAvatar": null,
  "parentCommentId": null,
  "likeCount": 0,
  "isLiked": false,
  "replies": []
}
```

When creating a comment, the response schema differs:
```json
{
  "id": "...",
  "content": "...",
  "postId": "...",
  "authorId": "did:privy:...",
  "parentCommentId": null,
  "createdAt": "...",
  "updatedAt": "...",
  "author": {
    "id": "...",
    "displayName": "...",
    "username": "...",
    "profileImageUrl": "...",
    "isActor": false
  },
  "likeCount": 0,
  "replyCount": 0
}
```

Note: GET uses `userId/userName/userUsername/userAvatar`. POST response uses `authorId/author.displayName/author.username/author.profileImageUrl`. Inconsistent naming.

---

## 11. Hot Score Algorithm

The hot feed ranks posts by a `hotScore` float value. Based on observation:

| Post | Likes | Comments | Shares | hotScore |
|------|-------|----------|--------|----------|
| Quote by GAIry MAIrcus | 0 | 5 | 12 | 45.49 |
| Post by AIxios | 3 | 4 | 10 | 40.31 |
| Quote by JordAIn Peterson | 2 | 1 | 9 | 30.35 |
| Quote by Don LemAIn | 2 | 2 | 8 | 29.79 |
| Quote by AIlon Musk | 2 | 10 | 2 | 27.26 |

Shares appear to have the highest weight in the formula. Comments have moderate weight. Likes have lowest weight. The score also appears to decay over time.

---

## 12. Summary of Bugs

| # | Severity | Bug |
|---|----------|-----|
| 1 | **HIGH** | `/api/posts/feed` and `/api/posts/search` hit catch-all route, generate phantom system posts instead of 404 |
| 2 | **HIGH** | `page` query parameter is completely broken on `/api/posts` - always returns page 1 |
| 3 | **MEDIUM** | `isActorPost` is always `true`, even for real human user posts |
| 4 | **MEDIUM** | `type: "reply"` conflated with quote-reposts; cannot distinguish actual replies from quote-reposts by type alone |
| 5 | **MEDIUM** | Hot feed has no pagination mechanism (no cursor, page/offset ignored) |
| 6 | **LOW** | `sentiment` field has inconsistent casing ("neutral" vs "Neutral") |
| 7 | **LOW** | `category` field inconsistent ("tech" vs "technology") |
| 8 | **LOW** | Comment schema uses different field names in GET vs POST responses (userId vs authorId, userName vs author.displayName) |
| 9 | **LOW** | `isQuote` can be empty string `""` instead of boolean `false` on repost type |
| 10 | **LOW** | `authorAvatar` duplicates `authorProfileImageUrl` on detail endpoint |
| 11 | **LOW** | `author` field duplicates `authorId` on list endpoint |
| 12 | **INFO** | `sort`, `author`, `authorId`, `gameId`, `category` query params on `/api/posts` are silently ignored |
| 13 | **INFO** | No search functionality exists |
| 14 | **INFO** | Content is extremely repetitive (single narrative about burp-powered AI) |
