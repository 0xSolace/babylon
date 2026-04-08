/**
 * User Follow/Unfollow API Route
 *
 * @description Manage user following relationships for both users and NPC actors
 *
 * @route POST /api/users/[userId]/follow - Follow a user or actor
 * @route DELETE /api/users/[userId]/follow - Unfollow a user or actor
 * @route GET /api/users/[userId]/follow - Check follow status
 * @access Private (requires authentication)
 *
 * @openapi
 * /api/users/{userId}/follow:
 *   post:
 *     tags:
 *       - Users
 *     summary: Follow user or actor
 *     description: Follow a user or NPC actor. Creates a follow relationship and sends notification.
 *     operationId: followUser
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID or actor ID to follow
 *     responses:
 *       201:
 *         description: Successfully followed
 *       400:
 *         description: Already following or self-follow attempt
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or actor not found
 *   delete:
 *     tags:
 *       - Users
 *     summary: Unfollow user or actor
 *     description: Remove a follow relationship with a user or actor
 *     operationId: unfollowUser
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID or actor ID to unfollow
 *     responses:
 *       200:
 *         description: Successfully unfollowed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Follow relationship not found
 *   get:
 *     tags:
 *       - Users
 *     summary: Check follow status
 *     description: Check if authenticated user is following the specified user or actor
 *     operationId: checkFollowStatus
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID or actor ID to check
 *     responses:
 *       200:
 *         description: Follow status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isFollowing:
 *                   type: boolean
 *                   description: Whether user is following the target
 */

