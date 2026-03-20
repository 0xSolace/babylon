# User Lookup Optimization Roadmap

## Completed ✅

### Phase 1: Query Optimization
- ✅ Classification-based single query routing
- ✅ Removed inefficient OR condition
- ✅ Early returns for empty/null identifiers

### Phase 2: Caching Infrastructure
- ✅ Redis caching with unified namespace
- ✅ Negative caching implementation
- ✅ Cache key generation helpers

### Phase 3: Cache Invalidation
- ✅ Invalidation helper method
- ✅ Comprehensive write path coverage

### Phase 4: Profile Route Optimization
- ✅ Refactored `/api/users/[userId]/profile` to use `findUserByIdentifierWithSelect`
- ✅ Eliminated OR condition in profile route query
- ✅ Improved cache utilization (full object caching)
- ✅ All 31 fields correctly mapped to Drizzle column references
- ✅ Type assertion added for TypeScript compatibility
- ✅ Code comments with WHYs added

### Phase 5: Testing & Validation
- ✅ TypeScript compilation verified
- ✅ Code review and audit completed
- ✅ Profile route implementation audited

### Phase 6: Shared classification + engine OR elimination
- ✅ `resolveUserIdentifierKind` lives in `@babylon/shared` (`user-identifier.ts`)
- ✅ `user-lookup.ts` imports shared helper (no duplicate logic)
- ✅ `markDirty` / `recomputeTotalPoints` / `calculatePortfolioBreakdown` use single-branch `WHERE` + case-insensitive username SQL
- ✅ Unit tests for classifier + routing smoke tests in engine-related test files
- ✅ Docs: `USER_IDENTIFIER.md`, `TOTAL_POINTS_OPTIMIZATION.md`, `PORTFOLIO_BREAKDOWN_OPTIMIZATION.md`, engine `services/README.md`, root changelog

## In Progress / Pending

### Integration Testing
- [x] Unit tests for classification logic (all identifier types, edge cases) — `user-identifier.test.ts`
- [ ] Integration tests for cache hits/misses
- [ ] Integration tests for invalidation scenarios
- [ ] Performance benchmarks (query latency, cache hit rate)

### Production Validation
- [ ] Deploy to staging and measure query latency improvement
- [ ] Verify `EXPLAIN (ANALYZE)` shows index scans for all branches
- [ ] Monitor cache hit rate in production
- [ ] Set up alerts for cache miss rate and query latency

## Future Enhancements

### Short Term (Next Sprint)

#### 1. Cache Warming
**What**: Pre-populate cache for frequently accessed users
**Why**: Reduce cold cache misses for popular users
**How**: 
- Track user access frequency in Redis
- Background job warms cache for top N users
- Could use existing user stats data

**Trade-offs**:
- ✅ Reduces cache misses for popular users
- ❌ Adds complexity and background job overhead
- ❌ May warm users who don't need it

#### 2. Adaptive TTL
**What**: Adjust cache TTL based on access patterns
**Why**: Frequently accessed users could have longer TTL, reducing database load
**How**:
- Track access frequency per cache key
- Increase TTL for frequently accessed users (up to max, e.g., 15 minutes)
- Decrease TTL for rarely accessed users (down to min, e.g., 1 minute)

**Trade-offs**:
- ✅ Optimizes cache efficiency
- ❌ Adds complexity to cache service
- ❌ May cause stale data for infrequently accessed users

### Medium Term (Next Quarter)

#### 3. Query Plan Monitoring
**What**: Automated monitoring of query plans to detect regressions
**Why**: Catch query plan changes that could cause performance degradation
**How**:
- Periodic `EXPLAIN (ANALYZE)` runs on each classification branch
- Alert if plan changes from index scan to sequential scan
- Store plan history for trend analysis

**Trade-offs**:
- ✅ Early detection of performance regressions
- ❌ Adds monitoring overhead
- ❌ Requires database access for plan analysis

#### 4. Cache Metrics Dashboard
**What**: Real-time dashboard showing cache performance metrics
**Why**: Visibility into cache effectiveness helps optimize TTL and identify issues
**How**:
- Track cache hits/misses per identifier type
- Track cache hit rate over time
- Track query latency distribution (cache hits vs misses)
- Display in monitoring dashboard (Grafana, etc.)

**Trade-offs**:
- ✅ Better observability
- ❌ Requires metrics infrastructure
- ❌ Adds instrumentation overhead

#### 5. Batch Lookup Optimization
**What**: Optimize lookups when multiple identifiers are requested
**Why**: Some code paths look up multiple users - could batch cache operations
**How**:
- Use `getCacheBatchOrFetch` for multiple identifier lookups
- Single Redis MGET for cache, single database query for misses
- Already exists in cache service, just needs to be applied here

