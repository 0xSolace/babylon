# @babylon/db

Database connection management and Drizzle ORM client for Babylon.

## Overview

This package provides:
- Database connection management with lazy initialization
- Automatic read/write routing (replica for reads, primary for writes)
- Drizzle ORM client with table repositories
- JSON/memory mode for testing
- Connection pooling and retry logic

## Key Features

### Lazy Connection Creation

**Client objects are only created when queries execute, not during property access.**

This optimizes cold start performance, especially in serverless environments:

```typescript
// Property access - no client created (lazy)
const userRepo = db.user;

// Method access - client created now (when findMany is accessed)
const findManyMethod = db.user.findMany;

// Method invocation - query executes with client
const users = await db.user.findMany({ take: 10 });
```

**Why**: Faster cold starts, lower memory usage, better for Vercel/Next.js serverless.

See [LAZY_CONNECTION_OPTIMIZATION.md](./LAZY_CONNECTION_OPTIMIZATION.md) for full details.

### Automatic Read/Write Routing

The main `db` client automatically routes:
- **Reads** → read replica (if `DATABASE_READ_REPLICA_URL` configured)
- **Writes** → primary database (always)

```typescript
// Automatically routes to replica (if configured)
const users = await db.user.findMany({ take: 10 });

// Automatically routes to primary
await db.user.create({ data: { ... } });
```

**Why**: Offloads read traffic to replica, reducing load on primary database.

### Explicit Clients

For cases where you want explicit control:

- **`dbRead`**: Explicit read-only client (routes to replica, falls back to primary)
- **`dbWrite`**: Explicit write client (always uses primary)

```typescript
// Explicit read (uses replica if configured)
const users = await dbRead.user.findMany({ take: 10 });

// Explicit write (always uses primary)
await dbWrite.user.create({ data: { ... } });

// Read-after-write (ensures consistency)
await dbWrite.user.update({ where: { id }, data: { ... } });
const user = await dbWrite.user.findUnique({ where: { id } }); // ✅ Fresh data
```

**Why**: 
- `dbRead` for explicit read-only operations
- `dbWrite` for read-after-write consistency (replica might have lag)

## Usage

### Basic Usage

```typescript
import { db } from '@babylon/db';

// Read operation (uses replica if configured, lazy client creation)
const users = await db.user.findMany({ take: 10 });

// Write operation (uses primary, lazy client creation)
await db.user.create({ data: { username: 'alice' } });
```

### With Read Replica

When `DATABASE_READ_REPLICA_URL` is configured:

```typescript
// Reads use replica (no write client created)
const users = await db.user.findMany({ take: 10 });

// Writes use primary (client created lazily)
await db.user.create({ data: { ... } });
```

**Why**: With replica configured, reads never create write client objects. This is the main optimization.

### Without Read Replica (Dev)

When no replica is configured (typical dev environment):

```typescript
// Reads fall back to primary (lazy - client created on query execution)
const users = await db.user.findMany({ take: 10 });

// Writes use primary (lazy - client created on query execution)
await db.user.create({ data: { ... } });
```

**Why**: Dev environments typically have only one database. Fallback ensures reads still work, but client creation is lazy.

### Read-After-Write Consistency

After writing, use `dbWrite` for subsequent reads to ensure consistency:

```typescript
// Create user
await dbWrite.user.create({ data: { username: 'alice' } });

// Read immediately after (uses primary - ensures fresh data)
const user = await dbWrite.user.findUnique({ where: { username: 'alice' } });
```

**Why**: Replica might have replication lag. Using `dbWrite` for read-after-write ensures you get the data you just wrote.

## Configuration

### Environment Variables

- `DATABASE_URL`: Primary database connection string (required)
- `DATABASE_READ_REPLICA_URL`: Read replica connection string (optional)
- `DATABASE_POOL_MAX`: Maximum connections in primary pool (optional)
- `DATABASE_READ_REPLICA_POOL_MAX`: Maximum connections in replica pool (optional)

See `.env.example` for full configuration options.

## Performance

### Lazy Connection Creation

- **Property access**: No client creation (lazy)
- **Query execution**: Client created only when needed
- **Cold start**: Reduced overhead for read-only routes

### With Read Replica

- **Reads**: Never create write client objects
- **Writes**: Client created lazily on query execution
- **Master server**: Only handles writes (reduced load)

### Without Read Replica

- **Reads**: Use primary, but client created lazily
- **Writes**: Client created lazily on query execution
- **Master server**: Handles all traffic (same as before, but lazy)

## Testing

Integration tests verify lazy behavior:

```bash
bun run test:integration -- db-lazy-connection
```

See `packages/testing/integration/db-lazy-connection.integration.test.ts` for test scenarios.

## Documentation

- [LAZY_CONNECTION_OPTIMIZATION.md](./LAZY_CONNECTION_OPTIMIZATION.md) - Detailed optimization documentation
- [CHANGELOG.md](../../CHANGELOG.md) - Change history
- [CLAUDE.md](../../CLAUDE.md) - Database best practices

## Architecture

### Connection Management

- **Lazy initialization**: Clients created only when queries execute
- **Connection pooling**: Bounded pools to prevent connection exhaustion
- **Retry logic**: Automatic retry for transient failures
- **Session guardrails**: Timeouts and limits in production

### Proxy Pattern

The lazy behavior uses nested proxies:

1. **First proxy** (`createLazyPrimaryClientProxy`): Returns lazy property proxy on property access
2. **Second proxy** (`createLazyPropertyProxy`): Defers `getDbClient()` until method access

This ensures client is created only when `db.user.findMany()` is accessed, not when `db.user` is accessed.

## Best Practices

1. **Use `db` for most operations**: Automatic routing handles reads/writes correctly
2. **Use `dbWrite` for read-after-write**: Ensures consistency after writes
3. **Configure replica in production**: Reduces master server load
4. **Keep transactions short**: Don't hold locks during network/LLM calls
5. **Monitor connection pools**: Watch for connection saturation

See [CLAUDE.md](../../CLAUDE.md) for full best practices.
