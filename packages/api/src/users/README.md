# User Lookup Optimization

## Overview

This document describes the performance optimization applied to user lookup functions (`findUserByIdentifier` and `findUserByIdentifierWithSelect`) to address a critical performance bottleneck.

## Problem Statement

### Original Performance Issue

- **Query**: `SELECT "id" FROM "User" WHERE ("User"."id" = $1 OR "User"."privyId" = $2 OR lower("User"."username") = lower($3)) LIMIT $4`
- **Execution count**: 4,352 times
- **Average latency**: 668ms per call
- **Total database time**: 2,908 seconds (48+ minutes)

### Root Cause

The original implementation used a single query with an `OR` condition checking three different columns (`id`, `privyId`, `lower(username)`). PostgreSQL's query planner struggles to optimize this pattern because:

1. **OR forces planner to consider all predicates**: Even though only one branch can match for any given identifier, the planner must evaluate all three predicates
2. **Prevents optimal index usage**: Often results in sequential scans or bitmap index scans that merge multiple indexes (slower than single index scan)
3. **No caching layer**: Every lookup hit the database, even for repeated lookups

## Solution

### Two-Part Optimization

1. **Query Optimization**: Classification-based routing to single indexed query
2. **Redis Caching**: 5-minute TTL cache with negative caching

### Why This Approach?

**Query optimization (classification-based routing):**
- **WHY not UNION ALL?** UNION still requires multiple queries. Classification routes to exactly one query.
- **WHY not sequential fallback?** Sequential queries (try id, then privyId, then username) would require up to 3 queries. Classification determines the correct path in TypeScript (microseconds) and routes to one query.
- **WHY classification in TypeScript?** Pattern matching in TypeScript is fast (~0.1ms) compared to database query overhead. By classifying first, we route to the optimal index immediately.

**Caching:**
- **WHY Redis?** Existing infrastructure, proven at scale, supports TTL and invalidation patterns
- **WHY negative caching?** Prevents repeated database queries for non-existent users. Safe as long as we invalidate on user creation (which we do).
- **WHY unified namespace?** Reduces desync risk - single namespace means we can't accidentally miss invalidating a namespace. Simpler mental model for developers.

## Implementation Details

### Where classification lives (`@babylon/shared`)

**WHY move `resolveUserIdentifierKind` out of this module?**

- **Single source of truth**: The same rules must drive `@babylon/api` lookups and `@babylon/engine` hot queries (`markDirty`, `recomputeTotalPoints`, `calculatePortfolioBreakdown`). Duplicating the helper in two packages guarantees drift and subtle bugs.
- **Pure logic, no framework**: Classification is regex + `isValidSnowflakeId` — safe for `shared` and usable anywhere without pulling `@babylon/api` into engine.
- **Consistent SQL branches**: Every caller should map `id` → PK, `privyId` → unique index, `username` → `lower(username) = lower(input)` for `idx_users_username_lower`.

**Imports**:

- API: `import { resolveUserIdentifierKind } from '@babylon/shared'` in `user-lookup.ts` (used by `findUserByIdentifier` / `findUserByIdentifierWithSelect`).
- Engine: same import in `total-points-service.ts` and `portfolio-breakdown.ts`.

**Deep dive**: `packages/shared/src/utils/USER_IDENTIFIER.md`. Engine-specific write-ups: `TOTAL_POINTS_OPTIMIZATION.md` and `PORTFOLIO_BREAKDOWN_OPTIMIZATION.md` under `packages/engine/src/services/`.

### Classification Logic

The `resolveUserIdentifierKind` function classifies identifiers in efficiency order:

