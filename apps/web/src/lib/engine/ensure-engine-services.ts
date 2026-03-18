import 'server-only';

import {
  DistributedLockService as ApiDistributedLockService,
  broadcastToChannel as apiBroadcastToChannel,
  checkRateLimit as apiCheckRateLimit,
  checkRateLimitAsync as apiCheckRateLimitAsync,
  clearAllRateLimits as apiClearAllRateLimits,
  getRateLimitStatus as apiGetRateLimitStatus,
  notifyGroupChatInvite as apiNotifyGroupChatInvite,
  resetRateLimit as apiResetRateLimit,
  getRedisClient,
} from '@babylon/api';
import {
  type AntiRepetitionRedisClient,
  type DistributedLockProvider,
  type NarrativeBeatRedisClient,
  type RateLimitProvider,
  setAntiRepetitionRedis,
  setBroadcastToChannel,
  setDistributedLockProvider,
  setNarrativeBeatRedis,
  setNotifyGroupChatInvite,
  setRateLimitProvider,
} from '@babylon/engine';

let initialized = false;

/**
 * Wire engine-side abstractions to API implementations.
 *
 * The engine package is intentionally decoupled from `@babylon/api`. In the web
 * runtime we provide the concrete implementations (SSE broadcaster, distributed
 * locks, notifications) so engine services can perform side effects.
 */
export function ensureEngineServices(): void {
  if (initialized) return;
  initialized = true;

  setBroadcastToChannel((channel, data) =>
    apiBroadcastToChannel(
      channel as Parameters<typeof apiBroadcastToChannel>[0],
      data as Parameters<typeof apiBroadcastToChannel>[1]
    )
  );

  setNotifyGroupChatInvite((userId, npcId, groupId, chatName, inviteId) =>
    apiNotifyGroupChatInvite(userId, npcId, groupId, chatName, inviteId)
  );

  const provider: DistributedLockProvider = {
    acquireLock: (params) =>
      ApiDistributedLockService.acquireLock({
        lockId: params.lockId,
        durationMs: params.durationMs,
        operation: params.operation,
        processId: params.processId,
      }),
    releaseLock: (lockId, processId) =>
      ApiDistributedLockService.releaseLock(lockId, processId),
  };

  // Note: keep the provider assignment explicit for type safety
  setDistributedLockProvider(provider);

  // Wire Redis client into engine services that need it.
  // The engine package cannot import @babylon/api directly (dependency direction),
  // so we inject the concrete Redis client here using injectable interfaces.
  const rawRedis = getRedisClient();
  if (rawRedis) {
    const antiRepetitionRedis: AntiRepetitionRedisClient = {
      get: (key) => rawRedis.get(key),
      set: (key, value, expiryMode, time) =>
        rawRedis.set(key, value, expiryMode, time),
    };
    setAntiRepetitionRedis(antiRepetitionRedis);

    const narrativeBeatRedis: NarrativeBeatRedisClient = {
      sadd: (key, ...members) => rawRedis.sadd(key, ...members),
      smembers: (key) => rawRedis.smembers(key),
      expire: (key, seconds) => rawRedis.expire(key, seconds),
    };
    setNarrativeBeatRedis(narrativeBeatRedis);
  }

  const rateLimitProvider: RateLimitProvider = {
    checkRateLimit: (userId, config) => apiCheckRateLimit(userId, config),
    checkRateLimitAsync: (userId, config) =>
      apiCheckRateLimitAsync(userId, config),
    clearAllRateLimits: () => apiClearAllRateLimits(),
    getRateLimitStatus: (userId, config) =>
      apiGetRateLimitStatus(userId, config),
    resetRateLimit: (userId, actionType) =>
      apiResetRateLimit(userId, actionType),
  };
  setRateLimitProvider(rateLimitProvider);
}
