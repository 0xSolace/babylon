# Changelog

All notable changes to the Babylon project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Performance

- **Optimized user identifier queries**: Eliminated OR conditions in three high-frequency queries:
  - **Why**: OR conditions prevent optimal index usage, causing sequential scans or inefficient bitmap index merges. PostgreSQL's query planner struggles with OR conditions on multiple columns.
  - **Solution**: Classification-based routing - classify identifier type in TypeScript first (<0.01ms), then route to exactly one indexed query (PK → unique → functional).
  - **Performance Impact**:
    - `markDirty()` UPDATE query: 39,782 executions, 930.9ms → <50ms average (95%+ reduction)
    - `recomputeTotalPoints()` SELECT query: Now uses single indexed query instead of OR condition (<20ms expected)
    - `calculatePortfolioBreakdown()` SELECT query: Now uses single indexed query instead of OR condition (<20ms expected)
  - **Implementation**:
    - Extracted `resolveUserIdentifierKind` to `@babylon/shared` for reuse across packages
    - Single source of truth for identifier classification logic
    - Eliminates code duplication between `@babylon/api` and `@babylon/engine`
    - Classification routes to optimal index (PK → unique → functional) based on identifier type
    - Username queries use case-insensitive matching (`lower(username) = lower(identifier)`) to match functional index `idx_users_username_lower`
  - **Files changed**: 
    - `packages/shared/src/utils/user-identifier.ts` (new)
    - `packages/api/src/users/user-lookup.ts` (uses shared helper)
    - `packages/engine/src/services/total-points-service.ts` (optimized `markDirty`, `recomputeTotalPoints`)
    - `packages/engine/src/services/portfolio-breakdown.ts` (optimized `calculatePortfolioBreakdown`)
  - **Documentation**: See `packages/shared/src/utils/USER_IDENTIFIER.md`, `packages/engine/src/services/TOTAL_POINTS_OPTIMIZATION.md`, `packages/engine/src/services/PORTFOLIO_BREAKDOWN_OPTIMIZATION.md`

- **Optimized API key lastUsedAt updates with write-back cache**
  - **Why**: The `update "UserApiKey" set "lastUsedAt" = $1 where "UserApiKey"."id" = $2` query was executing 1,830 times with an average time of 63 seconds per execution, totaling 115,885 seconds of database time. This was a hot write path that overwhelmed the database with individual UPDATE queries.
  - **Solution**: Implemented write-back cache pattern using Redis. Updates now go to Redis first (fast writes), then a background flusher service batches and flushes updates to the database periodically (every 30 seconds or when 100+ updates pending).
  - **Implementation**:
    - Redis structure: Hash (`api-key:last-used:updates`) for O(1) lookup + Sorted Set (`api-key:last-used:queue`) for ordered batching
    - Updated `scheduleLastUsedUpdate()` to write to Redis instead of direct DB write
    - Created `api-key-lastused-flusher.ts` service that periodically batches updates in transactions
    - Flusher starts automatically on server startup via `instrumentation.ts`
    - Graceful shutdown flushes remaining updates
    - Fallback to direct DB write when Redis unavailable (fault tolerance)
  - **Benefits**:
    - Database load reduced by 90%+: From 1,830 individual UPDATE queries to ~18 batch transactions
    - Estimated database time: From 115,885 seconds to ~1,000-2,000 seconds
    - Fast writes: Redis writes are microseconds vs database writes (milliseconds)
    - Eventual consistency: Acceptable for `lastUsedAt` (informational field)
  - **Files changed**: `packages/api/src/utils/api-keys.ts`, `packages/api/src/utils/api-key-lastused-flusher.ts`, `apps/web/instrumentation.ts`, `packages/api/src/utils/index.ts`, `packages/api/src/index.ts`

