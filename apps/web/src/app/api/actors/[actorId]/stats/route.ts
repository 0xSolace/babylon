/**
 * Actor Statistics API
 *
 * @route GET /api/actors/[actorId]/stats
 * @access Public
 *
 * @description
 * Returns comprehensive statistics for a specific actor (NPC), including follower
 * counts (from both ActorFollow and UserActorFollow), following count, and post count.
 * Supports lookup by actor ID or name (case-insensitive).
 *
 * @openapi
 * /api/actors/{actorId}/stats:
 *   get:
 *     tags:
 *       - Actors
 *     summary: Get actor statistics
 *     description: Returns follower counts, following count, and post count for a specific actor. Supports lookup by ID or name.
 *     parameters:
 *       - in: path
 *         name: actorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Actor ID or name (case-insensitive)
 *     responses:
 *       200:
 *         description: Actor statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     followers:
 *                       type: integer
 *                       description: Total followers (actors + users)
 *                     following:
 *                       type: integer
 *                       description: Number of actors this actor follows
 *                     posts:
 *                       type: integer
 *                       description: Total posts by this actor
 *                     actorFollowers:
 *                       type: integer
 *                       description: Followers who are NPCs
 *                     userFollowers:
 *                       type: integer
 *                       description: Followers who are users
 *       404:
 *         description: Actor not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *
 * @param {string} actorId - Actor ID or name (path parameter)
 *
 * @returns {Promise<NextResponse>} Actor statistics including followers, following, and posts
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/actors/actor_123/stats');
 * const { stats } = await response.json();
 * console.log(stats.followers); // Total follower count
 * ```
 *
 * @see {@link @babylon/api} Error handling utilities
 */

import {
  addPublicReadHeaders,
  BusinessLogicError,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';

import { StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

/**
 * GET /api/actors/[actorId]/stats
 *
 * @description Get actor statistics (followers, following, posts)
 *
 * @param {NextRequest} _request - Request object
 * @param {Promise<{actorId: string}>} context.params - Route parameters
 *
 * @returns {Promise<NextResponse>} Actor statistics
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ actorId: string }> }
  ) => {
    const { error, user, rateLimitInfo } = await publicRateLimit(request);
    if (error) return error;

    const params = await context.params;
    const { actorId } = params;

    // Try to find actor by ID first, then by name (case-insensitive)
    let actor = StaticDataRegistry.getActor(actorId);

    // If not found by ID, try finding by name
    if (!actor) {
      actor =
        StaticDataRegistry.getAllActors().find(
          (a) => a.name.toLowerCase() === actorId.toLowerCase()
        ) ?? null;
    }

    if (!actor) {
      throw new BusinessLogicError(`Actor ${actorId} not found`, 'NOT_FOUND');
    }

    const actualActorId = actor.id;

    return runWithOptionalUserRls(user, async (scopedDb) => {
      const [
        actorFollowerCount,
        userActorFollowerCount,
        followingCount,
        postCount,
      ] = await Promise.all([
        scopedDb.actorFollow.count({
          where: { followingId: actualActorId },
        }),
        scopedDb.userActorFollow.count({
          where: {
            actorId: actualActorId,
          },
        }),
        scopedDb.actorFollow.count({
          where: { followerId: actualActorId },
        }),
        scopedDb.post.count({
          where: { authorId: actualActorId },
        }),
      ]);

      const totalFollowers = actorFollowerCount + userActorFollowerCount;

      logger.info(
        'Actor stats fetched successfully',
        {
          actorId,
          actualActorId,
          totalFollowers,
          actorFollowerCount,
          userActorFollowerCount,
          followingCount,
        },
        'GET /api/actors/[actorId]/stats'
      );

      const res = successResponse({
        stats: {
          followers: totalFollowers,
          following: followingCount,
          posts: postCount,
          actorFollowers: actorFollowerCount,
          userFollowers: userActorFollowerCount,
        },
      });
      if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
      return res;
    });
  }
);
