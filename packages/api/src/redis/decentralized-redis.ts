/**
 * Decentralized Redis Replacement
 *
 * Drop-in replacement for Redis using Jeju's decentralized cache.
 * Provides the same API as ioredis for compatibility.
 * NO FALLBACKS - Decentralized cache is required.
 */

import { logger } from '@babylon/shared';
import { type CacheClient, initializeCache } from '../cache';

// ============================================================================
// Redis-Compatible Interface
// ============================================================================

export interface RedisCompatibleClient {
  // Basic operations
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: 'EX', ttl?: number): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;

  // TTL operations
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  pttl(key: string): Promise<number>;

  // Increment/Decrement
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  decr(key: string): Promise<number>;
  decrby(key: string, decrement: number): Promise<number>;

  // Hash operations (simplified - stored as JSON)
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;

  // List operations (simplified - stored as JSON array)
  lpush(key: string, ...values: string[]): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  llen(key: string): Promise<number>;

  // Set operations (simplified - stored as JSON set)
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<number>;

  // Key operations
  keys(pattern: string): Promise<string[]>;
  scan(
    cursor: string,
    match?: string,
    count?: number
  ): Promise<[string, string[]]>;

  // Pub/Sub (not fully supported - throws)
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<void>;

  // Connection
  ping(): Promise<'PONG'>;
  quit(): Promise<'OK'>;

  // Stream operations (simplified)
  xadd(key: string, id: string, ...args: string[]): Promise<string>;
  xread(block: number, streams: string, ...keys: string[]): Promise<unknown>;
}

// ============================================================================
// Implementation
// ============================================================================

class DecentralizedRedis implements RedisCompatibleClient {
  private cache: CacheClient;
  private initialized = false;

  constructor(cache: CacheClient) {
    this.cache = cache;
    this.initialized = true;
  }

  private requireInit(): void {
    if (!this.initialized) {
      throw new Error('[Redis] Client not initialized');
    }
  }

  // Basic operations
  async get(key: string): Promise<string | null> {
    this.requireInit();
    const value = await this.cache.get<string>(key);
    return value;
  }

  async set(
    key: string,
    value: string,
    mode?: 'EX',
    ttl?: number
  ): Promise<'OK'> {
    this.requireInit();
    await this.cache.set(key, value, mode === 'EX' && ttl ? ttl : undefined);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    this.requireInit();
    let deleted = 0;
    for (const key of keys) {
      const result = await this.cache.delete(key);
      if (result) deleted++;
    }
    return deleted;
  }

  async exists(...keys: string[]): Promise<number> {
    this.requireInit();
    let count = 0;
    for (const key of keys) {
      if (await this.cache.exists(key)) count++;
    }
    return count;
  }

  // TTL operations
  async expire(key: string, seconds: number): Promise<number> {
    this.requireInit();
    const success = await this.cache.expire(key, seconds);
    return success ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    this.requireInit();
    return this.cache.ttl(key);
  }

  async pttl(key: string): Promise<number> {
    this.requireInit();
    const ttlSeconds = await this.cache.ttl(key);
    return ttlSeconds * 1000;
  }

  // Increment/Decrement
  async incr(key: string): Promise<number> {
    this.requireInit();
    return this.cache.incr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    this.requireInit();
    return this.cache.incr(key, increment);
  }

  async decr(key: string): Promise<number> {
    this.requireInit();
    return this.cache.decr(key);
  }

  async decrby(key: string, decrement: number): Promise<number> {
    this.requireInit();
    return this.cache.decr(key, decrement);
  }

  // Hash operations (stored as JSON objects)
  async hget(key: string, field: string): Promise<string | null> {
    this.requireInit();
    const hash = await this.cache.get<Record<string, string>>(key);
    return hash?.[field] ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    this.requireInit();
    const hash = (await this.cache.get<Record<string, string>>(key)) ?? {};
    const isNew = !(field in hash);
    hash[field] = value;
    await this.cache.set(key, hash);
    return isNew ? 1 : 0;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    this.requireInit();
    return (await this.cache.get<Record<string, string>>(key)) ?? {};
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    this.requireInit();
    const hash = await this.cache.get<Record<string, string>>(key);
    if (!hash) return 0;
    let deleted = 0;
    for (const field of fields) {
      if (field in hash) {
        delete hash[field];
        deleted++;
      }
    }
    await this.cache.set(key, hash);
    return deleted;
  }

