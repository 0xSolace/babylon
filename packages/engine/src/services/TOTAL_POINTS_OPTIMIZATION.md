# Total Points Service Query Optimization

## Overview

The `TotalPointsService` manages the `totalPoints` column on the User table, which is calculated as: `totalPoints = wallet + positions + reputation`. Two functions were optimized to eliminate OR conditions in user identifier queries: `markDirty()` and `recomputeTotalPoints()`.

## Problem Statement

### markDirty (UPDATE Query)

**Original Performance**:
- Executions: 39,782
- Average latency: 930.9ms
- Total time: 37,034 seconds

**Original Query**:
```typescript
await db
  .update(users)
  .set({ totalPointsDirtyAt: new Date() })
  .where(or(eq(users.id, userId), eq(users.privyId, userId)));
```

**Why This Was Slow**:
- OR conditions prevent optimal index usage
- PostgreSQL planner must consider all predicates
- Often results in sequential scans or inefficient bitmap index merges
- No single index can be used optimally

### recomputeTotalPoints (SELECT Query)

**Original Query**:
```typescript
const userResult = await db
  .select({...})
  .from(users)
  .where(or(eq(users.id, userId), eq(users.privyId, userId)))
  .limit(1);
```

**Why This Was Slow**:
- Same OR condition problem as `markDirty`
- Prevents optimal index usage
- Slower than single indexed query

## Solution: Classification-Based Routing

**Strategy**: Classify identifier type in TypeScript first, then route to exactly one indexed query.

**Why This Works**:
- Classification is fast (<0.01ms)
- Routes to optimal index (PK → unique → functional)
- Eliminates OR overhead
- Predictable query plans

### Implementation

```typescript
import { resolveUserIdentifierKind } from '@babylon/shared';

// Classify identifier to determine optimal query route
const kind = resolveUserIdentifierKind(userId);

// Route to single WHERE condition based on classification
const whereClause = 
  kind === 'id' ? eq(users.id, userId) :
  kind === 'privyId' ? eq(users.privyId, userId) :
  sql`lower(${users.username}) = lower(${userId})`; // Case-insensitive for functional index

await db.update(users).set({...}).where(whereClause);
```

**Why case-insensitive username query?**
- Username queries must use `lower(username) = lower(identifier)` to match the functional index `idx_users_username_lower`
- Using `eq(users.username, userId)` would be case-sensitive and not use the index
- Matches the pattern in `findUserByIdentifier` for consistency

## Performance Impact

### markDirty (UPDATE)

- **Before**: 39,782 executions, 930.9ms average, 37,034 seconds total
- **After**: Same executions, <50ms average expected, ~2,000 seconds total
- **Improvement**: **95%+ reduction in latency**

**Index Used**:
- UUID/snowflake ID → Primary key index (O(1) lookup)
- privyId → Unique index (similar to PK performance)
- username → Functional index `idx_users_username_lower` (case-insensitive)

### recomputeTotalPoints (SELECT)

- **Before**: OR condition prevents optimal index usage
- **After**: Single indexed query, <20ms average expected
- **Improvement**: Similar to `findUserByIdentifier` optimization (95%+ reduction)

**Index Used**: Same as `markDirty` (PK → unique → functional)

## Code Changes

### markDirty

**File**: `packages/engine/src/services/total-points-service.ts`

**Before**:
```typescript
async markDirty(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ totalPointsDirtyAt: new Date() })
    .where(or(eq(users.id, userId), eq(users.privyId, userId)));
}
```

**After**:
```typescript
async markDirty(userId: string): Promise<void> {
  const kind = resolveUserIdentifierKind(userId);
  
  const whereClause = 
    kind === 'id' ? eq(users.id, userId) :
    kind === 'privyId' ? eq(users.privyId, userId) :
    sql`lower(${users.username}) = lower(${userId})`;
  
  await db
    .update(users)
    .set({ totalPointsDirtyAt: new Date() })
    .where(whereClause);
}
```

### recomputeTotalPoints

**File**: `packages/engine/src/services/total-points-service.ts`

**Before**:
```typescript
async recomputeTotalPoints(userId: string): Promise<number> {
  const userResult = await db
    .select({...})
    .from(users)
    .where(or(eq(users.id, userId), eq(users.privyId, userId)))
    .limit(1);
  // ...
}
```

**After**:
```typescript
async recomputeTotalPoints(userId: string): Promise<number> {
  const kind = resolveUserIdentifierKind(userId);
  
  const whereClause = 
    kind === 'id' ? eq(users.id, userId) :
    kind === 'privyId' ? eq(users.privyId, userId) :
    sql`lower(${users.username}) = lower(${userId})`;
  
  const userResult = await db
    .select({...})
    .from(users)
    .where(whereClause)
    .limit(1);
  // ...
}
```

## Why This Approach

### Why Classification Before Query?

1. **Fast**: Classification is <0.01ms (regex/string checks)
2. **Deterministic**: Same identifier always routes to same index
3. **Predictable**: Query planner can use optimal index
4. **Proven**: Same approach successfully optimized `findUserByIdentifier`

### Why Single Source of Truth?

- **Extracted to `@babylon/shared`**: Classification logic is pure TypeScript, no DB/API dependencies
- **Reused across packages**: `@babylon/api` and `@babylon/engine` both use it
- **Eliminates duplication**: Single implementation, single place to maintain
- **Consistent behavior**: All queries use same classification logic

### Why Ternary Chain?

- **Ensures exactly one condition**: No OR overhead
- **Type-safe**: TypeScript ensures all cases handled
- **Readable**: Clear routing logic
- **Maintainable**: Easy to extend if new identifier types added

### Why Username Fallback?

- **Edge cases**: Handles unexpected identifier formats
- **Safe**: Database query returns null if not found (no errors)
- **Consistent**: Matches behavior of `findUserByIdentifier`

## Testing

See `packages/testing/unit/total-points-service.test.ts` for tests:
- Classification routing for UUID
- Classification routing for privyId
- Classification routing for snowflake ID

## Related Optimizations

- **`findUserByIdentifier`** (`@babylon/api`): Same optimization pattern, also uses Redis caching
- **`calculatePortfolioBreakdown`** (`@babylon/engine`): Same optimization pattern

## Future Considerations

1. **Write-back cache for markDirty**: If performance still not acceptable after classification, consider write-back cache similar to `lastUsedAt` optimization
2. **Monitor performance**: Track query performance after deployment to verify improvements
3. **Consider username optimization**: If username queries become a bottleneck, consider additional optimizations (though functional index should be sufficient)
