# Feed & Cache Optimization Plan

**Date:** 2026-04-01
**Status:** Validated against codebase, LARP-assessed and corrected
**Scope:** Feed endpoints (For You, Stories/Narrative, Hot, Following/Latest), caching infrastructure, database query patterns

---

## Audit Corrections

The initial audit identified 9 recommendations. Deep codebase validation revealed:

| Original | Status | Finding |
|----------|--------|---------|
| R3: Functional indexes on `LOWER(TRIM(...))` | **Already done** | Migration `0060_add_feed_pipeline_indexes.sql` creates `idx_questions_text_lower_trim` and `idx_markets_question_lower_trim` |
| R4: Split For You into base + personalization | **Already done** | Pipeline already splits into global base (`feed:for-you:v2:base`, 60s), per-user enrichment (`feed:for-you:enrichment:{userId}`, 30s), and per-user ranked (`feed:for-you:ranked:v1:{userId}`, 60s) |
| R2: Feed events "unbounded" | **Overstated** | Query is `LIMIT 500` with composite index `FeedEvent_userId_surface_createdAt_idx`. Still worth caching longer, not a crisis |
| New: Post deletion missing invalidation | **Bug found** | `DELETE /api/posts/[id]` soft-deletes but never invalidates post/feed caches |
| New: Trade→narrative enrichment gap | **Bug found** | Buying/selling predictions doesn't invalidate `narrative:enrichment:{userId}`, so `positionQuestionIds` is stale for up to 30s |
| New: Comment creation skips invalidation | **Intentional** | Confirmed acceptable — comment counts go stale for up to 60s by design |

---

## Final Plan: 7 Work Items

### WI-1: Shared Engagement Count Service

**Priority:** P0 — highest impact, eliminates the most repeated expensive query
**Estimated scope:** ~200 lines new code, ~150 lines refactored across 4 files

#### Problem

The identical 3-CTE engagement query (COUNT reactions, COUNT comments, COUNT shares) is copy-pasted across **6 locations** with no shared cache:

| File | Lines | Pattern |
|------|-------|---------|
| `apps/web/src/app/api/feed/for-you/pipeline.ts` | 425-464 | CTE with INNER JOINs |
| `apps/web/src/app/api/feed/for-you/pipeline.ts` | 1189-1197 | CTE with correlated subqueries (discovery) |
| `apps/web/src/app/api/feed/stories/pipeline.ts` | 267-301 | CTE with INNER JOINs (identical copy) |
| `apps/web/src/app/api/feed/narrative/route.ts` | 195-229 | CTE with INNER JOINs (identical copy) |
| `apps/web/src/app/api/feed/hot/route.ts` | 297-326 | 3x `Promise.all` separate queries |
| `apps/web/src/app/api/feed/for-you/historicalBackfill.ts` | 32-46 | Correlated subqueries in ORDER BY |

Each feed miss independently queries reactions, comments, and shares tables for hundreds of posts. When multiple feeds expire in the same window, the same counts are computed 3-4x.

#### Solution

Create a shared engagement count service in `packages/api/src/cache/engagement-cache.ts`:

```typescript
// New file: packages/api/src/cache/engagement-cache.ts

import { db, sql } from '@babylon/db';
import { getCacheBatchOrFetch, invalidateCache } from './cache-service';

export interface EngagementCounts {
  likes: number;
  comments: number;
  shares: number;
}

const ENGAGEMENT_NAMESPACE = 'post:engagement';
const ENGAGEMENT_TTL = 120; // 2 minutes — longer than feed TTLs so feeds read from this

/**
 * Batch-fetch engagement counts for a set of post IDs.
 * Uses getCacheBatchOrFetch: MGET for cached entries, single CTE query for misses.
 * All feed pipelines should call this instead of running their own CTEs.
 */
export async function getEngagementCounts(
  postIds: string[]
): Promise<Map<string, EngagementCounts>> {
  if (postIds.length === 0) return new Map();

  return getCacheBatchOrFetch<EngagementCounts>(
    postIds,
    async (missingIds) => {
      const postIdsArray = sql`ARRAY[${sql.join(
        missingIds.map((id) => sql`${id}`),
        sql`, `
      )}]::text[]`;

      const rows = await db.execute(sql`
        WITH
        target_posts AS (
          SELECT unnest(${postIdsArray}) AS post_id
        ),
        reaction_counts AS (
          SELECT r."postId" AS post_id, COUNT(*) AS count
          FROM "Reaction" r
          INNER JOIN target_posts tp ON r."postId" = tp.post_id
          WHERE r.type = 'like'
          GROUP BY r."postId"
        ),
        comment_counts AS (
          SELECT c."postId" AS post_id, COUNT(*) AS count
          FROM "Comment" c
          INNER JOIN target_posts tp ON c."postId" = tp.post_id
          WHERE c."deletedAt" IS NULL
          GROUP BY c."postId"
        ),
        share_counts AS (
          SELECT s."postId" AS post_id, COUNT(*) AS count
          FROM "Share" s
          INNER JOIN target_posts tp ON s."postId" = tp.post_id
          GROUP BY s."postId"
        )
        SELECT
          tp.post_id,
          COALESCE(rc.count, 0) AS like_count,
          COALESCE(cc.count, 0) AS comment_count,
          COALESCE(sc.count, 0) AS share_count
        FROM target_posts tp
        LEFT JOIN reaction_counts rc ON tp.post_id = rc.post_id
        LEFT JOIN comment_counts cc ON tp.post_id = cc.post_id
        LEFT JOIN share_counts sc ON tp.post_id = sc.post_id
      `);

      const result = new Map<string, EngagementCounts>();
      for (const row of Array.isArray(rows)
        ? (rows as Record<string, unknown>[])
        : []) {
        const postId = String(row['post_id'] ?? '');
        if (!postId) continue;
        result.set(postId, {
          likes: Number(row['like_count'] ?? 0),
          comments: Number(row['comment_count'] ?? 0),
          shares: Number(row['share_count'] ?? 0),
        });
      }
      return result;
    },
    { namespace: ENGAGEMENT_NAMESPACE, ttl: ENGAGEMENT_TTL }
  );
}

/**
 * Invalidate engagement counts for specific posts.
 * Call from like/unlike, comment, and share handlers.
 */
export async function invalidateEngagementCounts(
  postIds: string[]
): Promise<void> {
  // Uses batch delete — exact keys, no SCAN needed
  await Promise.all(
    postIds.map((id) =>
      invalidateCache(id, { namespace: ENGAGEMENT_NAMESPACE })
    )
  );
}
```