- **Optimized database connection creation with lazy initialization**
  - **Why**: Database client objects were being created eagerly during property access (e.g., `db.user`), even when queries never executed. This caused unnecessary connection pool initialization and slower cold starts, especially in serverless environments like Vercel/Next.js.
  - **Solution**: Implemented nested lazy proxies that defer `getDbClient()` until method invocation (e.g., `db.user.findMany()`), not property access. This ensures client objects are only created when queries actually execute.
  - **Implementation**: 
    - Created `createLazyPrimaryClientProxy()` that returns lazy property proxies instead of eagerly calling `getDbClient()`
    - Created `createLazyPropertyProxy()` that defers `getDbClient()` until a method on the property is accessed
    - Updated `getReadReplicaDbClient()` to return lazy proxy when no replica configured (keeps fallback for dev)
    - Updated `createModeAwareDbProxy()` to use lazy proxy for reads without replica
    - Updated table repository proxy to use lazy proxy when no replica
  - **Benefits**:
    - Faster cold starts: No client creation on property access
    - Lower memory usage: No pool initialization until needed
    - Better for serverless: Fewer objects created per request
    - With replica configured: Reads never create write client objects
  - **Backward compatible**: All existing code works without changes (just lazy now)
  - **Files changed**: `packages/db/src/db.ts`, `packages/testing/integration/db-lazy-connection.integration.test.ts`, `CLAUDE.md`
  - **Documentation**: See `packages/db/LAZY_CONNECTION_OPTIMIZATION.md` for full details
- **Optimized user lookup queries with classification-based routing and Redis caching**
  - **Why**: The `findUserByIdentifier` function was a performance bottleneck, executing 4,352 times with an average latency of 668ms, totaling 2,908 seconds of database time. The original OR-based query prevented optimal index usage, causing sequential scans and bitmap index merges.
  - **Query optimization**: Replaced inefficient `OR` condition with classification-based single query routing. Classifies identifier type (UUID/snowflake ID, Privy DID, or username) in TypeScript, then routes to exactly one indexed query using the optimal index (PK → unique → functional). This eliminates OR overhead and gives predictable query plans with optimal index scans.
  - **Redis caching**: Added 5-minute TTL cache with negative caching (caches null results) to reduce database load by ~80%. Uses unified `user:identifier` namespace with prefixed cache keys (`id:`, `privy:`, `username:`) to reduce desync risk.
  - **Cache invalidation**: Comprehensive invalidation on all write paths (user creation, username/privyId updates) to keep cache in sync with database. Invalidates both old and new identifier values when fields change.
  - **Performance impact**: Query latency reduced from 668ms to <20ms for cache misses, <10ms for cache hits. Database load reduced by ~80% through caching. See `packages/api/src/users/README.md` for full documentation.
- **Optimized profile route query to eliminate OR condition and improve cache utilization**
  - **Why**: The `/api/users/[userId]/profile` route was executing a query with an OR condition selecting 31 user fields, preventing optimal index usage. Additionally, using `findUserByIdentifier` with `_select` caches only selected fields, reducing cache hit rate across different callers.
  - **Solution**: Refactored route to use `findUserByIdentifierWithSelect` instead of `findUserByIdentifier` with `_select`. This function uses classification-based routing (eliminates OR condition) and caches the full user object (maximizes cache reuse), filtering requested fields in memory.
  - **Benefits**: 
    - Eliminates OR condition: Uses single indexed query based on identifier classification
    - Better cache utilization: Full user object caching means cache entries are shared across all callers requesting different field combinations
    - In-memory filtering: Fast (microseconds) compared to database queries (milliseconds)
    - Shares cache entries: Uses same cache keys as `findUserByIdentifier`, maximizing cache reuse
  - **Implementation**: Converted all 31 fields from `Record<string, boolean>` to Drizzle select object with `users.*` column references. Added type assertion to match runtime return type (data values, not Column objects).
  - **Files changed**: `apps/web/src/app/api/users/[userId]/profile/route.ts`

### Added

- **Agent skills generation and docs integration**
  - **Why**: We expose A2A and MCP; agents (Cursor, Claude Code, ClawHub, etc.) need a single, up-to-date reference. Hand-maintained docs drift from code; generating from source keeps skills and endpoints in sync.
  - **Script** `scripts/generate-skills-md.ts`: Reads `packages/a2a` (babylon-agent-card, executor operations) and `packages/mcp` (tool list); writes a full Agent Skills package to `skills/babylon/` (SKILL.md with frontmatter, claw.json, README).
  - **npm scripts** `skills:generate` (skills markdown), `skills:package` (full package).
  - **docs:generate** now runs the skills generator after vendor doc pulls.
