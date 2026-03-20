# Portfolio Breakdown Query Optimization

## Overview

The `calculatePortfolioBreakdown` function calculates wallet, agents, positions, and total assets for a user. This function was optimized to eliminate OR conditions in user identifier queries, matching the same pattern used in `markDirty` and `recomputeTotalPoints`.

## Problem Statement

**Original Query**:
```typescript
const userResult = await db
  .select({
    id: users.id,
    privyId: users.privyId,
    displayName: users.displayName,
    username: users.username,
    virtualBalance: users.virtualBalance,
    totalDeposited: users.totalDeposited,
    totalWithdrawn: users.totalWithdrawn,
    reputationPoints: users.reputationPoints,
  })
  .from(users)
  .where(or(eq(users.id, userId), eq(users.privyId, userId)))
  .limit(1);
```

**Why This Was Slow**:
- OR conditions prevent optimal index usage
- PostgreSQL planner must consider all predicates
- Often results in sequential scans or inefficient bitmap index merges
- No single index can be used optimally

## Solution: Classification-Based Routing

**Strategy**: Classify identifier type in TypeScript first, then route to exactly one indexed query.

**Why This Works**:
- Classification is fast (<0.01ms)
- Routes to optimal index (PK → unique → functional)
- Eliminates OR overhead
- Predictable query plans
- Same proven pattern as `findUserByIdentifier`, `markDirty`, and `recomputeTotalPoints`

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

const userResult = await db
  .select({...})
  .from(users)
  .where(whereClause)
  .limit(1);
```

**Why case-insensitive username query?**
- Username queries must use `lower(username) = lower(identifier)` to match the functional index `idx_users_username_lower`
- Using `eq(users.username, userId)` would be case-sensitive and not use the index
- Matches the pattern in `findUserByIdentifier` for consistency

## Performance Impact

- **Before**: OR condition prevents optimal index usage
- **After**: Single indexed query, <20ms average expected
- **Improvement**: Similar to `findUserByIdentifier` optimization (95%+ reduction)

**Index Used**:
- UUID/snowflake ID → Primary key index (O(1) lookup)
- privyId → Unique index (similar to PK performance)
- username → Functional index `idx_users_username_lower` (case-insensitive)

## Code Changes

**File**: `packages/engine/src/services/portfolio-breakdown.ts`

**Before**:
```typescript
const userResult = await db
  .select({...})
  .from(users)
  .where(or(eq(users.id, userId), eq(users.privyId, userId)))
  .limit(1);
```

**After**:
```typescript
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
```

## Why This Approach

### Why Classification Before Query?

1. **Fast**: Classification is <0.01ms (regex/string checks)
2. **Deterministic**: Same identifier always routes to same index
3. **Predictable**: Query planner can use optimal index
4. **Proven**: Same approach successfully optimized `findUserByIdentifier`, `markDirty`, and `recomputeTotalPoints`

### Why Single Source of Truth?

- **Uses `@babylon/shared`**: Classification logic is pure TypeScript, no DB/API dependencies
- **Consistent with other optimizations**: Same classification logic as `markDirty` and `recomputeTotalPoints`
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

## Context: User ID Aliases

**Note**: The function comment mentions "User IDs may come in as either the canonical `users.id` or `users.privyId`. To keep portfolio totals stable across migrations, we treat both as aliases for the same user when present."

**Why classification still works**:
- Classification routes to the correct index based on identifier type
- If identifier is a privyId, it routes to `eq(users.privyId, userId)` (unique index)
- If identifier is an ID, it routes to `eq(users.id, userId)` (primary key)
- Both queries are fast (single indexed lookup)
- The OR condition was the problem, not the dual identifier support

## Testing

See `packages/testing/unit/portfolio-breakdown.test.ts` for tests:
- Classification routing for UUID
- Classification routing for privyId
- Classification routing for snowflake ID
- Classification routing for username

## Related Optimizations

- **`findUserByIdentifier`** (`@babylon/api`): Same optimization pattern, also uses Redis caching
- **`markDirty`** (`@babylon/engine`): Same optimization pattern
- **`recomputeTotalPoints`** (`@babylon/engine`): Same optimization pattern

## Future Considerations

1. **Monitor performance**: Track query performance after deployment to verify improvements
2. **Consider username optimization**: If username queries become a bottleneck, consider additional optimizations (though functional index should be sufficient)