#### Changes Per File

**1. `apps/web/src/app/api/feed/for-you/pipeline.ts`**
- Lines 425-484: Replace inline CTE + map construction with:
  ```typescript
  const engagementMap = await getEngagementCounts(postIds);
  const reactionMap = new Map([...engagementMap].map(([id, e]) => [id, e.likes]));
  const commentMap = new Map([...engagementMap].map(([id, e]) => [id, e.comments]));
  const shareMap = new Map([...engagementMap].map(([id, e]) => [id, e.shares]));
  ```
- Lines 1189-1213: Replace discovery engagement subqueries with same pattern

**2. `apps/web/src/app/api/feed/stories/pipeline.ts`**
- Lines 267-316: Same replacement as for-you

**3. `apps/web/src/app/api/feed/narrative/route.ts`**
- Lines 195-244: Same replacement as for-you

**4. `apps/web/src/app/api/feed/hot/route.ts`**
- Lines 297-326: Replace 3x `Promise.all` separate queries with single `getEngagementCounts()` call

**5. `apps/web/src/app/api/feed/for-you/historicalBackfill.ts`**
- Lines 32-46: The ORDER BY subquery pattern can't use the batch cache directly (it's in SQL). Leave as-is for now — this runs only on backfill, not hot path. Add TODO comment.

**6. Invalidation triggers — add `invalidateEngagementCounts([postId])` alongside existing invalidation calls:**

Import `invalidateEngagementCounts` from `@babylon/api` (re-exported from `packages/api/src/index.ts`) in each file.

- **`apps/web/src/app/api/posts/[id]/like/route.ts`** — after the existing `invalidateCache(\`post:${postId}:interactions:*\`)` call (POST handler ~line 225, DELETE handler ~line 321). Add alongside, do NOT remove existing invalidation.
- **`apps/web/src/app/api/posts/[id]/share/route.ts`** — after the existing `cachedDb.invalidatePostsCache()` call (POST handler ~line 410, DELETE handler ~line 606). Add alongside.
- **`apps/web/src/app/api/posts/[id]/comments/route.ts`** — on new comment. Currently comments have NO invalidation (intentional per audit). Adding engagement count invalidation here is optional — comment counts will self-correct within the 120s engagement cache TTL.

#### Testing

**Unit test:** `packages/testing/unit/engagement-cache.test.ts`

```
describe('getEngagementCounts')
  ✓ returns cached counts on cache hit (no DB call)
  ✓ fetches from DB on cache miss and populates cache
  ✓ handles mixed hits/misses (batch operation)
  ✓ returns zeros for posts with no engagement
  ✓ handles empty postIds array
  ✓ gracefully degrades when Redis unavailable

describe('invalidateEngagementCounts')
  ✓ invalidates exact keys (no SCAN)
  ✓ handles empty array without error

describe('integration with feed pipelines')
  ✓ For You pipeline uses shared engagement cache
  ✓ Stories pipeline uses shared engagement cache
  ✓ Hot feed uses shared engagement cache
  ✓ Multiple feeds reading same posts hit cache (no duplicate DB queries)
```

**Verification:** After implementation, run all existing feed tests to confirm no regressions:
```bash
bun test apps/web/src/app/api/feed/for-you/
bun test apps/web/src/app/api/feed/stories/
bun test apps/web/src/app/api/feed/narrative/
bun test apps/web/src/app/api/feed/hot/
bun test packages/testing/unit/narrative-enrichment-cache.test.ts
bun test packages/testing/unit/narrative-feed-algorithms.test.ts
```