- **Outbound RSS feeds**
  - **Why**: Let users and tools subscribe to Babylon content (hot posts, breaking news) in standard RSS readers without duplicating feed logic.
  - **GET /feed/rss**: RSS 2.0 feed of hot posts. Reuses `/api/feed/hot` internally so scoring, caching, and filtering stay in one place; this route only converts JSON → XML.
  - **GET /feed/breaking-news/rss**: RSS 2.0 feed of breaking news (world events, org updates, actor posts). Reuses `/api/feed/widgets/breaking-news` the same way.
  - Shared RSS builder in `apps/web/src/lib/rss.ts` (RSS 2.0 XML with escaping, RFC 1123 dates, 5‑min cache headers). **Why single helper**: Consistent escaping and cache semantics across endpoints.
  - Feed layout exposes both feeds via `<link rel="alternate" type="application/rss+xml" ...>` and Next.js `metadata.alternates` so readers and crawlers can discover them.
- **Inbound RSS config (default sources)**
  - **Why**: "Where do we put RSS feed URLs?" should have one answer; runtime enable/disable should stay in the DB so we can turn feeds off without a deploy.
  - Default list moved from `game-bootstrap-service.ts` to `packages/engine/src/config/rss-sources.ts` as `DEFAULT_RSS_SOURCES`. Bootstrap seeds `rssFeedSources` from it; engine continues to read only from DB. Add or edit default feed URLs in that config file.

- **Public API tiered rate limiting**
  - **Why**: Public GET endpoints (feeds, markets, profiles, etc.) were previously unrate-limited. That allowed unbounded anonymous traffic, increasing cost and abuse risk. We now apply tiered limits so anonymous callers are capped per IP while authenticated users and API keys get higher quotas.
  - New configs in `@babylon/api` rate limiting:
    - **Read endpoints**: 20 req/min per IP (unauthenticated), 60 req/min per user (authenticated or API key), 10 req/min shared when IP cannot be determined.
    - **Firehose (SSE)**: 5 connections/min per IP (unauthenticated), 20/min per user, 2/min shared when IP unknown.
  - New helper `publicRateLimit(request, kind?)` in `@babylon/api`: runs optional auth, then rate limits by `userId` (if authed) or by client IP (otherwise), or by shared anonymous bucket if IP is missing. Returns `{ error, user, rateLimitInfo }` so handlers can avoid double-auth and attach standard headers on success.
  - New helper `addPublicReadHeaders(response, rateLimitInfo)`: sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` and `Cache-Control: public, s-maxage=5, stale-while-revalidate=10` on successful public read responses. **Why**: Clients can respect limits before hitting 429; CDNs can cache and reduce origin load.
  - All public read-only GET routes (posts, markets, trending, reputation, registry, NFT, NPC, stats, SSE stats, onboarding check-username, questions dynamics, etc.) now call `publicRateLimit()` at the top and attach rate limit + cache headers on success. Auth-only routes (e.g. user search) still use `authenticate()` but apply `publicRateLimit()` first so unauthenticated attempts are rate limited by IP before returning 401.
  - **Null-user safety**: Endpoints that allow unauthenticated access were audited so that `user` is never dereferenced without a null check and query parameters (e.g. `userId`, `following`) are not trusted for authorization—only the authenticated identity from the token/API key is used for user-scoped data.
- **Public firehose token**
  - **GET /api/realtime/public-token**: Issues a short-lived token scoped only to public SSE channels (`feed`, `markets`, `breaking-news`, `upcoming-events`). No authentication required. **Why**: Enables read-only clients (dashboards, embeds) to subscribe to the public firehose without logging in, while keeping DMs and notifications behind the authenticated token endpoint. Rate limited with the firehose tier (5/min per IP) to prevent abuse of token issuance.

### Changed

- **GET /api/posts**: Enters the “following” feed branch only when the authenticated user matches the query `userId`; block/mute filters use `authUser?.userId` from auth, not from query params, so unauthenticated callers cannot leak or guess other users’ moderation state.
- **GET /api/registry** and **GET /api/registry/all**: Use `publicRateLimit()` instead of `optionalAuth()` alone; successful responses include rate limit and cache headers.
- **GET /api/onboarding/check-username**: Same pattern—`publicRateLimit()` supplies optional auth and rate limit info; headers attached on success.

### Developer notes

- When adding new public GET endpoints, call `publicRateLimit(request)` (or `publicRateLimit(request, 'firehose')` for SSE/token endpoints) at the start of the handler and use the returned `user` instead of calling `optionalAuth()` again. Always guard on `user` being null and call `addPublicReadHeaders(res, rateLimitInfo)` on successful responses when `rateLimitInfo` is present. See `packages/api/src/rate-limiting/README.md` for full usage and rationale.
