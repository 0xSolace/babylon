/**
 * Cache Metrics — Redis-backed observability for cache hit/miss rates.
 *
 * Uses Redis INCRBY so counters survive serverless cold starts and are
 * shared across all Vercel function instances. All record* functions are
 * fire-and-forget (no await) so they never add latency to the request path.
 *
 * Keys auto-expire after 24 hours to prevent unbounded growth.
 */

import { logger } from '@babylon/shared';
import { getRedisClient } from '../redis';

const METRICS_PREFIX = 'cache:metrics';
const METRICS_TTL = 86400; // 24 hours — rolling window, auto-cleanup

/**
 * Record a cache hit. Fire-and-forget — never blocks the request.
 */
export function recordCacheHit(namespace: string): void {
  const client = getRedisClient();
  if (!client) return;
  const key = `${METRICS_PREFIX}:${namespace}:hits`;
  client.incr(key).catch((err) => {
    logger.debug(
      'Cache metrics incr failed',
      { key, error: String(err) },
      'CacheMetrics'
    );
  });
  client.expire(key, METRICS_TTL).catch(() => {});
}

/**
 * Record a cache miss and the time spent fetching the value from source.
 */
export function recordCacheMiss(namespace: string, fetchMs: number): void {
  const client = getRedisClient();
  if (!client) return;
  const missKey = `${METRICS_PREFIX}:${namespace}:misses`;
  const fetchMsKey = `${METRICS_PREFIX}:${namespace}:fetchMs`;
  client.incr(missKey).catch((err) => {
    logger.debug(
      'Cache metrics incr failed',
      { key: missKey, error: String(err) },
      'CacheMetrics'
    );
  });
  client.expire(missKey, METRICS_TTL).catch(() => {});
  client.incrby(fetchMsKey, Math.round(fetchMs)).catch((err) => {
    logger.debug(
      'Cache metrics incrby failed',
      { key: fetchMsKey, error: String(err) },
      'CacheMetrics'
    );
  });
  client.expire(fetchMsKey, METRICS_TTL).catch(() => {});
}

interface NamespaceMetrics {
  hits: number;
  misses: number;
  totalFetchMs: number;
  hitRate: string;
  avgFetchMs: string;
}

/**
 * Snapshot of all cache metrics, grouped by namespace.
 *
 * Reads from Redis via SCAN + MGET. Only called by the admin endpoint,
 * never on the hot path.
 */
export async function getCacheMetricsSnapshot(): Promise<
  Record<string, NamespaceMetrics>
> {
  const client = getRedisClient();
  if (!client) return {};

  // Collect all metric keys via SCAN
  const keys: string[] = [];
  const stream = client.scanStream({
    match: `${METRICS_PREFIX}:*`,
    count: 200,
  });

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (batch: string[]) => {
      keys.push(...batch);
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });

  if (keys.length === 0) return {};

  const values = await client.mget(...keys);
  const raw = new Map<string, number>();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k) raw.set(k, Number(values[i] ?? 0));
  }

  // Extract unique namespace names
  const namespaces = new Set<string>();
  for (const key of keys) {
    const withoutPrefix = key.slice(METRICS_PREFIX.length + 1); // remove "cache:metrics:"
    const lastColon = withoutPrefix.lastIndexOf(':');
    if (lastColon > 0) {
      namespaces.add(withoutPrefix.slice(0, lastColon));
    }
  }

  const result: Record<string, NamespaceMetrics> = {};
  for (const ns of namespaces) {
    const hits = raw.get(`${METRICS_PREFIX}:${ns}:hits`) ?? 0;
    const misses = raw.get(`${METRICS_PREFIX}:${ns}:misses`) ?? 0;
    const totalFetchMs = raw.get(`${METRICS_PREFIX}:${ns}:fetchMs`) ?? 0;
    const total = hits + misses;
    result[ns] = {
      hits,
      misses,
      totalFetchMs,
      hitRate: total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : 'N/A',
      avgFetchMs:
        misses > 0 ? `${(totalFetchMs / misses).toFixed(1)}ms` : 'N/A',
    };
  }

  logger.debug(
    'Cache metrics snapshot generated',
    { namespaceCount: Object.keys(result).length },
    'CacheMetrics'
  );

  return result;
}