---

### WI-2: Cache Feed Event Aggregates Longer

**Priority:** P1 — moderate impact, low effort
**Estimated scope:** ~20 lines changed

#### Problem

The For You pipeline calls `loadFeedEventAggregates(userId)` which fetches up to 500 feed events from the last 14 days and aggregates them in JS. This runs on every enrichment cache miss (every 30s per active user). The aggregates (affinity/fatigue maps) change slowly — a user's 14-day behavioral profile doesn't shift meaningfully in 30 seconds.

**Current:** Fetched as part of the enrichment bundle at `feed:for-you:enrichment:{userId}` with 30s TTL.

**File:** `apps/web/src/app/api/feed/for-you/pipeline.ts`
- `loadFeedEventAggregates()`: lines 1107-1145
- Called at line 1376 inside the enrichment `Promise.all`

#### Solution

Extract feed event aggregates into their own cache key with a longer TTL, separate from the fast-changing enrichment data (likes, shares, positions).

**Critical context:** The enrichment cache currently stores a **6-element typed tuple** at `feed:for-you:enrichment:{userId}`. Extracting `eventAggregates` requires changing the tuple to 5 elements AND fetching aggregates separately. The type annotations are explicit — TypeScript will catch any mismatch, but all 4 locations must be updated atomically.

**In `apps/web/src/app/api/feed/for-you/pipeline.ts`:**

**Step 1 — Add constant and wrapper function:**
```typescript
const EVENT_AGGREGATES_TTL_S = 300; // 5 minutes — behavioral profile is slow-changing

async function getCachedEventAggregates(
  userId: string
): Promise<EventAggregates> {
  return getCacheOrFetch(
    `feed:for-you:events:${userId}`,
    () => loadFeedEventAggregates(userId),
    { namespace: 'feed', ttl: EVENT_AGGREGATES_TTL_S }
  );
}
```

**Step 2 — Remove `loadFeedEventAggregates` from the enrichment `Promise.all` (line 1376):**

Delete line 1376 from the `Promise.all([...])` block. This changes the cached value from a 6-tuple to a 5-tuple.

**Step 3 — Update the destructuring type annotation (lines 1294-1307):**

```typescript
// BEFORE (6-tuple):
const [
  followedUsers, followedActors, userLikes, userShares, userPositions,
  eventAggregates,
]: [
  FollowRow[], FollowRow[],
  Array<{ postId: string | null }>, Array<{ postId: string }>,
  Array<{ questionId: number | null }>,
  EventAggregates,
] = userId ? /* ... */ : [[], [], [], [], [], aggregateFeedEvents([])];

// AFTER (5-tuple + separate call):
const [
  followedUsers, followedActors, userLikes, userShares, userPositions,
]: [
  FollowRow[], FollowRow[],
  Array<{ postId: string | null }>, Array<{ postId: string }>,
  Array<{ questionId: number | null }>,
] = userId ? /* ... */ : [[], [], [], [], []];

const eventAggregates = userId
  ? await getCachedEventAggregates(userId)
  : aggregateFeedEvents([]);
```

**Step 4 — Update error fallback (line ~1393):**
```typescript
// BEFORE:
return [[], [], [], [], [], aggregateFeedEvents([])] as [
  FollowRow[], FollowRow[], Array<{ postId: string | null }>,
  Array<{ postId: string }>, Array<{ questionId: number | null }>,
  EventAggregates,
];

// AFTER:
return [[], [], [], [], []] as [
  FollowRow[], FollowRow[], Array<{ postId: string | null }>,
  Array<{ postId: string }>, Array<{ questionId: number | null }>,
];
```

**Step 5 — Update unauthenticated fallback (line ~1403):**
```typescript
// BEFORE:
: [[], [], [], [], [], aggregateFeedEvents([])];
// AFTER:
: [[], [], [], [], []];
```

**Why all 4 locations must change:** The enrichment value is stored in Redis as serialized JSON. If Step 2 (remove from Promise.all) ships without Steps 3-5, the cache would return stale 6-tuples and the destructuring would silently assign the wrong values to variables. TypeScript catches this at compile time, but only if all changes are in the same commit.

This means:
- Likes/shares/positions still refresh every 30s (enrichment TTL)
- Behavioral profile refreshes every 5 minutes (new separate TTL)
- DB query for 500 feed events runs 10x less often per user
- **Cache migration note:** Existing cached 6-tuples will error on deserialize after deploy. This is safe because the enrichment TTL is only 30s — all stale entries expire within 30s of deploy, and the error fallback (Step 4) returns empty arrays.

#### Testing

**Existing tests to verify:** `apps/web/src/app/api/feed/for-you/route.test.ts`

**New test cases in** `packages/testing/unit/feed-event-aggregates-cache.test.ts`:

```
describe('getCachedEventAggregates')
  ✓ returns cached aggregates without DB query on cache hit
  ✓ fetches from DB and caches on miss
  ✓ uses 300s TTL (separate from 30s enrichment TTL)
  ✓ cache key is per-user (feed:for-you:events:{userId})
  ✓ falls back to empty aggregates on error
```

