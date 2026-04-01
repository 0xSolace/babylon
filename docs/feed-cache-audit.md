# Feed & Cache System Audit

**Date:** 2026-04-01
**Scope:** Feed endpoints (For You, Stories/Narrative, Hot, Following/Latest), caching infrastructure, database query patterns

---

## Executive Summary

The feed system serves four primary feed types through six API routes, backed by a Redis cache layer with in-memory fallback. While the caching infrastructure is well-designed (thundering herd protection, batch operations, graceful degradation), **feed endpoints are doing far more DB work than necessary per request**. The root issues:

1. **Short cache TTLs (45-60s) on expensive pipelines** that take 200-500ms of DB time to rebuild
2. **No shared base layer** — each feed type independently fetches posts, engagement counts, author data, and market metadata
3. **Engagement counts recomputed on every cache miss** via multi-CTE queries across reactions/comments/shares
4. **Feed event aggregation pulls 14 days of raw rows** and aggregates in JS on every For You cache miss
5. **String-match joins** (`LOWER(TRIM(...))`) for question→market lookups with no computed index

Estimated impact: **40-60% reduction in feed DB load** is achievable with the recommendations below.

---

## 1. Feed Architecture Overview

### Routes & Pipelines

| Feed | Route | Pipeline | Cache TTL | What It Does |
|------|-------|----------|-----------|--------------|
| **For You** | `/api/feed/for-you` | `for-you/pipeline.ts` (1,644 lines) | 60s per-user, 300s discovery | Personalized: posts (24h) → backfill (14d) → feed event scoring → diversification |
| **Stories** | `/api/feed/stories` | `stories/pipeline.ts` (~870 lines) | 60s global, 30s user enrichment | Posts grouped by prediction market question, daily topic boost |
| **Narrative** | `/api/feed/narrative` | Inline in route (~500 lines) | 60s global, 30s user enrichment | Alternative story view with arc states and market probability bars |
| **Hot** | `/api/feed/hot` | Inline in route (~300 lines) | 60s keyed by limit | Trending posts from 24h, engagement-weighted with age penalty |
| **Latest** | Via `cachedDb.getRecentPosts()` | `cached-database-service.ts` | 45s | Chronological posts with offset/cursor pagination |
| **Following** | Via `cachedDb.getFollowingFeed()` | `cached-database-service.ts` | 45s per-user | Posts from followed users, filters test accounts |

### Request Flow

```
Client → Next.js API Route → Auth check → getCacheOrFetch() → Pipeline
                                                ↓ (cache miss)
                                          DB queries (5-15 per feed)
                                          In-memory scoring/ranking
                                          Cache write → Response
```

---

## 2. Cache Infrastructure

### What's Good

| Feature | Implementation | File |
|---------|---------------|------|
| **Cache-aside with thundering herd protection** | Probabilistic early refresh (beta=0.5-2.0) prevents stampede | `cache-service.ts:200+` |
| **Batch operations** | `getCacheBatchOrFetch()` — MGET + batch miss fetch (N → 2 Redis calls) | `cache-service.ts:300+` |
| **Graceful fallback** | In-memory Map when Redis unavailable, auto-cleanup every 60s | `cache-service.ts:40-41` |
| **Write-time invalidation** | Trades, likes, shares, follows all trigger targeted invalidation | `cached-database-service.ts:474-631` |
| **Negative caching** | Non-existent user lookups cached for 5 min to prevent repeated misses | `user-lookup.ts:149-276` |
| **HTTP stale-while-revalidate** | `Cache-Control: stale-while-revalidate=60s` extends perceived freshness | Route handlers |
| **Namespace organization** | Clear prefixes: `posts:list`, `user:balance`, `markets:api:perps` | `cache-service.ts:49-98` |

### What's Problematic

#### 2a. Pattern Invalidation Uses SCAN (O(N))

```typescript
// cache-service.ts — invalidateCachePattern()
const stream = client.scanStream({ match: fullPattern });
```

Every post creation triggers `invalidateCachePattern('*', { namespace: CACHE_KEYS.POSTS_LIST })` which scans the entire `posts:list:*` keyspace. At scale with many cached cursor positions, this becomes a bottleneck.

#### 2b. In-Memory Cache Has No Size Bound

