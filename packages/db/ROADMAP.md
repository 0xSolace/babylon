# Database Package Roadmap

## Completed

### ✅ Lazy Connection Creation Optimization (2025-03-20)

**Problem**: Database client objects were created eagerly during property access, even when queries never executed. This caused unnecessary connection pool initialization and slower cold starts.

**Solution**: Implemented nested lazy proxies that defer `getDbClient()` until method invocation, not property access.

**Impact**:
- Faster cold starts for read-only routes
- Lower memory usage (no pool initialization until needed)
- Better for serverless environments (Vercel/Next.js)
- With replica: Reads never create write client objects

**Files**: `packages/db/src/db.ts`, `packages/testing/integration/db-lazy-connection.integration.test.ts`

**Documentation**: `packages/db/LAZY_CONNECTION_OPTIMIZATION.md`

## In Progress

None currently.

## Planned

### 🔄 Write Operations Lazy Initialization (Optional)

**Goal**: Make write operations also use lazy proxy (currently writes create client eagerly).

**Why**: Currently only reads use lazy initialization. Making writes lazy would provide additional optimization, though the benefit is smaller since writes typically execute anyway.

**Status**: Optional - measure actual benefit before implementing.

**Dependencies**: None

### 🔄 Connection Metrics

**Goal**: Add metrics to track connection creation patterns.

**Why**: Help identify optimization opportunities and monitor connection pool usage.

**Metrics to track**:
- When clients are created (property access vs method invocation)
- Connection pool utilization
- Replica vs primary usage

**Status**: Planned

**Dependencies**: Observability infrastructure

### 🔄 Configurable Lazy Behavior

**Goal**: Make lazy behavior configurable via environment variable.

**Why**: Allow disabling lazy behavior if needed for debugging or compatibility.

**Status**: Planned

**Dependencies**: None

## Future Considerations

1. **Remove `dbRead` eager fallback**: In a future major version, consider making `dbRead` also lazy for consistency
2. **Connection pool optimization**: Further optimize pool sizing based on metrics
3. **Read replica health checks**: Automatically failover if replica becomes unavailable
4. **Connection lifecycle hooks**: Allow custom logic on connection creation/destruction

## Notes

- All optimizations maintain backward compatibility
- Performance improvements are measured before and after
- Documentation is updated with each change