---

### WI-3: Fix Missing Cache Invalidations

**Priority:** P0 — correctness bugs
**Estimated scope:** ~30 lines added across 3 files

#### Bug 1: Post Deletion Missing Invalidation

**File:** `apps/web/src/app/api/posts/[id]/route.ts`
**Location:** DELETE handler (lines ~770-828)

The handler soft-deletes posts (`deletedAt = new Date()`) but never invalidates any cache. Deleted posts continue appearing in feeds for up to 60s.

**Required import changes** (lines 67-74 — the `@babylon/api` import block):

The file currently imports from `@babylon/api`:
```typescript
import {
  addPublicReadHeaders,
  authenticate,
  BusinessLogicError,
  NotFoundError,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
```

Add `cachedDb` and `invalidateCache`:
```typescript
import {
  addPublicReadHeaders,
  authenticate,
  BusinessLogicError,
  cachedDb,           // ← ADD
  invalidateCache,    // ← ADD
  NotFoundError,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
```

**Verified:** Both `cachedDb` and `invalidateCache` are exported from `@babylon/api` — confirmed by the POST handler in `posts/route.ts` which imports them at lines 233 and 241 respectively.

**Fix:** Add after the soft-delete UPDATE (after line ~815):

```typescript
// After: await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, postId));

// Invalidate feed caches so deleted post is removed
await cachedDb.invalidatePostsCache();
await cachedDb.invalidateActorPostsCache(post.authorId);
invalidateCache('feed:narrative:v1', { namespace: 'feed' }).catch((err) => {
  logger.warn(
    'Narrative feed cache invalidation failed after post delete',
    { error: err, postId },
    'DELETE /api/posts/[id]'
  );
});
```

**Verified:** `post.authorId` is available in scope — the DELETE handler queries it explicitly at lines 781-789:
```typescript
const [post] = await db
  .select({ id: posts.id, authorId: posts.authorId, deletedAt: posts.deletedAt })
  .from(posts)
  .where(eq(posts.id, postId))
  .limit(1);
```

This matches the exact pattern used in the POST (create) handler at lines 1409-1437 of `posts/route.ts`.

#### Bug 2: Trade Missing Narrative Enrichment Invalidation

**Files:**
- `apps/web/src/app/api/markets/predictions/[id]/buy/route.ts`
- `apps/web/src/app/api/markets/predictions/[id]/sell/route.ts`

When a user buys/sells a prediction position, `positionQuestionIds` in the narrative enrichment cache becomes stale. The user's Stories/Narrative feed won't show "you have a position" badge for up to 30s.

**Fix for both buy/route.ts (line 143) and sell/route.ts (line 141):**

**Step 1 — Add imports.** Both files currently import from `@babylon/api`:
```typescript
import {
  authenticate,
  BusinessLogicError,
  broadcastToChannel,
  checkProgress,
  invalidateMarketsApiPredictionsAfterUserTrade,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
```

Add `invalidateCache` and `narrativeEnrichmentKey`:
```typescript
import {
  authenticate,
  BusinessLogicError,
  broadcastToChannel,
  checkProgress,
  invalidateCache,              // ← ADD
  invalidateMarketsApiPredictionsAfterUserTrade,
  narrativeEnrichmentKey,       // ← ADD
  successResponse,
  withErrorHandling,
} from '@babylon/api';
```

**Verified:** Both are exported from `@babylon/api`:
- `invalidateCache` — `packages/api/src/cache/cache-service.ts:351`
- `narrativeEnrichmentKey` — `packages/api/src/cache/cache-service.ts:111`

**Step 2 — Add invalidation call** after the existing line in each file:

```typescript
// Existing (buy/route.ts line 143, sell/route.ts line 141):
void invalidateMarketsApiPredictionsAfterUserTrade(user.userId);

// Add immediately after:
invalidateCache(narrativeEnrichmentKey(user.userId), {
  namespace: 'feed',
}).catch((err) => {
  logger.warn(
    'Failed to invalidate narrative enrichment cache after trade',
    { error: err, userId: user.userId },
    'POST /api/markets/predictions/[id]/buy' // adjust to /sell for sell route
  );
});
```

**Verified:** `user.userId` is the correct property — confirmed by multiple usages in both handlers (buy: lines 120, 126, 128, 142; sell: lines 119, 125, 127, 140).

#### Testing

**Post deletion invalidation test** — add to existing post route tests or create:
`packages/testing/unit/post-deletion-cache-invalidation.test.ts`

```
describe('POST /api/posts/[id] DELETE')
  ✓ invalidates posts list cache after soft delete
  ✓ invalidates actor posts cache for the author
  ✓ invalidates narrative feed cache
  ✓ deleted post does not appear in subsequent feed fetches (integration)
```

**Trade enrichment invalidation test** — add to:
`packages/testing/unit/trade-narrative-enrichment.test.ts`

```
describe('prediction trade → narrative enrichment')
  ✓ buy invalidates narrative enrichment for the trading user
  ✓ sell invalidates narrative enrichment for the trading user
  ✓ other users' enrichment caches are not affected
```