1. **Primary key (id)**: Fastest - direct PK index access
   - UUID pattern: `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
   - Snowflake pattern: 15-19 digits AND `isValidSnowflakeId` validation
   - **WHY both checks for snowflake?** Length check (15-19 digits) prevents misclassifying short numeric usernames (3-14 digits) as snowflakes. `isValidSnowflakeId` validates the structure.

2. **Unique index (privyId)**: Very fast - unique index, similar to PK
   - Pattern: `identifier.startsWith('did:privy:')`
   - **WHY startsWith?** Very specific pattern with no ambiguity. Simple string check is fastest.

3. **Functional index (username)**: Slower - functional index on `lower(username)`
   - Default: Everything else
   - **WHY default to username?** Conservative approach - if it doesn't match id or privyId patterns, it's most likely a username. Database will reject invalid usernames anyway.

### Cache Strategy

**Unified namespace with prefixed keys:**
- Namespace: `user:identifier` (single unified namespace)
- Cache keys:
  - `id:{userId}` for ID lookups
  - `privy:{privyId}` for Privy ID lookups
  - `username:{lowercaseUsername}` for username lookups

**WHY unified namespace instead of separate namespaces?**
- **Reduces desync risk**: With 3 separate namespaces (`user:id`, `user:privyId`, `user:username`), you must remember to invalidate in all 3 places. If you forget one, that namespace has stale data until TTL expires.
- **Unified namespace = atomic invalidation**: With one namespace, a single helper call can invalidate all identifier caches for a user. Even if you forget to call the helper in one code path, when you DO call it, everything gets invalidated.
- **Simpler mental model**: "invalidate identifier caches" means one namespace, not "remember to invalidate in 3 places"

**WHY prefixed keys?**
- Makes cache keys self-documenting (`id:123` vs just `123`)
- Enables pattern-based invalidation if needed (e.g., `user:identifier:id:*`)
- Still uses classification - classification determines the prefix

### Cache Invalidation

**Critical principle**: All database writes and state changes that affect user identifiers must invalidate cache.

**Invalidation points:**
1. User profile update (`update-profile/route.ts`) - when username changes
2. User signup (`signup/route.ts`) - when user is created (clears negative cache)
3. Minimal user creation (`/api/users/me`) - when first-time auth creates user
4. Privy identity sync (`syncMissingPrivyIdentityFields`) - when privyId changes
5. Onchain registration (`processOnchainRegistration`) - when user created or username updated
6. Ensure user (`ensure-user.ts`) - when user created or username/privyId updated
7. Auto-link flow (`/api/users/me`) - when privyId updated during auto-linking

**WHY invalidate both old and new values?**
- Old values: When username changes from "alice" to "bob", old cache key `username:alice` must be invalidated
- New values: New cache key `username:bob` should be invalidated so it gets refreshed on next lookup
- This ensures cache stays in sync with database state

**WHY invalidate on user creation?**
- Clears negative cache entries (cached null results for non-existent users)
- Critical for signup flows - without invalidation, new users can't be found immediately after creation

## Performance Impact

### Query Optimization (without cache)

- **Index usage**: Single query per request, using optimal index based on classification
- **Latency reduction**:
  - ID lookup: ~1-5ms (vs 668ms, ~99% reduction)
  - PrivyId lookup: ~1-5ms (vs 668ms, ~99% reduction)
  - Username lookup: ~5-20ms (vs 668ms, ~97% reduction)
- **Classification overhead**: Negligible (~0.1ms pattern matching in TypeScript)

### Caching (combined with query optimization)

- **Cache hit rate**: Assuming 80% cache hit rate (conservative), reduces DB queries from 4,352 to ~870
- **Latency reduction**:
  - Cache hits: <10ms (vs 668ms original, ~98% reduction)
  - Cache misses: <20ms (vs 668ms original, ~97% reduction)
- **Database load**: Significant reduction in User table queries, freeing capacity for other operations

## Usage

### Basic Lookup

```typescript
import { findUserByIdentifier } from '@babylon/api';

// Lookup by any identifier type (ID, privyId, or username)
const user = await findUserByIdentifier('alice');
if (user) {
  console.log(user.displayName);
}
```

### Lookup with Field Selection

```typescript
import { findUserByIdentifierWithSelect } from '@babylon/api';
import { users } from '@babylon/db';

// Lookup with specific fields (caches full user, filters in memory)
const user = await findUserByIdentifierWithSelect('alice', {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
});
```

**WHY use `findUserByIdentifierWithSelect` for large field selections?**
- **Better cache utilization**: Caches full user object, maximizing cache hits across different callers
- **Eliminates OR condition**: Uses classification-based routing (no OR in generated SQL)
- **In-memory filtering**: Fast (microseconds) compared to database queries (milliseconds)
- **When to use**: When selecting many fields (10+) or when you want to maximize cache reuse

**WHY use `findUserByIdentifier` with `_select` for small field selections?**
- **Simpler API**: `Record<string, boolean>` is easier to use than Drizzle column references
- **When to use**: When selecting few fields (1-5) and cache reuse is less important

### Cache Invalidation

```typescript
import { cachedDb } from '@babylon/api';