import {
  authenticate,
  BusinessLogicError,
  cachedDb,
  checkProgress,
  checkRateLimitAndDuplicates,
  findUserByIdentifier,
  InternalServerError,
  NotFoundError,
  notifyFollow,
  RATE_LIMIT_CONFIGS,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  deleteFollowById,
  deleteUserActorFollowById,
  insertUserActorFollowReturning,
  insertUserFollowReturning,
  selectFollowIdByFollowerAndFollowing,
  selectFollowIdForUpdateByFollowerAndFollowing,
  selectUserActorFollowIdByUserAndActor,
  selectUserFollowTargetDisplaySliceById,
  selectUserIdAndIsActorById,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { StaticDataRegistry } from '@babylon/engine';
import {
  generateSnowflakeId,
  logger,
  UserIdParamSchema,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/users/[userId]/follow
 *
 * Creates a follow relationship between the authenticated user and target user or actor.
 * Supports both regular users (via Follow model) and actors/NPCs (via UserActorFollow model).
 * Sends follow notifications, invalidates caches, and tracks analytics events.
 *
 * @param request - Next.js request object
 * @param context - Route context with user ID parameter (can be user ID or actor ID)
 * @returns Follow relationship data with target user/actor details
 * @throws {400} Already following, self-follow attempt, or rate limited
 * @throws {401} Unauthorized
 * @throws {404} Target user or actor not found
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    // Authenticate user
    const user = await authenticate(request);

    // Apply rate limiting (no duplicate detection needed)
    const rateLimitError = checkRateLimitAndDuplicates(
      user.userId,
      null,
      RATE_LIMIT_CONFIGS.FOLLOW_USER
    );
    if (rateLimitError) {
      return rateLimitError;
    }

    const params = await context.params;
    const { userId: targetIdentifier } = UserIdParamSchema.parse(params);
    const targetUser = await findUserByIdentifier(targetIdentifier, {
      id: true,
      isActor: true,
    });
    const targetId = targetUser?.id ?? targetIdentifier;

    // Prevent self-following
    if (targetUser && user.userId === targetId) {
      throw new BusinessLogicError('Cannot follow yourself', 'SELF_FOLLOW');
    }

    // Check if target exists (could be a user or actor)
    // Use static registry to check for actor
    const targetActorStatic = StaticDataRegistry.getActor(targetId);
    const targetActor = targetActorStatic ? { id: targetActorStatic.id } : null;

    // If neither user nor actor found, return error
    // Also error if targetUser has isActor flag but no Actor record exists
    if (!targetUser && !targetActor) {
      throw new NotFoundError('User or actor', targetId);
    }
    if (targetUser?.isActor && !targetActor) {
      throw new NotFoundError('Actor', targetId);
    }

    // If targetUser has isActor flag, treat as actor (not regular user)
    // Also check if targetActor exists (could be actor ID that doesn't match a user)
    if (targetUser && !targetUser.isActor) {
      const { newFollow, targetUserDetails } = await asUser(
        user,
        async (db) => {
          const existingFollow =
            await selectFollowIdForUpdateByFollowerAndFollowing(
              db,
              user.userId,
              targetId
            );

          if (existingFollow) {
            throw new BusinessLogicError(
              'Already following this user',
              'ALREADY_FOLLOWING'
            );
          }

          const followId = await generateSnowflakeId();
          const createdFollow = await insertUserFollowReturning(db, {
            id: followId,
            followerId: user.userId,
            followingId: targetId,
          });

          if (!createdFollow) {
            throw new InternalServerError('Failed to create follow record');
          }

          const targetUserDetailsRow =
            await selectUserFollowTargetDisplaySliceById(db, targetId);

          return {
            newFollow: createdFollow,
            targetUserDetails: targetUserDetailsRow,
          };
        }
      );

      // Create notification for the followed user
      await notifyFollow(targetId, user.userId);

      // Invalidate caches for both users to update follower/following counts
      await Promise.all([
        cachedDb.invalidateUserCache(user.userId), // Invalidate follower's cache
        cachedDb.invalidateUserCache(targetId), // Invalidate target's cache
      ]).catch((error) => {
        logger.warn('Failed to invalidate user cache after follow', { error });
      });

      logger.info(
        'User followed successfully',
        { userId: user.userId, targetId },
        'POST /api/users/[userId]/follow'
      );

      // Track user followed event
      trackServerEvent(user.userId, 'user_followed', {
        targetUserId: targetId,
        targetType: 'user',
        ...(targetUserDetails?.username && {
          targetUsername: targetUserDetails.username,
        }),
      }).catch((error) => {
        logger.warn('Failed to track user_followed event', { error });
      });

      if (!newFollow) {
        throw new InternalServerError('Failed to create follow record');
      }

      void checkProgress(user.userId, { type: 'follow_created' });

      return successResponse(
        {
          id: newFollow.id,
          following: targetUserDetails,
          createdAt: newFollow.createdAt,
        },
        201
      );
    }
    const actorDetails = StaticDataRegistry.getActor(targetId);

    const createdFollow = await asUser(user, async (db) => {
      const existingUserActorFollow =
        await selectUserActorFollowIdByUserAndActor(db, user.userId, targetId);

      if (existingUserActorFollow) {
        throw new BusinessLogicError(
          'Already following this actor',
          'ALREADY_FOLLOWING'
        );
      }

      const followId = await generateSnowflakeId();

      const row = await insertUserActorFollowReturning(db, {
        id: followId,
        userId: user.userId,
        actorId: targetId,
      });

      return row;
    });

    // Invalidate cache for the user to update following count
    await cachedDb.invalidateUserCache(user.userId).catch((error) => {
      logger.warn('Failed to invalidate user cache after actor follow', {
        error,
      });
    });

    logger.info(
      'Actor followed successfully',
      { userId: user.userId, npcId: targetId },
      'POST /api/users/[userId]/follow'
    );

    // Track actor followed event
    trackServerEvent(user.userId, 'user_followed', {
      targetUserId: targetId,
      targetType: 'actor',
      ...(actorDetails?.name && { actorName: actorDetails.name }),
      ...(actorDetails?.tier && { actorTier: actorDetails.tier }),
    }).catch((error) => {
      logger.warn('Failed to track user_followed event', { error });
    });

    if (!createdFollow) {
      throw new InternalServerError('Failed to fetch created follow record');
    }

    return successResponse(
      {
        id: createdFollow.id,
        actor: actorDetails,
        createdAt: createdFollow.createdAt,
      },
      201
    );
  }
);