---

### WI-4: Increase Feed Cache TTLs

**Priority:** P1 — reduces DB load with minimal UX impact
**Estimated scope:** ~15 lines changed across 2 files

#### Current vs Proposed TTLs

| Cache | Key Pattern | Current | Proposed | Rationale |
|-------|------------|---------|----------|-----------|
| Posts list | `posts:list:*` | 45s | 120s | Write-time invalidation on post creation ensures freshness. 120s with invalidation is equivalent to 45s without. |
| Posts following | `posts:following:{userId}:*` | 45s | 90s | Per-user key already scoped. Follow/unfollow invalidates. |
| Hot feed | `feed:hot:v1:{limit}` | 60s | 180s | "Hot" is 24h trending — doesn't need minute-level freshness. |
| For You base | `feed:for-you:v2:base` | 60s | 120s | Global candidates change slowly. User personalization (30s enrichment) provides perceived freshness. |
| Stories global | `feed:stories:v1:current` | 60s | 120s | With shared engagement cache (WI-1), counts stay fresh independently. |
| Narrative global | `feed:narrative:v1` | **120s** | **120s (no change)** | Already at target TTL. |

#### Changes

**File 1: `packages/api/src/cache/cache-service.ts`**

```typescript
// Lines 126-129: Update DEFAULT_TTLS
export const DEFAULT_TTLS = {
  POSTS_LIST: 120,      // was 45 — write-time invalidation covers freshness
  POSTS_FOLLOWING: 90,   // was 45 — scoped per-user, follow events invalidate
  // ... rest unchanged
} as const;
```

**File 2: `apps/web/src/app/api/feed/for-you/pipeline.ts`**

```typescript
// Line 68: Update base cache TTL
const BASE_CACHE_TTL_S = 120; // was 60
```

**File 3: `apps/web/src/app/api/feed/hot/route.ts`**

```typescript
// Line 430: Update TTL in getCacheOrFetch options
{ namespace: 'feed', ttl: 180 }  // was 60
```

**File 4: `apps/web/src/app/api/feed/stories/route.ts`** (NOT `stories/pipeline.ts`)

The stories pipeline has NO cache TTL — it's a pure data function. The cache is set in the **route** file:

```typescript
// stories/route.ts line 19: Update constant
const CACHE_TTL_S = 120; // was 60
```

**No change for `narrative/route.ts`** — it already uses `ttl: 120` (line 744).

#### Testing

No new tests needed — existing feed tests validate response shape, not TTL values. Verify manually:

```bash
# Run all feed tests to confirm no regressions
bun test apps/web/src/app/api/feed/
bun test packages/testing/unit/narrative-enrichment-cache.test.ts
bun test packages/testing/integration/feed/
```

**Observability:** After deploy, monitor cache hit rates via logs. Expected improvement: ~60% reduction in feed cache misses.

---

### WI-5: Filter Test Users in SQL

**Priority:** P2 — correctness + minor perf improvement
**Estimated scope:** ~40 lines changed in 1 file

#### Problem

`database-service.ts:getRecentPosts()` (line 339) fetches `limit * 2` posts and filters test users in JS:

```typescript
// Current pattern:
const allPosts = await db.select().from(posts)
  .where(and(...conditions))
  .limit(limit * 2)  // ← 2x overfetch
  .orderBy(desc(posts.timestamp));

// Then: query for test users, filter in JS, slice to limit
```

This wastes ~50% of fetched data and requires an extra DB query to identify test users.

#### Solution

Move test user filtering into the SQL WHERE clause. Maintain a short-lived cached set of test user IDs (they change rarely).

**File:** `packages/db/src/database-service.ts`

**Required import changes** (lines 17-28):

The file currently imports from `drizzle-orm`:
```typescript
import { and, count, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
```

Add `not`:
```typescript
import { and, count, desc, eq, gte, inArray, isNull, lt, lte, not, sql } from 'drizzle-orm';
```

**Verified:** `not` is exported from `drizzle-orm` (confirmed via package inspection).

**Note on StaticDataRegistry:** The file does NOT currently import `StaticDataRegistry` from `@babylon/engine`, and adding it would create a dependency from `packages/db` → `packages/engine`, which violates the architecture rule (`packages/* → packages/contracts`, no circular deps). Instead, use the existing pattern: test actors have IDs starting with `test-` (already used at line 352). The `getTestUserIds()` method should use the `test-` prefix pattern for actors and the DB `isTest` flag for users — matching the existing approach.

Replace the 2x fetch + filter pattern in `getRecentPosts()` (lines 335-374):

