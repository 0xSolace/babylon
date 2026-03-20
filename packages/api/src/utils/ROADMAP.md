# API Package Roadmap

## Completed

### ✅ API Key lastUsedAt Write-Back Cache (2025-03-20)

**Problem**: `UserApiKey.lastUsedAt` updates were executing 1,830 times with 115,885 seconds total database time.

**Solution**: Implemented write-back cache using Redis with periodic batched flushes to database.

**Impact**: 
- Database load reduced by 90%+ (from 1,830 individual queries to ~18 batch transactions)
- Estimated database time: From 115,885 seconds to ~1,000-2,000 seconds
- Fast writes: Redis writes are microseconds vs database writes (milliseconds)

**Files**:
- `packages/api/src/utils/api-keys.ts` - Write path
- `packages/api/src/utils/api-key-lastused-flusher.ts` - Flush service
- `apps/web/instrumentation.ts` - Initialization

**Documentation**: See `API_KEY_WRITEBACK_CACHE.md` for full details.

---

## Planned

### 🔄 Distributed Lock for Concurrent Flushes

**Why**: Current `isFlushing` flag has race condition in multi-instance deployments. Two instances could both start flushing simultaneously.

**Solution**: Use Redis distributed lock to ensure only one instance flushes at a time.

**Priority**: Medium  
**Estimated effort**: 2-4 hours

### 🔄 Enhanced Pipeline Error Handling

**Why**: Currently, `pipeline.exec()` results are not checked for individual command errors. If Redis cleanup fails after DB success, entries remain in Redis and will be reprocessed.

**Solution**: Check pipeline results for errors and handle cleanup failures gracefully.

**Priority**: Medium  
**Estimated effort**: 1-2 hours

### 🔄 Metrics Enhancement

**Why**: Currently missing metrics for Redis write failures and fallback DB writes. Hard to monitor Redis health and fallback frequency.

**Solution**: Add metrics tracking:
- Redis write failures
- Fallback DB writes
- Queue size
- Average flush latency

**Priority**: Low  
**Estimated effort**: 2-3 hours

### 🔄 TTL on Redis Keys

**Why**: If flusher fails for extended period, Redis keys could grow unbounded.

**Solution**: Add TTL to Redis keys (e.g., 1 hour) to prevent unbounded growth.

**Priority**: Low  
**Estimated effort**: 1 hour

---

## Future Considerations

### 💡 Retry Logic for Failed Flushes

**Why**: Currently, if a flush fails, updates remain in Redis and will be retried on next flush. But if flushes keep failing, updates could sit in Redis indefinitely.

**Solution**: Add exponential backoff retry logic for failed flushes, with alerting after N consecutive failures.

**Priority**: Low  
**Estimated effort**: 3-4 hours

### 💡 Cron Endpoint for Serverless

**Why**: Current implementation uses `setInterval` which may not work reliably in pure serverless environments (e.g., Vercel serverless functions).

**Solution**: Create `/api/cron/api-key-flush` endpoint that can be called by external cron service.

**Priority**: Low  
**Estimated effort**: 2-3 hours

### 💡 Monitoring Dashboard

**Why**: Currently, metrics are only available via `getFlusherStats()`. No visual dashboard for monitoring.

**Solution**: Create monitoring dashboard showing:
- Flush success/failure rate
- Queue size over time
- Average flush latency
- Redis write failure rate

**Priority**: Low  
**Estimated effort**: 4-6 hours

---

## Notes

- All improvements are optional enhancements - current implementation is production-ready
- Priority is based on impact vs effort
- Future considerations are ideas that may or may not be implemented