/**
 * DELETE /api/users/[userId]/follow
 * Unfollow a user or actor
 */
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    // Authenticate user
    const user = await authenticate(request);

    // Apply rate limiting (no duplicate detection needed)
    const rateLimitError = checkRateLimitAndDuplicates(
      user.userId,
      null,
      RATE_LIMIT_CONFIGS.UNFOLLOW_USER
    );
    if (rateLimitError) {
      return rateLimitError;
    }

    const params = await context.params;
    const { userId: targetIdentifier } = UserIdParamSchema.parse(params);
    const targetUser = await findUserByIdentifier(targetIdentifier, {
      id: true,
      isActor: true,
    });
    const targetId = targetUser?.id ?? targetIdentifier;

    // If targetUser has isActor flag, treat as actor (not regular user)
    if (targetUser && !targetUser.isActor) {
      await asUser(user, async (db) => {
        const follow = await selectFollowIdByFollowerAndFollowing(
          db,
          user.userId,
          targetId
        );

        if (!follow) {
          throw new NotFoundError(
            'Follow relationship',
            `${user.userId}-${targetId}`
          );
        }

        await deleteFollowById(db, follow.id);
      });

      // Invalidate caches for both users to update follower/following counts
      await Promise.all([
        cachedDb.invalidateUserCache(user.userId), // Invalidate unfollower's cache
        cachedDb.invalidateUserCache(targetId), // Invalidate target's cache
      ]).catch((error) => {
        logger.warn('Failed to invalidate user cache after unfollow', {
          error,
        });
      });

      logger.info(
        'User unfollowed successfully',
        { userId: user.userId, targetId },
        'DELETE /api/users/[userId]/follow'
      );

      // Track user unfollowed event
      trackServerEvent(user.userId, 'user_unfollowed', {
        targetUserId: targetId,
        targetType: 'user',
      }).catch((error) => {
        logger.warn('Failed to track user_unfollowed event', { error });
      });

      return successResponse({
        message: 'Unfollowed successfully',
      });
    }
    await asUser(user, async (db) => {
      const existingUserActorFollow =
        await selectUserActorFollowIdByUserAndActor(db, user.userId, targetId);

      if (!existingUserActorFollow) {
        throw new NotFoundError('Follow status', `${user.userId}-${targetId}`);
      }

      await deleteUserActorFollowById(db, existingUserActorFollow.id);
    });

    // Invalidate cache for the user to update following count
    await cachedDb.invalidateUserCache(user.userId).catch((error) => {
      logger.warn('Failed to invalidate user cache after actor unfollow', {
        error,
      });
    });

    logger.info(
      'Actor unfollowed successfully',
      { userId: user.userId, npcId: targetId },
      'DELETE /api/users/[userId]/follow'
    );

    // Track actor unfollowed event
    trackServerEvent(user.userId, 'user_unfollowed', {
      targetUserId: targetId,
      targetType: 'actor',
    }).catch((error) => {
      logger.warn('Failed to track user_unfollowed event', { error });
    });

    return successResponse({
      message: 'Unfollowed successfully',
    });
  }
);

/**
 * GET /api/users/[userId]/follow
 * Check if current user is following the target
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    // Optional authentication - if not authenticated, return false
    const authUser = await authenticate(request).catch(() => null);
    const params = await context.params;
    const { userId: targetId } = UserIdParamSchema.parse(params);

    if (!authUser) {
      return successResponse({ isFollowing: false });
    }

    return asUser(authUser, async (db) => {
      const targetUser = await selectUserIdAndIsActorById(db, targetId);

      if (targetUser && !targetUser.isActor) {
        const follow = await selectFollowIdByFollowerAndFollowing(
          db,
          authUser.userId,
          targetId
        );

        logger.info(
          'Follow status checked',
          { userId: authUser.userId, targetId, isFollowing: !!follow },
          'GET /api/users/[userId]/follow'
        );

        return successResponse({
          isFollowing: !!follow,
        });
      }

      const targetActorData = StaticDataRegistry.getActor(targetId);

      if (targetActorData) {
        const userActorFollow = await selectUserActorFollowIdByUserAndActor(
          db,
          authUser.userId,
          targetId
        );

        const isFollowing = !!userActorFollow;
        logger.info(
          'Actor follow status checked',
          { userId: authUser.userId, npcId: targetId, isFollowing },
          'GET /api/users/[userId]/follow'
        );

        return successResponse({
          isFollowing,
        });
      }

      logger.info(
        'Follow status checked for non-existent target',
        { userId: authUser.userId, targetId },
        'GET /api/users/[userId]/follow'
      );

      return successResponse({
        isFollowing: false,
      });
    });
  }
);