```typescript
async getRecentPosts(limit = 100, cursorOrOffset?: string | number) {
  // Cache test user IDs for 5 minutes (they change very rarely)
  const testAuthorIds = await this.getTestUserIds();

  const conditions = [
    isNull(posts.deletedAt),
    lte(posts.timestamp, new Date()),
  ];

  // Exclude test users in SQL
  if (testAuthorIds.length > 0) {
    conditions.push(not(inArray(posts.authorId, testAuthorIds)));
  }

  if (cursor) {
    conditions.push(lt(posts.timestamp, new Date(cursor)));
  }

  return db.select().from(posts)
    .where(and(...conditions))
    .limit(limit)  // ← exact limit, no overfetch
    .offset(cursor ? 0 : offset)
    .orderBy(desc(posts.timestamp));
}

// New private method — uses DB isTest flag + ID prefix pattern (no engine dependency):
private testUserIdsCache: { ids: string[]; expiresAt: number } | null = null;

private async getTestUserIds(): Promise<string[]> {
  const now = Date.now();
  if (this.testUserIdsCache && this.testUserIdsCache.expiresAt > now) {
    return this.testUserIdsCache.ids;
  }

  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isTest, true));

  // Note: StaticDataRegistry is NOT imported here (would create db→engine circular dep).
  // Test actors already use 'test-' ID prefix convention (see existing line 352).
  // The cached-database-service.ts layer (which CAN import engine) handles the full
  // StaticDataRegistry check. This method provides the SQL-level baseline filter.
  const ids = testUsers.map((u) => u.id);
  this.testUserIdsCache = { ids, expiresAt: now + 300_000 }; // 5 min cache
  return ids;
}
```

Apply same pattern to `getPostsForFollowing()` in `cached-database-service.ts` (lines 130-149). That file already imports `StaticDataRegistry` from `@babylon/engine` (line 40), so the full test actor filtering via registry can remain there.

#### Testing

**Unit test:** `packages/testing/unit/test-user-filtering.test.ts`

```
describe('getRecentPosts test user filtering (database-service.ts)')
  ✓ excludes posts from users with isTest=true in DB
  ✓ returns exactly `limit` posts (no overfetch)
  ✓ caches test user IDs for 5 minutes
  ✓ works when no test users exist
  ✓ cache expires after 5 minutes and refreshes

describe('getPostsForFollowing test user filtering (cached-database-service.ts)')
  ✓ excludes posts from users with isTest=true in DB
  ✓ excludes posts from actors with isTest=true in StaticDataRegistry
  ✓ filters in SQL WHERE clause, not post-query in JS
```

**Integration test:** Add to `packages/testing/integration/feed/stories.integration.test.ts`:

```
describe('test user filtering in feeds')
  ✓ test user posts do not appear in latest feed
  ✓ test user posts do not appear in following feed
```

---

### WI-6: Scope Follow Invalidation

**Priority:** P2 — reduces unnecessary invalidation at scale
**Estimated scope:** ~10 lines changed

#### Problem

When any user follows/unfollows, `invalidateUserCache()` runs:

```typescript
// cached-database-service.ts:508
invalidateCachePattern('*', { namespace: 'user:follows' }),
```

This SCANs and deletes **every** `user:follows:*` key — a global invalidation for a per-user action.

#### Validated Cache Key Pattern

The `user:follows` namespace is read in exactly **one place**:

**File:** `apps/web/src/app/api/posts/route.ts` (lines 610-635)
```typescript
const followsCacheKey = `follows:${userId}`;
const allFollowedIds = await getCacheOrFetch(
  followsCacheKey,
  async () => { /* fetch follows from DB */ },
  { namespace: 'user:follows', ttl: 120 }
);
```

So the actual Redis key format is: `user:follows:follows:{userId}`.

When User A follows User B:
- User A's follow list changes (they now follow B) → key `user:follows:follows:{userA}` is stale
- User B's follow list is unchanged (they didn't follow anyone new)
- But `invalidateUserCache` is called for BOTH users (follower + target), which triggers the global `'*'` SCAN for each call

#### Solution

**File:** `packages/api/src/cache/cached-database-service.ts`

Replace the global pattern invalidation with exact key invalidation:

```typescript
// Line 508: Replace
invalidateCachePattern('*', { namespace: 'user:follows' }),

// With:
invalidateCache(`follows:${userId}`, { namespace: 'user:follows' }),
```

This uses `invalidateCache` (exact key delete, O(1)) instead of `invalidateCachePattern` (SCAN, O(N)). The key `follows:${userId}` matches the exact key pattern set by `posts/route.ts:610`.

Since `invalidateUserCache` is already called for both the follower and the target, both users' follow caches are invalidated. No changes needed in the follow route handlers.

#### Testing

**Unit test:** Add to existing follow-related tests:

```
describe('follow cache invalidation scoping')
  ✓ following User B invalidates follower's follow cache (exact key)
  ✓ following User B invalidates target's follow cache (exact key)
  ✓ does NOT use SCAN (no invalidateCachePattern call for follows)
  ✓ does NOT invalidate unrelated User C's follow cache
```

---

### WI-7: Add Cache Observability via Redis

**Priority:** P1 — enables data-driven tuning of all other changes
**Estimated scope:** ~80 lines new code

#### Problem

No visibility into cache hit rates, miss latency, or invalidation frequency. TTL tuning (WI-4) and other changes are flying blind.

#### Constraint: Vercel Serverless

