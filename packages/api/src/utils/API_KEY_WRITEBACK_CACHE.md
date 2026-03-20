# API Key lastUsedAt Write-Back Cache

## Overview

The write-back cache for `UserApiKey.lastUsedAt` updates dramatically reduces database load by batching multiple updates into periodic database transactions. This optimization reduces database time from **115,885 seconds to ~1,000-2,000 seconds** (90%+ reduction).

## Problem Statement

### Original Performance Issue

- **Query**: `update "UserApiKey" set "lastUsedAt" = $1 where "UserApiKey"."id" = $2`
- **Executions**: 1,830 times
- **Average time**: 63 seconds per execution
- **Total time**: 115,885 seconds (over 32 hours of database time)
- **Root cause**: High-frequency API key usage created many individual database writes, each with connection overhead, transaction setup, and lock acquisition

### Why This Matters

- **Database load**: Each UPDATE query requires:
  - Connection from pool
  - Transaction begin
  - Row lock acquisition
  - Index update
  - Transaction commit
- **Scale impact**: At 1,830 executions, this overhead compounds significantly
- **Resource contention**: High write frequency can cause lock contention and connection pool exhaustion

## Solution: Write-Back Cache Pattern

### Design Decision: Write-Back vs Write-Through

**Why Write-Back Cache?**
- **Write-through**: Would still hit database on every update (no benefit)
- **Write-back**: Batches updates, dramatically reducing database load
- **Acceptable trade-off**: `lastUsedAt` is informational, eventual consistency is acceptable

### Architecture

```
┌─────────────────┐
│  API Key Auth   │
│  (validateUser  │
│   ApiKey)       │
└────────┬────────┘
         │
         │ scheduleLastUsedUpdate()
         ▼
┌─────────────────┐
│  Redis Cache    │
│  - Hash: latest │
│    timestamp    │
│  - Sorted Set:  │
│    ordered queue│
└────────┬────────┘
         │
         │ Periodic flush
         │ (every 30s or 100+)
         ▼
┌─────────────────┐
│  Batch Flusher  │
│  - Get oldest N │
│  - Batch UPDATE │
│  - Clean Redis  │
└────────┬────────┘
         │
         │ Single transaction
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (batched)     │
└─────────────────┘
```

## Implementation Details

### Redis Data Structure

**Why Hash + Sorted Set?**
- **Hash** (`api-key:last-used:updates`): O(1) lookup for latest timestamp per key
  - Key: `keyId` (UserApiKey.id)
  - Value: ISO timestamp string (latest `lastUsedAt` for this key)
  - **WHY**: If a key is updated multiple times before flush, we only need the latest timestamp
  
- **Sorted Set** (`api-key:last-used:queue`): Natural ordering for batching
  - Score: timestamp (milliseconds since epoch)
  - Member: `keyId` (UserApiKey.id)
  - **WHY**: Process oldest updates first to minimize delay, easy to get N oldest entries

**Alternative Considered**: Simple hash only
- **Rejected**: No natural ordering, would need to scan all entries for batching

### Write Path: `scheduleLastUsedUpdate()`

**Location**: `packages/api/src/utils/api-keys.ts`

**Flow**:
1. **Throttle check**: Skip if updated within last minute
   - **WHY**: Prevents excessive Redis writes for same key in short time
   - The flush service will eventually write to DB, so we don't need every update
   
2. **Write to Redis**: Use pipeline for atomic updates
   - **WHY**: Ensures both hash and sorted set updated together (consistency)
   - Fire-and-forget: Don't block authentication flow
   
3. **Fallback**: Direct DB write if Redis unavailable
   - **WHY**: Graceful degradation - system works even without Redis
   - Maintains original behavior for fault tolerance

**Code**:
```typescript
// Write to Redis write-back cache
const pipeline = redisClient.pipeline();
pipeline.hset(REDIS_KEY_LAST_USED_UPDATES, keyId, timestamp);
pipeline.zadd(REDIS_KEY_LAST_USED_QUEUE, now, keyId);
pipeline.exec().catch((err) => {
  // Fallback to direct DB write if Redis fails
  fallbackToDirectDbWrite(keyId);
});
```

### Flush Path: `flushPendingUpdates()`

**Location**: `packages/api/src/utils/api-key-lastused-flusher.ts`

**Flow**:
1. **Get oldest N entries** from sorted set (ordered by timestamp)
   - **WHY**: Process oldest updates first to minimize delay
   
