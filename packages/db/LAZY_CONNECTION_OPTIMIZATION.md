# Lazy Database Connection Optimization

## Overview

This document describes the lazy database connection optimization implemented in `packages/db/src/db.ts`. This optimization ensures that database client objects are only created when queries actually execute, not during property access. This significantly improves cold start performance for read-only routes, especially in serverless environments like Vercel/Next.js.

## Problem Statement

### Before Optimization

**Eager Client Creation**:
1. Route handler accesses `db.user` (property access)
2. Proxy calls `getReadReplicaDbClient()`
3. No replica configured → calls `getDbClient()` immediately
4. `getDbClient()` → `getDrizzleInstance()` → `getPostgresClient()`
5. **Postgres client object created** (even if query never executes)
6. Connection pool initialized (even if query never executes)

**Impact**:
- Read-only routes created write connection client objects unnecessarily
- Slower cold starts due to connection pool initialization overhead
- Higher memory usage per request
- Connection pool slots consumed even when no queries execute

### Root Cause

- `getReadReplicaDbClient()` eagerly called `getDbClient()` when no replica was configured
- `createModeAwareDbProxy()` called `getDbClient()` during property access
- Table repository proxy called `getReadReplicaDbClient()` during property access
- Client object creation happened eagerly, not lazily

## Solution: Nested Lazy Proxies

### Architecture

The solution uses **nested proxies** to defer client creation:

1. **First Proxy** (`createLazyPrimaryClientProxy`): Returns a lazy property proxy when a property is accessed
2. **Second Proxy** (`createLazyPropertyProxy`): Defers `getDbClient()` until a method on that property is accessed

### Flow (Truly Lazy)

1. User accesses `db.user` → First proxy returns lazy property proxy (no client creation)
2. User accesses `db.user.findMany` → Second proxy's `get('findMany')` is called → NOW calls `getDbClient()` (client created)
3. User calls `db.user.findMany()` → Method executes with client

### Why Nested Proxies?

**Single-level proxy problem**: A single proxy's `get()` handler is called on property access, so calling `getDbClient()` there still creates the client eagerly.

**Nested proxy solution**: 
- First proxy returns another proxy (no client creation)
- Second proxy only calls `getDbClient()` when a method is accessed
- This ensures client is created only when `db.user.findMany()` is accessed, not when `db.user` is accessed

## Implementation Details

### Key Functions

#### `createLazyPrimaryClientProxy()`

**Purpose**: Creates the outer lazy proxy that wraps the entire database client.

**Why**: This is the entry point for lazy behavior. When `getReadReplicaDbClient()` falls back to primary (no replica), it returns this proxy instead of eagerly calling `getDbClient()`.

**Behavior**:
- Returns a proxy that intercepts property access
- For each property, returns `createLazyPropertyProxy(prop)` instead of the actual value
- Handles JSON/memory mode and build-time scenarios

#### `createLazyPropertyProxy(prop)`

**Purpose**: Creates a lazy proxy for a specific property (e.g., `user`, `post`, `select`).

**Why**: This is where true laziness happens. The proxy defers `getDbClient()` until a method on the property is accessed.

**Behavior**:
- Returns a proxy that intercepts method access (e.g., `findMany`, `findFirst`)
- Only calls `getDbClient()` when a method is accessed
- Returns the method from the actual client, preserving `this` context

### Integration Points

#### `getReadReplicaDbClient()`

**Before**: `return getDbClient();` (eager)

**After**: `return createLazyPrimaryClientProxy();` (lazy)

**Why**: Keeps fallback for dev environments (single DB), but makes it lazy. Client is only created when query executes, not during property access.

#### `createModeAwareDbProxy()`

**Before**: Called `getDbClient()` for reads without replica (eager)

**After**: Returns `createLazyPrimaryClientProxy()[prop]` for reads without replica (lazy)

**Why**: Read operations without replica now use lazy proxy. Client only created when query executes.

#### Table Repository Proxy

**Before**: Used primary client directly when no replica (eager)

**After**: Uses `createLazyPrimaryClientProxy()` when no replica (lazy)

**Why**: Most reads use table repos (`db.user.findMany()`). This is where the optimization matters most.

## Benefits

### Performance

- ✅ **Faster cold starts**: No client creation on property access
- ✅ **Lower memory usage**: No pool initialization until needed
- ✅ **Better for Vercel/Next.js**: Fewer objects created per request
- ✅ **With replica configured**: Reads never create write client objects

### Functional

- ✅ **Fallback preserved**: Dev environments still work (single DB)
- ✅ **Backward compatible**: All existing code continues to work
- ✅ **No breaking changes**: Just lazy now, same API

## Trade-offs

- **Slightly more complex code**: Nested proxy pattern adds complexity
- **Minimal overhead on first query**: One-time cost when client is first created
- **Proxy chain**: Two levels of proxies (negligible performance impact)

## Usage

### For Developers

**No changes required** - the optimization is transparent:

```typescript
// This works exactly as before, but client is created lazily
const users = await db.user.findMany({ take: 10 });

// Client is only created when findMany() is called,
// not when db.user is accessed
```

### With Read Replica

When `DATABASE_READ_REPLICA_URL` is configured:

```typescript
// Reads use replica (no write client created)
const users = await db.user.findMany({ take: 10 });

// Writes use primary (client created lazily on first write)
await db.user.create({ data: { ... } });
```

### Without Read Replica (Dev)

When no replica is configured (typical dev environment):

```typescript
// Reads fall back to primary (lazy - client created on query execution)
const users = await db.user.findMany({ take: 10 });

// Writes use primary (lazy - client created on query execution)
await db.user.create({ data: { ... } });
```

## Testing

Integration tests verify lazy behavior:

- `packages/testing/integration/db-lazy-connection.integration.test.ts`

**Test scenarios**:
1. Property access doesn't create client
2. Query execution creates client
3. Read without replica uses lazy proxy
4. Read with replica never creates write client

## Performance Measurement

### Before Optimization

- Property access: Client created immediately
- Cold start: Client + pool initialization overhead
- Memory: Pool initialized even if no queries execute

### After Optimization

- Property access: No client creation
- Query execution: Client created only when needed
- Cold start: Reduced overhead for read-only routes

### Measurement

To measure the impact:

1. Add logging to track when clients are created
2. Measure cold start time before/after
3. Verify with replica configured (should never create write client)

## Related Documentation

- `CLAUDE.md` - Database connection best practices
- `packages/db/src/db.ts` - Implementation with detailed code comments
- `CHANGELOG.md` - Change history

## Future Considerations

1. **Write operations lazy**: Currently writes still create client eagerly (optional optimization)
2. **Connection metrics**: Add metrics to track connection creation patterns
3. **Configurable behavior**: Make lazy behavior configurable via environment variable