This app deploys on **Vercel serverless** (confirmed: `vercel.json`, `next.config.ts` references `process.env.VERCEL`, `instrumentation.ts` has serverless cold-start guards). In-memory counters are useless here — they reset on cold starts and aren't shared across instances. The original plan proposed in-memory `Map<string, CacheMetrics>` counters, which would produce garbage data.

#### Solution

Use **Redis INCRBY** for counters — the same Redis instance the cache already uses. This gives cross-instance, persistent metrics with negligible overhead (INCRBY is O(1)).

**New file:** `packages/api/src/cache/cache-metrics.ts`

```typescript
import { getRedisClient } from '../redis';
import { logger } from '@babylon/shared';

const METRICS_PREFIX = 'cache:metrics';
const METRICS_TTL = 86400; // 24h rolling window — auto-cleanup

/**
 * Record a cache hit. Fire-and-forget — never blocks the request.
 */
export function recordCacheHit(namespace: string): void {
  const client = getRedisClient();
  if (!client) return;
  const key = `${METRICS_PREFIX}:${namespace}:hits`;
  client.incr(key).catch(() => {});
  client.expire(key, METRICS_TTL).catch(() => {});
}

/**
 * Record a cache miss and the time spent fetching from DB.
 */
export function recordCacheMiss(namespace: string, fetchMs: number): void {
  const client = getRedisClient();
  if (!client) return;
  const missKey = `${METRICS_PREFIX}:${namespace}:misses`;
  const fetchMsKey = `${METRICS_PREFIX}:${namespace}:fetchMs`;
  client.incr(missKey).catch(() => {});
  client.expire(missKey, METRICS_TTL).catch(() => {});
  client.incrby(fetchMsKey, Math.round(fetchMs)).catch(() => {});
  client.expire(fetchMsKey, METRICS_TTL).catch(() => {});
}

/**
 * Snapshot of all cache metrics. Reads from Redis via SCAN + MGET.
 * Only called by the admin endpoint, not on hot path.
 */
export async function getCacheMetricsSnapshot(): Promise<
  Record<string, { hits: number; misses: number; totalFetchMs: number; hitRate: string; avgFetchMs: string }>
> {
  const client = getRedisClient();
  if (!client) return {};

  // Collect all metric keys
  const keys: string[] = [];
  const stream = client.scanStream({ match: `${METRICS_PREFIX}:*`, count: 200 });
  for await (const batch of stream) {
    keys.push(...(batch as string[]));
  }

  if (keys.length === 0) return {};

  const values = await client.mget(...keys);
  const raw = new Map<string, number>();
  for (let i = 0; i < keys.length; i++) {
    raw.set(keys[i], Number(values[i] ?? 0));
  }

  // Group by namespace
  const namespaces = new Set<string>();
  for (const key of keys) {
    // key format: cache:metrics:{namespace}:{hits|misses|fetchMs}
    const parts = key.replace(`${METRICS_PREFIX}:`, '').split(':');
    parts.pop(); // remove metric type suffix
    namespaces.add(parts.join(':'));
  }

  const result: Record<string, { hits: number; misses: number; totalFetchMs: number; hitRate: string; avgFetchMs: string }> = {};
  for (const ns of namespaces) {
    const hits = raw.get(`${METRICS_PREFIX}:${ns}:hits`) ?? 0;
    const misses = raw.get(`${METRICS_PREFIX}:${ns}:misses`) ?? 0;
    const totalFetchMs = raw.get(`${METRICS_PREFIX}:${ns}:fetchMs`) ?? 0;
    const total = hits + misses;
    result[ns] = {
      hits,
      misses,
      totalFetchMs,
      hitRate: total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : 'N/A',
      avgFetchMs: misses > 0 ? `${(totalFetchMs / misses).toFixed(1)}ms` : 'N/A',
    };
  }
  return result;
}
```

**Integration into `getCacheOrFetch`** (cache-service.ts):

```typescript
import { recordCacheHit, recordCacheMiss } from './cache-metrics';

// On cache hit (after Redis/memory returns data):
recordCacheHit(options.namespace ?? 'default');

// On cache miss (wrap the fetch function):
const start = Date.now();
const result = await fetchFn();
recordCacheMiss(options.namespace ?? 'default', Date.now() - start);
```

Both `recordCacheHit` and `recordCacheMiss` are **fire-and-forget** (no await). They never block the request path. If Redis is down, they silently no-op.

**Expose via internal endpoint:** `apps/web/src/app/api/internal/cache-stats/route.ts`

```typescript
import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { getCacheMetricsSnapshot } from '@babylon/api/cache/cache-metrics';

export const GET = withErrorHandling(async (request) => {
  await authenticate(request); // Require auth for internal endpoints
  const metrics = await getCacheMetricsSnapshot();
  return successResponse(metrics);
});
```

#### Why This Works on Serverless

- Redis INCRBY is atomic, O(1), and shared across all Vercel function instances
- No in-memory state to lose on cold start
- 24h TTL on metric keys provides auto-cleanup (no unbounded growth)
- `recordCacheHit`/`recordCacheMiss` are fire-and-forget — zero latency impact on requests
- `getCacheMetricsSnapshot()` uses SCAN (O(N) on metric keys only, ~50 keys max) — acceptable for an admin endpoint