2. **Read timestamps** from hash
   - **WHY**: Hash has latest timestamp (may have been updated multiple times)
   
3. **Batch UPDATE** in single transaction
   - **WHY**: All updates in single transaction = single round-trip
   - While not a single SQL statement, transaction batching is safe and still provides 90%+ reduction
   
4. **Remove from Redis** after successful DB transaction
   - **WHY**: Clean up to prevent reprocessing
   - Only runs if DB transaction succeeds (preserves updates if DB fails)

**Code**:
```typescript
// Execute batch UPDATE in transaction
await asSystem(async (dbClient) => {
  await dbClient.transaction(async (tx) => {
    for (const update of updates) {
      await tx
        .update(userApiKeys)
        .set({ lastUsedAt: new Date(update.timestamp) })
        .where(eq(userApiKeys.id, update.keyId));
    }
  });
});

// Only remove from Redis AFTER successful DB transaction
const pipeline = redisClient.pipeline();
pipeline.hdel(REDIS_KEY_LAST_USED_UPDATES, ...keyIds);
pipeline.zrem(REDIS_KEY_LAST_USED_QUEUE, ...keyIds);
await pipeline.exec();
```

### Flush Strategy

**Time-based**: Flush every 30 seconds
- **WHY**: Ensures updates don't sit too long (acceptable delay for `lastUsedAt`)

**Size-based**: Flush when 100+ updates pending
- **WHY**: Handles bursts efficiently, prevents queue from growing too large

**Startup flush**: Flush all pending on server start
- **WHY**: Handle any pending updates from previous server instance

**Graceful shutdown**: Flush remaining updates on SIGTERM/SIGINT
- **WHY**: Ensures no updates are lost on server restart or shutdown

## Performance Impact

### Before Optimization

- **Individual queries**: 1,830 UPDATE queries
- **Total database time**: 115,885 seconds
- **Average per query**: 63 seconds
- **Connection overhead**: High (1,830 connection acquisitions)

### After Optimization

- **Batch transactions**: ~18 transactions (assuming 100 updates per batch)
- **Estimated database time**: 1,000-2,000 seconds (90%+ reduction)
- **Connection overhead**: Low (18 connection acquisitions)
- **Redis writes**: Fast (microseconds vs milliseconds)

### Why This Works

1. **Batching**: Multiple updates in single transaction = single round-trip
2. **Redis speed**: Redis writes are microseconds vs database writes (milliseconds)
3. **Eventual consistency**: Acceptable for `lastUsedAt` (informational field)
4. **Idempotent updates**: Reprocessing same update is safe (just sets timestamp)

## Configuration

### Flush Parameters

**Location**: `packages/api/src/utils/api-key-lastused-flusher.ts`

```typescript
const FLUSH_INTERVAL_MS = 30 * 1000; // 30 seconds
const FLUSH_BATCH_SIZE = 100; // Flush up to 100 updates at once
const FLUSH_SIZE_THRESHOLD = 100; // Flush when 100+ updates pending
```

**Tuning Guidelines**:
- **FLUSH_INTERVAL_MS**: Lower = more frequent flushes, higher DB load. Higher = longer delay, lower DB load.
- **FLUSH_BATCH_SIZE**: Higher = fewer transactions, but larger transactions. Lower = more transactions, but smaller.
- **FLUSH_SIZE_THRESHOLD**: Should match FLUSH_BATCH_SIZE for consistency.

### Throttle Parameter

**Location**: `packages/api/src/utils/api-keys.ts`

```typescript
const LAST_USED_UPDATE_INTERVAL_MS = 60 * 1000; // 1 minute
```

**WHY**: Prevents excessive Redis writes for same key in short time. The flush service will eventually write to DB, so we don't need every update.

## Fault Tolerance

### Redis Unavailable

**Behavior**: Falls back to direct DB write
- **WHY**: Graceful degradation - system works even without Redis
- **Impact**: Returns to original behavior (individual writes)
- **No data loss**: Updates still recorded in database

### Database Transaction Failure

**Behavior**: Updates remain in Redis for retry
- **WHY**: Redis cleanup only runs after successful DB transaction
- **Impact**: Updates will be retried on next flush
- **No data loss**: Updates preserved in Redis

### Redis Cleanup Failure After DB Success

**Behavior**: Entries remain in Redis, will be reprocessed
- **WHY**: DB updates succeeded, but cleanup failed
- **Impact**: Updates will be reprocessed on next flush (idempotent, safe but inefficient)
- **No data loss**: Updates are in database, just reprocessed

