/**
 * Comment Like API
 *
 * @route POST /api/comments/[id]/like - Like a comment
 * @route DELETE /api/comments/[id]/like - Unlike a comment
 * @access Authenticated
 *
 * @description
 * Manages like/unlike reactions on comments. Includes rate limiting, duplicate
 * prevention, and automatic notifications to comment authors.
 *
 * @openapi
 * /api/comments/{id}/like:
 *   post:
 *     tags:
 *       - Comments
 *     summary: Like a comment
 *     description: Adds a like reaction to a comment. Creates notification for comment author.
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       201:
 *         description: Comment liked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 commentId:
 *                   type: string
 *                 likeCount:
 *                   type: integer
 *                 isLiked:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Comment already liked
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Comment not found
 *       429:
 *         description: Rate limit exceeded
 *   delete:
 *     tags:
 *       - Comments
 *     summary: Unlike a comment
 *     description: Removes a like reaction from a comment
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment unliked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 commentId:
 *                   type: string
 *                 likeCount:
 *                   type: integer
 *                 isLiked:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Like not found
 *
 * @example
 * ```typescript
 * // Like a comment
 * const response = await fetch(`/api/comments/${commentId}/like`, {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { likeCount, isLiked } = await response.json();
 *
 * // Unlike a comment
 * await fetch(`/api/comments/${commentId}/like`, {
 *   method: 'DELETE',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * ```
 *
 * @see {@link /lib/services/notification-service} Notification service
 */

import {
  authenticate,
  BusinessLogicError,
  checkRateLimitAndDuplicates,
  ensureUserForAuth,
  NotFoundError,
  notifyReactionOnComment,
  RATE_LIMIT_CONFIGS,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  countLikesOnComment,
  deleteReactionById,
  insertCommentLikeReactionReturning,
  selectCommentIdAuthorIdPostIdById,
  selectCommentLikeReactionIdForUser,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { generateSnowflakeId, IdParamSchema, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

/**
 * POST /api/comments/[id]/like
 *
 * @description Like a comment
 *
 * @param {NextRequest} request - Request object
 * @param {Promise<{id: string}>} context.params - Route parameters
 *
 * @returns {Promise<NextResponse>} Like reaction data
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    // Authenticate user
    const user = await authenticate(request);
    const { id: commentId } = IdParamSchema.parse(await context.params);

    // Apply rate limiting (no duplicate detection needed - DB prevents duplicate likes)
    const rateLimitError = checkRateLimitAndDuplicates(
      user.userId,
      null,
      RATE_LIMIT_CONFIGS.LIKE_COMMENT
    );
    if (rateLimitError) {
      return rateLimitError;
    }

    // Ensure user exists in database (upsert pattern)
    const displayName = user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Anonymous';

    const { user: dbUser } = await ensureUserForAuth(user, { displayName });
    const canonicalUserId = dbUser.id;

    return asUser(user, async (db) => {
      const comment = await selectCommentIdAuthorIdPostIdById(db, commentId);

      if (!comment) {
        throw new NotFoundError('Comment', commentId);
      }

      const existingReaction = await selectCommentLikeReactionIdForUser(db, {
        commentId,
        userId: canonicalUserId,
      });

      if (existingReaction) {
        throw new BusinessLogicError('Comment already liked', 'ALREADY_LIKED');
      }

      const reactionId = await generateSnowflakeId();
      const reaction = await insertCommentLikeReactionReturning(db, {
        id: reactionId,
        commentId,
        userId: canonicalUserId,
      });

      if (!reaction) {
        throw new BusinessLogicError(
          'Failed to create reaction',
          'REACTION_FAILED'
        );
      }

      if (comment.authorId && comment.authorId !== canonicalUserId) {
        await notifyReactionOnComment(
          comment.authorId,
          canonicalUserId,
          commentId,
          comment.postId,
          'like'
        );
      }

      const likeCount = await countLikesOnComment(db, commentId);

      logger.info(
        'Comment liked successfully',
        { commentId, userId: canonicalUserId, likeCount },
        'POST /api/comments/[id]/like'
      );

      return successResponse(
        {
          data: {
            id: reaction.id,
            commentId,
            likeCount,
            isLiked: true,
            createdAt: reaction.createdAt,
          },
        },
        201
      );
    });
  }
);

/**
 * DELETE /api/comments/[id]/like
 *
 * @description Unlike a comment
 *
 * @param {NextRequest} request - Request object
 * @param {Promise<{id: string}>} context.params - Route parameters
 *
 * @returns {Promise<NextResponse>} Unlike confirmation
 */
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    // Authenticate user
    const user = await authenticate(request);
    const { id: commentId } = IdParamSchema.parse(await context.params);

    // Ensure user exists in database (upsert pattern)
    const displayName = user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Anonymous';

    const { user: dbUser } = await ensureUserForAuth(user, { displayName });
    const canonicalUserId = dbUser.id;

    return asUser(user, async (db) => {
      const reaction = await selectCommentLikeReactionIdForUser(db, {
        commentId,
        userId: canonicalUserId,
      });

      if (!reaction) {
        throw new NotFoundError('Like', `${commentId}-${canonicalUserId}`);
      }

      await deleteReactionById(db, reaction.id);

      const likeCount = await countLikesOnComment(db, commentId);

      logger.info(
        'Comment unliked successfully',
        { commentId, userId: canonicalUserId, likeCount },
        'DELETE /api/comments/[id]/like'
      );

      return successResponse({
        data: {
          commentId,
          likeCount,
          isLiked: false,
          message: 'Comment unliked successfully',
        },
      });
    });
  }
);