```typescript
const memoryCache = new Map<string, CacheEntry<unknown>>();
```

No max-size or LRU eviction. Cleanup runs every 60s but only removes expired entries. Under load with varied cursor positions, memory can grow unbounded.

#### 2c. Cursor-Based Keys Have Low Hit Rate

Cache keys include the cursor value: `posts:list:${limit}:cursor:${timestamp}`. Different clients hitting the feed at different scroll positions generate unique keys, leading to cache misses even for overlapping content.

#### 2d. No Cache Hit/Miss Metrics

Beyond debug logging, there's no observability into cache effectiveness. No way to know actual hit rates, p99 fetch times on miss, or which namespaces are thrashing.

---

## 3. Per-Feed DB Query Analysis

### 3a. For You Feed — The Heaviest

**On every cache miss (every 60s per user), this pipeline runs:**

| Step | Queries | What | Cost |
|------|---------|------|------|
| 1. Fetch posts | 1 | Posts from last 24h, limit 5000 | Medium — indexed on timestamp |
| 2. Historical backfill | 1 | Posts from 14d window if <100 candidates | Medium |
| 3. Discovery backfill | 1 | 30-day discovery posts (cached 300s separately) | Medium |
| 4. Engagement counts | 1 (3 CTEs) | COUNT reactions, comments, shares for all candidate post IDs | **HIGH** — 3 aggregations over potentially thousands of rows |
| 5. Author batch load | 1 | `users WHERE id IN (authorIds)` | Low — batched |
| 6. Repost originals | 2 | Original posts + their authors | Low — batched |
| 7. Question metadata | 1 | `questions LEFT JOIN arcStates WHERE questionNumber IN (...)` | Low |
| 8. New market cards | 1 | `questions INNER JOIN markets` via `LOWER(TRIM(text))` match | **HIGH** — computed column join, no index |
| 9. Resolved markets | 1 | Same string-match join pattern | **HIGH** |
| 10. User positions | 1 | `positions WHERE userId = ...` | Low |
| 11. Following list | 1 | `follows WHERE followerId = ...` | Low |
| 12. Actor follows | 1 | `userActorFollows WHERE userId = ...` | Low |
| 13. Feed events | 1 | **14 days of raw feed events** for affinity scoring | **CRITICAL** — unbounded row count, all aggregated in JS |
| 14. User enrichment | 3 | Liked posts, shared posts, position question IDs | Low (cached 30s) |

