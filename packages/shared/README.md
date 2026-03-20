# @babylon/shared

Shared types, constants, and utilities for Babylon. This package exports only client-safe code that can run in the browser.

## Overview

This package provides:
- **Types**: TypeScript interfaces and types used across packages
- **Constants**: Shared configuration and constants
- **Utilities**: Pure functions and helpers that don't depend on server-only code
- **Game Types**: Actor, FeedPost, Question, and other game-related types
- **Validation**: Zod schemas for runtime validation

## Key Utilities

### User Identifier Classification

**Location**: `packages/shared/src/utils/user-identifier.ts`

**Purpose**: Classifies user identifier strings to determine which database index to use for optimal query performance.

**Why This Exists**: PostgreSQL's query planner struggles with OR conditions on multiple columns. By classifying the identifier type in TypeScript first, we route to exactly one indexed query, enabling 95%+ query latency reduction.

**Usage**:
```typescript
import { resolveUserIdentifierKind } from '@babylon/shared';

const kind = resolveUserIdentifierKind('did:privy:abc123');
// Returns 'privyId'
```

**Documentation**: See [`packages/shared/src/utils/USER_IDENTIFIER.md`](./src/utils/USER_IDENTIFIER.md) for comprehensive documentation.

**Performance Impact**: Enables optimization of high-frequency queries:
- `markDirty()`: 930.9ms → <50ms average (95%+ reduction)
- `recomputeTotalPoints()`: OR condition → single indexed query
- `calculatePortfolioBreakdown()`: OR condition → single indexed query

### Snowflake ID Generation

**Location**: `packages/shared/src/utils/snowflake.ts`

**Purpose**: Generate and validate snowflake IDs (64-bit unique identifiers with timestamp encoding).

**Usage**:
```typescript
import { SnowflakeGenerator, isValidSnowflakeId } from '@babylon/shared';

const generator = new SnowflakeGenerator(workerId);
const id = await generator.generate();
const isValid = isValidSnowflakeId(id);
```

### Formatting Utilities

**Location**: `packages/shared/src/utils/format.ts`

**Purpose**: Currency formatting, number formatting, and other display utilities.

### Logger

**Location**: `packages/shared/src/utils/logger.ts`

**Purpose**: Structured logging that works in both browser and server environments.

## Server-Only Utilities

**Note**: Server-only utilities are in `@babylon/api`:
- **API Keys**: `import { generateApiKey, hashApiKey, verifyApiKey } from '@babylon/api'`
- **IP Utils**: `import { getHashedClientIp, getClientIp } from '@babylon/api'`
- **Token Counter**: `import { countTokens, countTokensSync } from '@babylon/api'`
- **Storage**: `import { getStorageClient } from '@babylon/api'`
- **Monitoring**: `import { performanceMonitor } from '@babylon/api'`

## Package Structure

```
packages/shared/
├── src/
│   ├── constants/          # Shared constants
│   ├── types/              # TypeScript types
│   ├── game-types/         # Game-related types
│   ├── utils/              # Utility functions
│   │   ├── user-identifier.ts  # Identifier classification
│   │   ├── snowflake.ts        # Snowflake ID generation
│   │   ├── format.ts           # Formatting utilities
│   │   └── ...
│   └── ...
├── README.md               # This file
└── ROADMAP.md              # Future plans
```

## Documentation

- **User Identifier Classification**: [`src/utils/USER_IDENTIFIER.md`](./src/utils/USER_IDENTIFIER.md)
- **Roadmap**: [`ROADMAP.md`](./ROADMAP.md)

## Related Optimizations

The user identifier classification utility enables query optimizations across the codebase:

- **`findUserByIdentifier`** (`@babylon/api`): User lookup with Redis caching
- **`markDirty`** (`@babylon/engine`): Mark user points as dirty (UPDATE)
- **`recomputeTotalPoints`** (`@babylon/engine`): Recompute user total points (SELECT)
- **`calculatePortfolioBreakdown`** (`@babylon/engine`): Calculate portfolio breakdown (SELECT)

All of these queries were optimized from OR conditions to single indexed queries, resulting in 95%+ latency reduction.

**Engine-focused write-ups** (points + portfolio): [`../engine/src/services/README.md`](../engine/src/services/README.md).

## Contributing

When adding new utilities to this package:

1. **Ensure client-safety**: No Node.js-specific APIs, no database connections, no server-only dependencies
2. **Add documentation**: Include JSDoc comments with "WHY" explanations
3. **Add tests**: Unit tests in `packages/testing/unit/shared/`
4. **Update exports**: Add to `src/utils/index.ts` and `src/index.ts` if needed
