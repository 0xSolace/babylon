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

import { db, getDbInstance, type Post } from '@babylon/db';
import { StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import {
  CACHE_KEYS,
  DEFAULT_TTLS,
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
      () => getDbInstance().getRecentPosts(limit, cursorOrOffset),
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
      () => getDbInstance().getPostsByActor(authorId, limit, cursorOrOffset),
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
        // First, filter out test users from followedIds
        const testUsers =
          followedIds.length > 0
            ? await db.user.findMany({
                where: { AND: [{ id: { in: followedIds } }, { isTest: true }] },
              })
            : [];

        // Get test actors from static registry
        const testActorIds = StaticDataRegistry.getAllActors()
          .filter((a) => a.isTest && followedIds.includes(a.id))
          .map((a) => a.id);

        const testAuthorIds = new Set([
          ...testUsers.map((u) => u.id),
          ...testActorIds,
        ]);

        // Remove test users from followedIds
        const nonTestFollowedIds = followedIds.filter(
          (id) => !testAuthorIds.has(id)
        );

        if (nonTestFollowedIds.length === 0) {
          return [];
        }

        const cursor = isCursor ? (cursorOrOffset as string) : undefined;
        const offset =
          !isCursor && typeof cursorOrOffset === 'number' ? cursorOrOffset : 0;

        const now = new Date();

        // Query posts from database (only from non-test users)
        const result = await db.post.findMany({
          where: {
            AND: [
              { authorId: { in: nonTestFollowedIds } },
              { deletedAt: null },
              { timestamp: { lte: now } },
              ...(cursor ? [{ timestamp: { lt: new Date(cursor) } }] : []),
            ],
          },
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: cursor ? 0 : offset,
        });

        return result;
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
        return db.user.findUnique({ where: { id: userId } });
      },
      {
        namespace: CACHE_KEYS.USER,
        ttl: DEFAULT_TTLS.USER,
      }
    );
  }

  /**
   * Get multiple users with caching
   */
  async getUsersByIds(userIds: string[]) {
    // For bulk operations, we still cache individual users
    const usersResult = await Promise.all(
      userIds.map((id) => this.getUserById(id))
    );

    return usersResult.filter((u) => u !== null);
  }

  /**
   * Get user balance with caching
   */
  async getUserBalance(userId: string) {
    const cacheKey = userId;

    return getCacheOrFetch(
      cacheKey,
      async () => {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user) return null;
        return {
          virtualBalance: user.virtualBalance,
          totalDeposited: user.totalDeposited,
          totalWithdrawn: user.totalWithdrawn,
          lifetimePnL: user.lifetimePnL,
        };
      },
      {
        namespace: CACHE_KEYS.USER_BALANCE,
        ttl: DEFAULT_TTLS.USER_BALANCE,
      }
    );
  }

  /**
   * Get user profile stats with caching (followers, following, posts)
   */
  async getUserProfileStats(userId: string) {
    const cacheKey = userId;

    return getCacheOrFetch(
      cacheKey,
      async () => {
        const [
          followers,
          following,
          actorFollows,
          positions,
          comments,
          reactions,
          posts,
        ] = await Promise.all([
          db.follow.count({ where: { followingId: userId } }),
          db.follow.count({ where: { followerId: userId } }),
          db.userActorFollow.count({ where: { userId } }),
          db.position.count({ where: { userId } }),
          db.comment.count({ where: { authorId: userId } }),
          db.reaction.count({ where: { userId } }),
          db.post.count({ where: { authorId: userId } }),
        ]);

        return {
          followers,
          following: following + actorFollows,
          positions,
          comments,
          reactions,
          posts,
        };
      },
      {
        namespace: 'user:profile:stats',
        ttl: 60, // Cache for 1 minute
      }
    );
  }

  /**
   * Get actor by ID with caching
   */
  async getActorById(actorId: string) {
    // Static data from registry - no caching needed (already in memory)
    const staticActor = StaticDataRegistry.getActor(actorId);
    if (!staticActor) return null;

    // Optionally combine with dynamic state
    const state = await getDbInstance().getActorState(actorId);
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
    // Static data from registry - no caching needed (already in memory)
    const staticOrg = StaticDataRegistry.getOrganization(orgId);
    if (!staticOrg) return null;

    // Optionally combine with dynamic state
    const state = await getDbInstance().getOrganizationState(orgId);
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

    return getCacheOrFetch(
      cacheKey,
      async () => {
        return db.market.findMany({
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
        });
      },
      {
        namespace: CACHE_KEYS.MARKETS_LIST,
        ttl: DEFAULT_TTLS.MARKETS_LIST,
      }
    );
  }

  /**
   * Get trending tags with caching
   */
  async getTrendingTags(limit = 10) {
    const cacheKey = `${limit}`;

    return getCacheOrFetch(
      cacheKey,
      async () => {
        const trending = await db.trendingTag.findMany({
          orderBy: { rank: 'asc' },
          take: limit,
        });

        const tagIds = [...new Set(trending.map((t) => t.tagId))];
        const tags =
          tagIds.length > 0
            ? await db.tag.findMany({
                where: { id: { in: tagIds } },
              })
            : [];

        const tagsById = new Map(tags.map((t) => [t.id, t]));

        return trending.map((t) => {
          const tag = tagsById.get(t.tagId);
          return {
            id: t.id,
            tagId: t.tagId,
            rank: t.rank,
            score: t.score,
            postCount: t.postCount,
            calculatedAt: t.calculatedAt,
            tag: tag
              ? {
                  id: tag.id,
                  name: tag.name,
                  createdAt: tag.createdAt,
                  updatedAt: tag.updatedAt,
                }
              : null,
          };
        });
      },
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
      invalidateCachePattern('*', { namespace: 'user:follows' }), // Invalidate follows cache
    ]);
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
