/**
 * Cached Database Service
 *
 * @description Wraps database-service with intelligent caching layer using Redis
 * and in-memory cache. Provides cached versions of frequently accessed queries
 * with automatic TTL management and cache invalidation. Reduces database load
 * for read-heavy operations.
 *
 * @usage
 * ```typescript
 * import { cachedDb } from '@babylon/api'
 * const posts = await cachedDb.getRecentPosts(100)
 * ```
 */

import {
  type DrizzleClient,
  fetchActorStateRowAsSystem,
  fetchCachedUserProfileStats,
  fetchOrganizationStateRowAsSystem,
  fetchPostsByActorForGameService,
  fetchRecentPostsForGameService,
  type Post,
  selectActiveUnresolvedMarkets,
  selectPostsForFollowingFeed,
  selectTestUserIdsAmongFollowed,
  selectTrendingTagsWithTag,
  selectUserBalanceRow,
  selectUserRowById,
  selectUserRowsByIds,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { StaticDataRegistry } from '@babylon/engine';
import { logger, resolveUserIdentifierKind } from '@babylon/shared';
import {
  CACHE_KEYS,
  DEFAULT_TTLS,
  getCacheBatchOrFetch,
  getCacheOrFetch,
  invalidateCache,
  invalidateCachePattern,
} from './cache-service';

/**
 * Cached Database Service Class
 *
 * @description Wrapper class that adds caching to database operations.
 * Automatically caches query results with appropriate TTLs and provides
 * cache invalidation methods.
 */
class CachedDatabaseService {
  /**
   * Get recent posts with caching (cursor-based or offset-based pagination)
   *
   * @description Retrieves recent posts with caching. Supports both cursor-based
   * and offset-based pagination. Filters out posts from test users. Cache TTL
   * is short (10 seconds) due to real-time nature of posts.
   *
   * @param {number} limit - Number of posts to fetch (default: 100)
   * @param {string | number} [cursorOrOffset] - Cursor (ISO string) or offset (number)
   * @returns {Promise<Post[]>} Array of posts
   */
  async getRecentPosts(
    limit = 100,
    cursorOrOffset?: string | number
  ): Promise<Post[]> {
    const isCursor = typeof cursorOrOffset === 'string';
    const cacheKey = isCursor
      ? `${limit}:cursor:${cursorOrOffset}`
      : `${limit}:offset:${cursorOrOffset || 0}`;

    return getCacheOrFetch(
      cacheKey,
      () => fetchRecentPostsForGameService(limit, cursorOrOffset),
      {
        namespace: CACHE_KEYS.POSTS_LIST,
        ttl: DEFAULT_TTLS.POSTS_LIST,
      }
    );
  }

  /**
   * Get posts by actor with caching (cursor-based or offset-based pagination)
   */
  async getPostsByActor(
    authorId: string,
    limit = 100,
    cursorOrOffset?: string | number
  ): Promise<Post[]> {
    const isCursor = typeof cursorOrOffset === 'string';
    const cacheKey = isCursor
      ? `${authorId}:${limit}:cursor:${cursorOrOffset}`
      : `${authorId}:${limit}:offset:${cursorOrOffset || 0}`;

    return getCacheOrFetch(
      cacheKey,
      () => fetchPostsByActorForGameService(authorId, limit, cursorOrOffset),
      {
        namespace: CACHE_KEYS.POSTS_BY_ACTOR,
        ttl: DEFAULT_TTLS.POSTS_BY_ACTOR,
      }
    );
  }

  /**
   * Get posts for following feed with caching (cursor-based or offset-based pagination)
   * Filters out posts from test users
   */
  async getPostsForFollowing(
    userId: string,
    followedIds: string[],
    limit = 100,
    cursorOrOffset?: string | number
  ): Promise<Post[]> {
    const isCursor = typeof cursorOrOffset === 'string';
    const cacheKey = isCursor
      ? `${userId}:${limit}:cursor:${cursorOrOffset}`
      : `${userId}:${limit}:offset:${cursorOrOffset || 0}`;

    return getCacheOrFetch(
      cacheKey,
      async () => {
        const testUserIds = await selectTestUserIdsAmongFollowed(
          db,
          followedIds
        );

        const testActorIds = StaticDataRegistry.getAllActors()
          .filter((a) => a.isTest && followedIds.includes(a.id))
          .map((a) => a.id);

        const testAuthorIds = new Set([...testUserIds, ...testActorIds]);

        const nonTestFollowedIds = followedIds.filter(
          (id) => !testAuthorIds.has(id)
        );

        const cursor = isCursor ? (cursorOrOffset as string) : undefined;
        const offset =
          !isCursor && typeof cursorOrOffset === 'number' ? cursorOrOffset : 0;

        return selectPostsForFollowingFeed(db, {
          nonTestFollowedIds,
          limit,
          cursor,
          offset,
          now: new Date(),
        });
      },
      {
        namespace: CACHE_KEYS.POSTS_FOLLOWING,
        ttl: DEFAULT_TTLS.POSTS_FOLLOWING,
      }
    );
  }

  /**
   * Get user by ID with caching
   */
  async getUserById(userId: string) {
    const cacheKey = userId;

    return getCacheOrFetch(
      cacheKey,
      async () => {
        const row = await selectUserRowById(db, userId);
        return row ?? null;
      },
      {
        namespace: CACHE_KEYS.USER,
        ttl: DEFAULT_TTLS.USER,
      }
    );
  }

  /**
   * Get multiple users with caching using batch operations
   *
   * PERFORMANCE OPTIMIZATION: Uses batch cache get/set to reduce Redis
   * round-trips from N to 2 (one MGET, one pipeline SET for misses).
   * Critical for 400k+ users where N+1 cache lookups cause latency spikes.
   */
  async getUsersByIds(userIds: string[]) {
    if (userIds.length === 0) return [];

    const usersMap = await getCacheBatchOrFetch(
      userIds,
      async (missingIds) => {
        const rows = await selectUserRowsByIds(db, missingIds);
        return new Map(rows.map((user) => [user.id, user]));
      },
      {
        namespace: CACHE_KEYS.USER,
        ttl: DEFAULT_TTLS.USER,
      }
    );

    return userIds
      .map((id) => usersMap.get(id))
      .filter((u): u is NonNullable<typeof u> => u != null);
  }

  /**
   * Get user balance with caching
   */
  async getUserBalance(userId: string) {
    const cacheKey = userId;

    return getCacheOrFetch(
      cacheKey,
      async () => {
        const row = await selectUserBalanceRow(db, userId);
        return row ?? null;
      },
      {
        namespace: CACHE_KEYS.USER_BALANCE,
        ttl: DEFAULT_TTLS.USER_BALANCE,
      }
    );
  }

  /**
   * Get user profile stats with caching (followers, following, posts)
   *
   * PERFORMANCE OPTIMIZATION: Uses parallel Promise.all to execute all
   * count queries simultaneously, reducing latency by ~70% compared to
   * sequential execution. Combined with 1-minute caching.
   *
   * When `scopedClient` is passed (e.g. from `asUser` / `asPublic`), queries
   * run on that client and results are not cached — RLS-visible rows can
   * differ per viewer, so a shared cache key would be unsafe.
   */
  async getUserProfileStats(
    userId: string,
    scopedClient?: DrizzleClient
  ): Promise<{
    followers: number;
    following: number;
    positions: number;
    comments: number;
    reactions: number;
    posts: number;
  }> {
    if (scopedClient) {
      return fetchCachedUserProfileStats(scopedClient, userId);
    }

    const cacheKey = userId;

    return getCacheOrFetch(
      cacheKey,
      async () => fetchCachedUserProfileStats(db, userId),
      {
        namespace: 'user:profile:stats',
        ttl: 60,
      }
    );
  }

  /**
   * Get actor by ID with caching
   */
  async getActorById(actorId: string) {
    const staticActor = StaticDataRegistry.getActor(actorId);
    if (!staticActor) return null;

    const state = await fetchActorStateRowAsSystem(actorId);
    return {
      ...staticActor,
      tradingBalance: state?.tradingBalance ?? '10000',
      reputationPoints: state?.reputationPoints ?? 10000,
      hasPool: state?.hasPool ?? false,
    };
  }

  /**
   * Get multiple actors with caching
   */
  async getActorsByIds(actorIds: string[]) {
    const actorsResult = await Promise.all(
      actorIds.map((id) => this.getActorById(id))
    );

    return actorsResult.filter((a) => a !== null);
  }

  /**
   * Get organization by ID with caching
   */
  async getOrganizationById(orgId: string) {
    const staticOrg = StaticDataRegistry.getOrganization(orgId);
    if (!staticOrg) return null;

    const state = await fetchOrganizationStateRowAsSystem(orgId);
    return {
      ...staticOrg,
      currentPrice: state?.currentPrice ?? staticOrg.initialPrice,
    };
  }

  /**
   * Get active markets with caching
   */
  async getActiveMarkets() {
    const cacheKey = 'active';

    return getCacheOrFetch(cacheKey, () => selectActiveUnresolvedMarkets(db), {
      namespace: CACHE_KEYS.MARKETS_LIST,
      ttl: DEFAULT_TTLS.MARKETS_LIST,
    });
  }

  /**
   * Get trending tags with caching
   */
  async getTrendingTags(limit = 10) {
    const cacheKey = `${limit}`;

    return getCacheOrFetch(
      cacheKey,
      () => selectTrendingTagsWithTag(db, limit),
      {
        namespace: CACHE_KEYS.TRENDING_TAGS,
        ttl: DEFAULT_TTLS.TRENDING_TAGS,
      }
    );
  }

  /**
   * Invalidate cache for posts
   */
  async invalidatePostsCache() {
    logger.info('Invalidating posts cache', undefined, 'CachedDatabaseService');
    await Promise.all([
      invalidateCachePattern('*', { namespace: CACHE_KEYS.POSTS_LIST }),
      invalidateCachePattern('*', { namespace: CACHE_KEYS.POSTS_FOLLOWING }),
    ]);
  }

  /**
   * Invalidate cache for specific actor's posts
   */
  async invalidateActorPostsCache(actorId: string) {
    logger.info(
      'Invalidating actor posts cache',
      { actorId },
      'CachedDatabaseService'
    );
    await invalidateCachePattern(`${actorId}:*`, {
      namespace: CACHE_KEYS.POSTS_BY_ACTOR,
    });
  }

  /**
   * Invalidate cache for user
   */
  async invalidateUserCache(userId: string) {
    logger.info('Invalidating user cache', { userId }, 'CachedDatabaseService');
    await Promise.all([
      invalidateCache(userId, { namespace: CACHE_KEYS.USER }),
      invalidateCache(userId, { namespace: CACHE_KEYS.USER_BALANCE }),
      invalidateCache(userId, { namespace: 'user:profile:stats' }),
      invalidateCachePattern(`${userId}:*`, {
        namespace: CACHE_KEYS.POSTS_FOLLOWING,
      }),
      invalidateCachePattern('*', { namespace: 'user:follows' }),
    ]);
  }

  /**
   * Invalidate user identifier caches (id, privyId, username)
   *
   * @description Invalidates all identifier-based caches for a user. This includes
   * caches for id, privyId, and username lookups. Must be called whenever user
   * identifiers change (username update, privyId update, user creation).
   *
   * **WHY invalidate both old and new values?**
   * - Old values: When username changes from "alice" to "bob", the old cache key
   *   `username:alice` must be invalidated to prevent stale data
   * - New values: The new cache key `username:bob` should be invalidated so it gets
   *   refreshed on next lookup with the latest data from database
   * - This ensures cache stays in sync with database state
   *
   * **WHY invalidate on user creation?**
   * - Clears negative cache entries (cached null results for non-existent users)
   * - If user "alice" didn't exist, we cached null. When user is created, we must
   *   invalidate so next lookup finds the new user instead of returning cached null
   * - This is critical for signup flows - without invalidation, new users can't be found
   *
   * **WHY unified namespace?**
   * - All identifier caches in one namespace (`user:identifier`) reduces desync risk
   * - Single helper call invalidates all identifier caches for a user
   * - Easier to reason about and maintain than multiple namespaces
   *
   * @param {object} user - User object with id, privyId, and username
   * @param {object} [oldValues] - Old values for fields that changed (for invalidation of old cache keys)
   *
   * @example
   * ```typescript
   * // On username change
   * await cachedDb.invalidateUserIdentifierCaches(
   *   { id: userId, username: newUsername },
   *   { username: oldUsername }
   * );
   *
   * // On user creation (clears negative cache)
   * await cachedDb.invalidateUserIdentifierCaches({
   *   id: newUser.id,
   *   privyId: newUser.privyId,
   *   username: newUser.username,
   * });
   * ```
   */
  async invalidateUserIdentifierCaches(
    user: { id: string; privyId?: string | null; username?: string | null },
    oldValues?: { privyId?: string | null; username?: string | null }
  ) {
    const namespace = CACHE_KEYS.USER_IDENTIFIER;

    await invalidateCache(`id:${user.id}`, { namespace });

    if (resolveUserIdentifierKind(user.id) === 'privyId') {
      await invalidateCache(`privy:${user.id}`, { namespace });
    }

    if (oldValues?.privyId && oldValues.privyId !== user.privyId) {
      await invalidateCache(`privy:${oldValues.privyId}`, { namespace });
    }

    if (user.privyId) {
      await invalidateCache(`privy:${user.privyId}`, { namespace });
    }

    if (oldValues?.username && oldValues.username !== user.username) {
      await invalidateCache(`username:${oldValues.username.toLowerCase()}`, {
        namespace,
      });
    }

    if (user.username) {
      await invalidateCache(`username:${user.username.toLowerCase()}`, {
        namespace,
      });
    }

    await this.invalidateUserCache(user.id);
  }

  /**
   * Invalidate cache for markets
   */
  async invalidateMarketsCache() {
    logger.info(
      'Invalidating markets cache',
      undefined,
      'CachedDatabaseService'
    );
    await invalidateCachePattern('*', { namespace: CACHE_KEYS.MARKETS_LIST });
  }

  /**
   * Invalidate all caches (use sparingly!)
   */
  async invalidateAllCaches() {
    logger.warn('Invalidating all caches', undefined, 'CachedDatabaseService');
    await Promise.all([
      this.invalidatePostsCache(),
      this.invalidateMarketsCache(),
    ]);
  }
}

export const cachedDb = new CachedDatabaseService();