  // List operations (stored as JSON arrays)
  async lpush(key: string, ...values: string[]): Promise<number> {
    this.requireInit();
    const list = (await this.cache.get<string[]>(key)) ?? [];
    list.unshift(...values.reverse());
    await this.cache.set(key, list);
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    this.requireInit();
    const list = (await this.cache.get<string[]>(key)) ?? [];
    list.push(...values);
    await this.cache.set(key, list);
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    this.requireInit();
    const list = await this.cache.get<string[]>(key);
    if (!list || list.length === 0) return null;
    const value = list.shift()!;
    await this.cache.set(key, list);
    return value;
  }

  async rpop(key: string): Promise<string | null> {
    this.requireInit();
    const list = await this.cache.get<string[]>(key);
    if (!list || list.length === 0) return null;
    const value = list.pop()!;
    await this.cache.set(key, list);
    return value;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    this.requireInit();
    const list = (await this.cache.get<string[]>(key)) ?? [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async llen(key: string): Promise<number> {
    this.requireInit();
    const list = await this.cache.get<string[]>(key);
    return list?.length ?? 0;
  }

  // Set operations (stored as JSON arrays with unique values)
  async sadd(key: string, ...members: string[]): Promise<number> {
    this.requireInit();
    const set = new Set((await this.cache.get<string[]>(key)) ?? []);
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    await this.cache.set(key, Array.from(set));
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    this.requireInit();
    const set = new Set((await this.cache.get<string[]>(key)) ?? []);
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed++;
    }
    await this.cache.set(key, Array.from(set));
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    this.requireInit();
    return (await this.cache.get<string[]>(key)) ?? [];
  }

  async sismember(key: string, member: string): Promise<number> {
    this.requireInit();
    const set = await this.cache.get<string[]>(key);
    return set?.includes(member) ? 1 : 0;
  }

  // Key operations
  async keys(pattern: string): Promise<string[]> {
    this.requireInit();
    return this.cache.keys(pattern);
  }

  async scan(
    _cursor: string,
    match?: string,
    _count?: number
  ): Promise<[string, string[]]> {
    this.requireInit();
    // Simplified scan - returns all matching keys at once
    const keys = await this.cache.keys(match ?? '*');
    return ['0', keys];
  }

  // Pub/Sub (not fully supported in decentralized cache)
  async publish(_channel: string, _message: string): Promise<number> {
    logger.warn(
      '[Redis] Pub/Sub not supported in decentralized mode. Use Farcaster or messaging service.'
    );
    return 0;
  }

  async subscribe(_channel: string): Promise<void> {
    logger.warn(
      '[Redis] Pub/Sub not supported in decentralized mode. Use Farcaster or messaging service.'
    );
  }

  // Connection
  async ping(): Promise<'PONG'> {
    this.requireInit();
    const healthy = await this.cache.healthCheck();
    if (!healthy) throw new Error('Cache service not healthy');
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  // Stream operations (simplified - not fully Redis-compatible)
  async xadd(key: string, _id: string, ...args: string[]): Promise<string> {
    this.requireInit();
    const stream =
      (await this.cache.get<
        Array<{ id: string; data: Record<string, string> }>
      >(key)) ?? [];
    const id = `${Date.now()}-${stream.length}`;
    const data: Record<string, string> = {};
    for (let i = 0; i < args.length; i += 2) {
      const fieldKey = args[i];
      const fieldValue = args[i + 1];
      if (fieldKey !== undefined && fieldValue !== undefined) {
        data[fieldKey] = fieldValue;
      }
    }
    stream.push({ id, data });
    // Keep only last 1000 entries
    if (stream.length > 1000) stream.splice(0, stream.length - 1000);
    await this.cache.set(key, stream);
    return id;
  }

  async xread(
    _block: number,
    _streams: string,
    ..._keys: string[]
  ): Promise<unknown> {
    logger.warn(
      '[Redis] XREAD not fully supported. Use simplified stream operations.'
    );
    return null;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let redisClient: DecentralizedRedis | null = null;

export async function getDecentralizedRedis(): Promise<DecentralizedRedis> {
  if (redisClient) return redisClient;

  const cache = await initializeCache();
  redisClient = new DecentralizedRedis(cache);
  return redisClient;
}

export function resetDecentralizedRedis(): void {
  redisClient = null;
}

export { DecentralizedRedis };