**Trade-offs**:
- ✅ Reduces Redis round-trips
- ✅ Reduces database queries for batch lookups
- ❌ Requires identifying batch lookup patterns
- ❌ Adds complexity to lookup functions

### Long Term (Future Consideration)

#### 6. Read Replica Routing
**What**: Route read queries to read replica when available
**Why**: Further reduce load on primary database
**How**:
- Use `DATABASE_READ_REPLICA_URL` when configured
- Route identifier lookups to read replica
- Keep writes on primary

**Trade-offs**:
- ✅ Reduces primary database load
- ❌ Requires read replica infrastructure
- ❌ Must handle replication lag (read-after-write consistency)
- ⚠️ **Note**: Already planned in `CLAUDE.md` - consider `readAfterWrite()` helper

#### 7. Cache Compression
**What**: Compress large user objects in cache
**Why**: Reduce Redis memory usage for users with large profile data
**How**:
- Use compression (gzip, lz4) for cached user objects
- Decompress on cache hit
- Trade CPU for memory

**Trade-offs**:
- ✅ Reduces Redis memory usage
- ❌ Adds CPU overhead for compression/decompression
- ❌ Adds complexity to cache service
- ⚠️ **Note**: User objects are relatively small - may not be worth it

#### 8. Distributed Cache Invalidation
**What**: Invalidate cache across multiple application instances
**Why**: When one instance updates a user, other instances should invalidate their cache
**How**:
- Use Redis pub/sub for cache invalidation events
- Publish invalidation events when user updates
- Subscribe to events and invalidate local cache

**Trade-offs**:
- ✅ Ensures cache consistency across instances
- ❌ Adds complexity (pub/sub infrastructure)
- ❌ May not be needed if TTL is short enough (5 minutes)

## Decision Log

### Why Classification in TypeScript vs Database?

**Decision**: Classify in TypeScript, route to single query

**Alternatives considered**:
1. **UNION ALL in CTE**: Still requires multiple queries, planner overhead
2. **Sequential fallback**: Try id, then privyId, then username - requires up to 3 queries
3. **Database-side classification**: Would require custom function, less flexible

**Why chosen**: Pattern matching in TypeScript is fast (~0.1ms), routes to optimal index immediately, gives predictable query plans.

### Why Unified Namespace vs Separate Namespaces?

**Decision**: Unified namespace (`user:identifier`) with prefixed keys

**Alternatives considered**:
1. **Separate namespaces**: `user:id`, `user:privyId`, `user:username`
2. **No namespace**: Just use prefixed keys directly

**Why chosen**: Reduces desync risk - single namespace means we can't accidentally miss invalidating a namespace. Simpler mental model for developers.

### Why Cache Full User Object in `findUserByIdentifierWithSelect`?

**Decision**: Cache full user object, filter in memory

**Alternatives considered**:
1. **Cache per-select-pattern**: Different cache entries for different field combinations
2. **No caching for this function**: Only cache in `findUserByIdentifier`

**Why chosen**: Maximizes cache hits across different select patterns. In-memory filtering is fast (microseconds) compared to database query (milliseconds). Trade-off: slightly more memory per cache entry, but significantly more cache hits.

### Why 5-Minute TTL?

**Decision**: Use `DEFAULT_TTLS.USER` (300 seconds / 5 minutes)

**Alternatives considered**:
1. **Shorter TTL (1-2 minutes)**: Fresher data, but lower cache hit rate
2. **Longer TTL (10-15 minutes)**: Higher cache hit rate, but potentially staler data

**Why chosen**: Balances freshness vs cache hit rate. 5 minutes is acceptable for user profile data (doesn't change frequently). Combined with invalidation on writes, ensures cache stays fresh.

## Performance Targets

### Current (Post-Optimization)
- Query latency (cache miss): <20ms
- Query latency (cache hit): <10ms
- Cache hit rate: >80%
- Database query reduction: >80%

### Stretch Goals
- Query latency (cache miss): <10ms
- Query latency (cache hit): <5ms
- Cache hit rate: >90%
- Database query reduction: >90%

## Success Metrics

### Query Performance
- [ ] P95 query latency <20ms (cache misses)
- [ ] P95 query latency <10ms (cache hits)
- [ ] P99 query latency <50ms (cache misses)
- [ ] P99 query latency <20ms (cache hits)

### Cache Effectiveness
- [ ] Cache hit rate >80%
- [ ] Cache miss rate <20%
- [ ] Negative cache hit rate tracked separately

### Database Load
- [ ] `findUserByIdentifier` query count reduced by >80%
- [ ] Total database time for user lookups reduced by >80%
- [ ] No query plan regressions (all branches use index scans)

### Reliability
- [ ] Zero cache desync incidents
- [ ] All write paths have invalidation (verified in code review)
- [ ] Cache invalidation coverage >99% (all write paths covered)