// On username change
await cachedDb.invalidateUserIdentifierCaches(
  { id: userId, username: newUsername },
  { username: oldUsername } // old value
);

// On user creation (clears negative cache)
await cachedDb.invalidateUserIdentifierCaches({
  id: newUser.id,
  privyId: newUser.privyId,
  username: newUser.username,
});
```

## Testing

### Unit Tests

Test classification logic for all identifier types:
- UUID format
- Snowflake IDs (15-19 digits)
- Privy DIDs (`did:privy:...`)
- Usernames (various formats)
- Edge cases (empty strings, short numeric strings)

### Integration Tests

Test end-to-end lookup flow:
- Cache hits and misses
- Invalidation scenarios
- Case-insensitive username matching
- Negative caching (non-existent users)

### Performance Validation

After deployment, verify:
- Query latency reduction (should see <20ms for misses, <10ms for hits)
- Cache hit rate (target: >80%)
- Database query count reduction (check `pg_stat_statements`)
- `EXPLAIN (ANALYZE)` shows index scans for all branches

## Monitoring

### Key Metrics

1. **Cache hit rate**: Should be >80% for optimal performance
2. **Query latency**: P95 should be <20ms for misses, <10ms for hits
3. **Database query count**: Should see ~80% reduction in `findUserByIdentifier` queries
4. **Cache desync incidents**: Monitor for stale data issues

### Alerts

Set up alerts for:
- Cache miss rate >30% (indicates cache issues)
- Query latency p95 >50ms (indicates query plan regression)
- Redis memory usage (cache growth)

## Troubleshooting

### Cache Desync

**Symptoms**: User updates not reflected in lookups, stale data returned

**Causes**:
- Missing invalidation call in a write path
- Invalidation called before database update
- Wrong cache key format (case mismatch for usernames)

**Fix**: Ensure all write paths call `invalidateUserIdentifierCaches` AFTER database update, with correct old/new values.

### High Cache Miss Rate

**Symptoms**: Cache hit rate <50%, high database load

**Causes**:
- Redis unavailable or connection issues
- Cache TTL too short
- High rate of unique identifier lookups (low repeat rate)

**Fix**: Check Redis connectivity, consider increasing TTL if appropriate, verify cache is actually being used.

### Query Latency Regression

**Symptoms**: Query latency >50ms even with cache misses

**Causes**:
- Index missing or corrupted
- Query plan regression (sequential scan instead of index scan)
- Database load issues

**Fix**: Run `EXPLAIN (ANALYZE)` to verify index usage, check index health, investigate database load.

## Future Improvements

See `ROADMAP.md` for potential enhancements:
- Cache warming for frequently accessed users
- Adaptive TTL based on access patterns
- Metrics and observability improvements
- Query plan monitoring

## Profile Route Optimization

### Overview

The `/api/users/[userId]/profile` route was optimized to eliminate OR conditions and improve cache utilization by using `findUserByIdentifierWithSelect` instead of `findUserByIdentifier` with `_select`.

**Why this optimization?**
- The route was executing a query with an OR condition selecting 31 user fields
- Using `findUserByIdentifier` with `_select` caches only selected fields, reducing cache hit rate
- Different callers requesting different field combinations created separate cache entries

**Solution**:
- Refactored to use `findUserByIdentifierWithSelect` which:
  1. Eliminates OR condition (classification-based routing)
  2. Caches full user object (maximizes cache reuse)
  3. Filters requested fields in memory (fast)

**Implementation details**:
- Converted all 31 fields from `Record<string, boolean>` to Drizzle select object
- Added type assertion to match runtime return type
- All fields verified to exist in users schema

**Performance impact**:
- Eliminates OR condition: Single indexed query per request
- Better cache hit rate: Full object caching means cache entries are shared
- Faster response times: Cache hits <10ms, cache misses <20ms

See `PROFILE_ROUTE_AUDIT.md` for detailed audit of the implementation.

## Related Documentation

- [Cache Service Documentation](../cache/cache-service.ts) - Cache infrastructure details
- [Cached Database Service](../cache/cached-database-service.ts) - Invalidation helpers
- [Implementation Audit](../../../../IMPLEMENTATION_AUDIT.md) - Detailed audit of initial implementation
- [Profile Route Audit](../../../../PROFILE_ROUTE_AUDIT.md) - Detailed audit of profile route optimization