**Total: 15-17 queries per cache miss.** The engagement CTEs (#4), string-match joins (#8, #9), and feed event pull (#13) are the main cost drivers.

### 3b. Stories Feed

| Step | Queries | Cost |
|------|---------|------|
| Fetch posts (12h window) | 1 | Medium |
| Engagement counts (same CTE pattern) | 1 | **HIGH** |
| Author batch load | 1 | Low |
| Question + arcState + market metadata | 1 | Medium (includes string-match join) |
| New market cards | 1 | **HIGH** (string-match join) |
| User enrichment (likes, shares, positions) | 3 | Low (cached 30s) |

**Total: ~8 queries per cache miss.**

### 3c. Narrative Feed

Very similar to Stories but runs inline in the route handler. Same query patterns, same costs. Shares the 30s user enrichment cache with Stories.

### 3d. Hot Feed

| Step | Queries | Cost |
|------|---------|------|
| Fetch posts (24h) | 1 | Medium |
| Engagement CTE (reactions + comments + shares + comment previews + rankings) | 1 | **HIGH** — 5 CTEs |
| Author batch load | 1 | Low |
| User likes/shares check | 2 | Low (only for authed users) |

**Total: ~5 queries per cache miss.** The engagement CTE is the dominant cost.

### 3e. Latest / Following

| Step | Queries | Cost |
|------|---------|------|
| Fetch posts with cursor/offset | 1 | Low-Medium |
| Following filter (test user exclusion) | Built into query | Fetches 2x limit, filters in memory |

**Total: 1 query per cache miss.** Relatively cheap but the 2x overfetch for test user filtering is wasteful.

---

## 4. Critical Issues

### Issue 1: Engagement Counts Recomputed Everywhere

Every feed type independently runs engagement count queries (reactions, comments, shares) over the same posts. There's no shared engagement cache.

**Current:** Each feed miss → 1 multi-CTE query counting likes/comments/shares for up to 500-5000 posts
**Impact:** This is the single most repeated expensive operation across all feeds

### Issue 2: Feed Event Aggregation is Unbounded

```typescript
// pipeline.ts — For You feed
const FEED_EVENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
```

On every For You cache miss (every 60s per active user), the pipeline fetches **all feed events from the last 14 days** for that user and aggregates them in JavaScript to build affinity maps (author, topic, cluster, market). For an active user, this could be thousands of rows.

**Current:** Raw SELECT → JS aggregation every 60s
**Should be:** Pre-aggregated daily/hourly, cached with longer TTL

### Issue 3: String-Match Joins for Question→Market

```typescript
// pipeline.ts:920-952
.innerJoin(markets, sql`lower(trim(${markets.question})) = lower(trim(${questions.text}))`)
```

This join compares market questions to question text using `LOWER(TRIM(...))` on both sides. Without a functional index, this forces a sequential scan on the `markets` table for every candidate question.

**Used in:** For You (2x), Stories (1x), Narrative (1x) = **4 times across feed endpoints**

### Issue 4: No Shared Post Enrichment Layer

Each pipeline independently:
1. Fetches raw posts
2. Fetches engagement counts
3. Fetches author data
4. Fetches question/market metadata

There's no shared "enriched post" cache that multiple feeds could read from.

### Issue 5: Per-User Cache Keys Don't Scale

For You uses per-user cache keys with 60s TTL. With 400k+ users and even 1% DAU (4,000 concurrent), that's 4,000 independent cache entries, each triggering the full 15-17 query pipeline on miss. The cache provides no cross-user benefit for the base post/engagement data.

### Issue 6: Test User Filtering Post-Query

```typescript
// database-service.ts — getFollowingFeed
// Fetches limit * 2, then filters out test users in JS
```

The Following feed fetches double the requested posts and filters test users in application code rather than in the WHERE clause. This wastes 50% of fetched data.

---

## 5. TTL Summary

| Cache Key | TTL | Justified? |
|-----------|-----|-----------|
| `posts:list` | 45s | Too short for the query cost. Could be 120-180s with event-driven invalidation |
| `posts:following` | 45s per-user | Same — short TTL, per-user key, expensive rebuild |
| For You base | 60s per-user | Way too short for 15+ query pipeline. Should split base (300s) from personalization (60s) |
| For You discovery | 300s | Reasonable |
| Stories/Narrative global | 60s | Acceptable if engagement counts were cached separately |
| User enrichment | 30s | Reasonable — small queries, user-specific |
| Hot feed | 60s keyed by limit | Could be 120s — "hot" doesn't need 1-minute freshness |
| User balance | 30s | Appropriate — financial data |
| User profile | 300s | Appropriate |
| Perp markets | 8s | Appropriate — rapid price changes |
| Prediction markets | 12s | Appropriate |

---

## 6. Recommendations

### R1: Shared Engagement Count Cache (High Impact, Medium Effort)

Create a dedicated `post:engagement:{postId}` cache with 120s TTL that stores `{ likes, comments, shares }`. All feed pipelines read from this instead of running their own CTEs. Invalidate on like/comment/share writes.

**Expected impact:** Eliminates the most expensive repeated query across all 4 feed types.

### R2: Pre-Aggregate Feed Events (High Impact, Medium Effort)

Replace the 14-day raw feed event pull with a pre-aggregated affinity table. Run a cron job (hourly or on event batch) that maintains per-user affinity scores. The For You pipeline reads the pre-computed scores instead of aggregating raw events.

**Expected impact:** Removes the single largest query from the For You pipeline. Reduces cache miss cost by ~30%.

### R3: Functional Index for Question→Market Join (High Impact, Low Effort)

```sql
CREATE INDEX CONCURRENTLY idx_markets_question_lower_trim
ON "Market" (lower(trim(question)));

CREATE INDEX CONCURRENTLY idx_questions_text_lower_trim
ON "Question" (lower(trim(text)));
```

**Expected impact:** Converts 4 sequential scans per feed cycle into index lookups.

### R4: Split For You Into Base + Personalization Layers (High Impact, High Effort)

Separate the For You pipeline into:
1. **Base layer** (shared, 300s TTL): Fetch posts, engagement counts, author data, question metadata → produces scored candidate list
2. **Personalization layer** (per-user, 60s TTL): Apply affinity weights, diversification, cursor position

The base layer is shared across all users. Only the lightweight personalization step runs per-user.

**Expected impact:** Reduces per-user cache miss from 15+ queries to ~2 (read affinities + apply). Shared base serves all users.

### R5: Increase TTLs on Expensive Feeds (Medium Impact, Low Effort)

| Cache | Current TTL | Proposed TTL | Rationale |
|-------|------------|-------------|-----------|
| `posts:list` | 45s | 120s | With write-time invalidation, 120s is safe |
| `posts:following` | 45s | 90s | Per-user; longer TTL reduces rebuild frequency |
| For You base | 60s | 300s (shared base) | See R4 |
| Hot feed | 60s | 180s | "Hot" by definition tolerates 3-minute lag |
| Stories global | 60s | 120s | Engagement cache (R1) keeps counts fresh independently |

### R6: Filter Test Users in SQL, Not JS (Low Impact, Low Effort)

Add test user exclusion to the WHERE clause in the Following feed query instead of fetching 2x and filtering in memory. Maintain a cached set of test user IDs (they change rarely).

### R7: Replace SCAN-Based Invalidation with Tag Sets (Medium Impact, Medium Effort)

Instead of `SCAN posts:list:*` on every post creation, maintain a Redis SET of active cache keys per namespace. Invalidation reads the set and DELs directly — O(K) where K is keys to invalidate, not O(N) total keys.

### R8: Add Cache Observability (Medium Impact, Low Effort)

Instrument `getCacheOrFetch` with:
- Hit/miss counters per namespace
- Cache miss latency (time spent in fetch function)
- Eviction/invalidation counters

Expose via `/api/internal/cache-stats` or push to your observability stack.

### R9: Cap In-Memory Fallback Cache Size (Low Impact, Low Effort)

Add a max entry count (e.g., 10,000) with LRU eviction to the in-memory fallback Map. Prevents unbounded memory growth when Redis is down.

---

## 7. Priority Matrix

| # | Recommendation | Impact | Effort | Priority |
|---|---------------|--------|--------|----------|
| R1 | Shared engagement count cache | High | Medium | **P0** |
| R2 | Pre-aggregate feed events | High | Medium | **P0** |
| R3 | Functional index on question/market text | High | Low | **P0** |
| R5 | Increase TTLs | Medium | Low | **P1** |
| R4 | Split For You base + personalization | High | High | **P1** |
| R6 | Filter test users in SQL | Low | Low | **P1** |
| R8 | Cache observability | Medium | Low | **P1** |
| R7 | Replace SCAN with tag sets | Medium | Medium | **P2** |
| R9 | Cap in-memory cache size | Low | Low | **P2** |

---

## 8. Key Files Reference

| File | Purpose |
|------|---------|
| `packages/api/src/cache/cache-service.ts` | Core cache-aside, thundering herd, batch ops |
| `packages/api/src/cache/cached-database-service.ts` | Cached wrappers for DB queries, invalidation |
| `packages/api/src/cache/markets-api-cache.ts` | Market-specific cache invalidation |
| `packages/api/src/redis/client.ts` | Redis connection, reconnection, fallback |
| `apps/web/src/app/api/feed/for-you/pipeline.ts` | For You feed pipeline (1,644 lines) |
| `apps/web/src/app/api/feed/for-you/scoring.ts` | For You scoring/diversification |
| `apps/web/src/app/api/feed/for-you/historicalBackfill.ts` | Discovery & backfill queries |
| `apps/web/src/app/api/feed/stories/pipeline.ts` | Stories feed pipeline (~870 lines) |
| `apps/web/src/app/api/feed/narrative/route.ts` | Narrative feed (inline pipeline) |
| `apps/web/src/app/api/feed/hot/route.ts` | Hot feed (inline pipeline) |
| `apps/web/src/app/api/feed/feed-cursor.ts` | Score-based cursor pagination |
| `packages/db/src/database-service.ts` | Raw DB queries (Latest, Following) |
| `packages/db/src/schema/posts.ts` | Post schema, 11 indexes, relations |
| `packages/engine/src/services/trade-cache-invalidation.ts` | Trade-triggered cache invalidation |