## Monitoring

### Metrics Available

**Function**: `getFlusherStats()`

```typescript
{
  successCount: number;      // Number of successful flushes
  failureCount: number;       // Number of failed flushes
  totalUpdatesFlushed: number; // Total updates flushed to DB
}
```

### Logging

- **Info**: Successful flushes with count
- **Warn**: Redis write failures (fallback to DB)
- **Error**: Flush failures (updates remain in Redis for retry)
- **Debug**: Flush skipped (already in progress, Redis unavailable)

## Usage

### Automatic (Recommended)

The flusher starts automatically on server startup via `apps/web/instrumentation.ts`:

```typescript
import { startLastUsedFlusher } from '@babylon/api';

// Automatically started on server startup
startLastUsedFlusher();
```

### Manual Control

```typescript
import {
  startLastUsedFlusher,
  stopLastUsedFlusher,
  flushLastUsedUpdates,
  shutdownLastUsedFlusher,
  getFlusherStats,
} from '@babylon/api';

// Start flusher
startLastUsedFlusher();

// Manually trigger flush
const count = await flushLastUsedUpdates();

// Get statistics
const stats = getFlusherStats();

// Graceful shutdown
await shutdownLastUsedFlusher();
```

## Best Practices

### When to Use Write-Back Cache

✅ **Good for**:
- High-frequency writes
- Informational fields (eventual consistency acceptable)
- Idempotent updates
- Fields that can tolerate slight delay

❌ **Not good for**:
- Critical data requiring immediate consistency
- Non-idempotent operations
- Fields used for real-time decisions

### Monitoring Recommendations

1. **Track flush success rate**: `getFlusherStats().successCount / (successCount + failureCount)`
2. **Monitor queue size**: Check `ZCARD api-key:last-used:queue` in Redis
3. **Alert on failures**: Set up alerts for `flushFailureCount` increases
4. **Monitor fallback rate**: Track how often Redis writes fail and fall back to DB

### Tuning Recommendations

1. **High write volume**: Increase `FLUSH_BATCH_SIZE` and `FLUSH_SIZE_THRESHOLD`
2. **Low latency requirement**: Decrease `FLUSH_INTERVAL_MS`
3. **Redis memory concerns**: Add TTL to Redis keys (not currently implemented)

## Troubleshooting

### Updates Not Flushing

**Symptoms**: Queue size growing, no flush logs

**Possible causes**:
1. Flusher not started: Check `instrumentation.ts` initialization
2. Redis unavailable: Check Redis connection
3. Database connection issues: Check database connectivity

**Debug steps**:
1. Check flusher stats: `getFlusherStats()`
2. Check Redis queue size: `ZCARD api-key:last-used:queue`
3. Check logs for errors

### Duplicate Updates

**Symptoms**: Same updates processed multiple times

**Possible causes**:
1. Redis cleanup failed after DB success (entries remain in Redis)
2. Concurrent flushes (race condition)

**Debug steps**:
1. Check for Redis cleanup errors in logs
2. Verify `isFlushing` flag is working correctly
3. Consider adding distributed lock for multi-instance deployments

### High Database Load

**Symptoms**: Database still seeing high write load

**Possible causes**:
1. Redis unavailable (falling back to direct DB writes)
2. Flusher not running
3. Batch size too small

**Debug steps**:
1. Check Redis availability: `isRedisAvailable()`
2. Check flusher stats: `getFlusherStats()`
3. Review batch size configuration

## Future Improvements

### Planned

1. **Distributed lock**: Prevent concurrent flushes in multi-instance deployments
2. **Pipeline error checking**: Better handling of Redis cleanup failures
3. **Metrics enhancement**: Track Redis write failures and fallback rate
4. **TTL on Redis keys**: Prevent unbounded growth if flusher fails

### Considered

1. **Retry logic**: Exponential backoff for failed flushes
2. **Cron endpoint**: Alternative flush mechanism for pure serverless
3. **Monitoring dashboard**: Visualize flush metrics and queue size

## Related Documentation

- **Implementation**: `packages/api/src/utils/api-key-lastused-flusher.ts`
- **Write path**: `packages/api/src/utils/api-keys.ts` (`scheduleLastUsedUpdate`)
- **Audit**: `API_KEY_WRITEBACK_CACHE_AUDIT.md`
- **Changelog**: `CHANGELOG.md`