#### Testing

**Unit test:** `packages/testing/unit/cache-metrics.test.ts`

```
describe('cache metrics (Redis-backed)')
  ✓ recordCacheHit increments Redis key (namespace:hits)
  ✓ recordCacheMiss increments both misses and fetchMs keys
  ✓ getCacheMetricsSnapshot aggregates by namespace
  ✓ computes correct hit rate percentage
  ✓ computes correct average fetch time
  ✓ returns empty object when Redis unavailable (graceful degradation)
  ✓ metric keys have 24h TTL (auto-cleanup)
  ✓ fire-and-forget calls don't throw on Redis errors
```

---

## Implementation Order

```
Phase 1 (Correctness):
  WI-3: Fix missing cache invalidations (post deletion + trade enrichment)
    ↓
Phase 2 (Observability — ship before perf changes so we have a baseline):
  WI-7: Redis-backed cache metrics
    ↓
Phase 3 (Performance — Core):
  WI-1: Shared engagement count service
    ↓
Phase 4 (Performance — Tuning, use WI-7 metrics to validate):
  WI-4: Increase TTLs
  WI-2: Cache feed event aggregates longer (careful: 4 code locations must change atomically)
    ↓
Phase 5 (Cleanup):
  WI-5: Filter test users in SQL
  WI-6: Scope follow invalidation
```

**Phase 1** ships first because it fixes bugs visible to users (deleted posts in feeds, stale position badges).

**Phase 2** ships next — gives us baseline cache hit/miss data before making performance changes. Without this, we can't measure impact of Phases 3-4.

**Phase 3** is the highest-impact performance change. Compare WI-7 metrics before/after to quantify the reduction in DB queries.

**Phase 4** uses WI-7 metrics to validate TTL increases are actually improving hit rates. WI-2 requires extra care — it changes a typed tuple in 4 locations (see WI-2 details). Deploy and verify TypeScript compiles before merge.

**Phase 5** is cleanup — lower impact, can ship anytime.

---

## Validation Checklist

Before merging each work item:

```bash
# 1. Quality gate (mandatory)
bun run check          # Biome format + lint
bun run typecheck      # TypeScript
bun run lint           # Zero warnings

# 2. Unit tests
bun run test:unit

# 3. Feed-specific tests
bun test apps/web/src/app/api/feed/
bun test packages/testing/unit/narrative-enrichment-cache.test.ts
bun test packages/testing/unit/narrative-feed-algorithms.test.ts

# 4. Integration tests (touch DB/cache)
bun run test:integration

# 5. Build
bun run build
```

---

## Files Modified Per Work Item

| WI | New Files | Modified Files |
|----|-----------|---------------|
| **WI-1** | `packages/api/src/cache/engagement-cache.ts`, `packages/testing/unit/engagement-cache.test.ts` | `for-you/pipeline.ts`, `stories/pipeline.ts`, `narrative/route.ts`, `hot/route.ts`, `posts/[id]/like/route.ts`, `posts/[id]/share/route.ts`, `packages/api/src/index.ts` (re-export) |
| **WI-2** | `packages/testing/unit/feed-event-aggregates-cache.test.ts` | `for-you/pipeline.ts` |
| **WI-3** | `packages/testing/unit/post-deletion-cache-invalidation.test.ts`, `packages/testing/unit/trade-narrative-enrichment.test.ts` | `posts/[id]/route.ts`, `predictions/[id]/buy/route.ts`, `predictions/[id]/sell/route.ts` |
| **WI-4** | (none) | `cache-service.ts`, `for-you/pipeline.ts`, `hot/route.ts`, `stories/route.ts` (NOT pipeline.ts — pipeline has no TTL) |
| **WI-5** | `packages/testing/unit/test-user-filtering.test.ts` | `database-service.ts`, `cached-database-service.ts` |
| **WI-6** | (none) | `cached-database-service.ts` |
| **WI-7** | `packages/api/src/cache/cache-metrics.ts` (Redis-backed, not in-memory), `apps/web/src/app/api/internal/cache-stats/route.ts`, `packages/testing/unit/cache-metrics.test.ts` | `cache-service.ts` |

---

## Expected Impact

| Metric | Before | After (estimated) |
|--------|--------|-------------------|
| Engagement DB queries per feed cycle | 4-6 independent CTEs | 0-1 (cache hit from shared service) |
| Feed event aggregation frequency | Every 30s per user | Every 5min per user |
| Post list cache miss rate | ~every 45s | ~every 120s (with invalidation) |
| Hot feed DB queries | Every 60s | Every 180s |
| Test user extra DB queries | 1 per feed request | 1 per 5 minutes (cached) |
| Follow invalidation blast radius | Global (all users) | 2 users (follower + target) |
| Cache observability | Logs only | Redis-backed metrics with hit rates + avg miss latency per namespace (survives cold starts, shared across instances) |
