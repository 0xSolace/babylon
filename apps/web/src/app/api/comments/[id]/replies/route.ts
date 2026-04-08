/**
 * Comment Replies API
 *
 * @route POST /api/comments/[id]/replies - Add reply to comment
 * @access Authenticated
 *
 * @description
 * Creates a reply to an existing comment. Automatically ensures parent post exists
 * and maintains comment threading. Replies are nested under their parent comment.
 *
 * @openapi
 * /api/comments/{id}/replies:
 *   post:
 *     tags:
 *       - Comments
 *     summary: Add reply to comment
 *     description: Creates a nested reply to an existing comment. Automatically ensures parent post exists.
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 description: Reply content
 *     responses:
 *       201:
 *         description: Reply created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 content:
 *                   type: string
 *                 postId:
 *                   type: string
 *                 authorId:
 *                   type: string
 *                 parentCommentId:
 *                   type: string
 *                 author:
 *                   type: object
 *                 likeCount:
 *                   type: integer
 *                 replyCount:
 *                   type: integer
 *       400:
 *         description: Invalid content
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Parent comment not found
 *
 * @example
 * ```typescript
 * const response = await fetch(`/api/comments/${commentId}/replies`, {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({
 *     content: 'This is my reply'
 *   })
 * });
 * const reply = await response.json();
 * ```
 *
 * @see {@link /lib/db/context} RLS context
 */

import {
  authenticate,
  BusinessLogicError,
  NotFoundError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  insertCommentReturning,
  insertGameGeneratedPostStubIfNotExists,
  selectCommentReplyAuthorSliceByUserId,
  selectCommentRowById,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import {
  CreateCommentSchema,
  generateSnowflakeId,
  IdParamSchema,
  logger,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';

/**
 * POST /api/comments/[id]/replies
 *
 * @description Add a reply to a comment
 *
 * @param {NextRequest} request - Request object
 * @param {Promise<{id: string}>} context.params - Route parameters
 *
 * @returns {Promise<NextResponse>} Created reply data
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    // Authenticate user
    const user = await authenticate(request);
    const { id: parentCommentId } = IdParamSchema.parse(await context.params);

    // Parse and validate request body
    const body = await request.json();
    const validatedData = CreateCommentSchema.parse(body);
    const { content } = validatedData;

    // Create reply with RLS
    const reply = await asUser(user, async (dbClient) => {
      const parentComment = await selectCommentRowById(
        dbClient,
        parentCommentId
      );

      if (!parentComment) {
        throw new NotFoundError('Parent comment', parentCommentId);
      }

      // Auto-create post if it doesn't exist (for consistency)
      // PostId format: gameId-authorId-timestamp
      const postId = parentComment.postId;
      const postParts = postId.split('-');
      if (postParts.length >= 3) {
        const gameId = postParts[0];
        const authorId = postParts[1];
        const timestampStr = postParts.slice(2).join('-');

        if (gameId && authorId) {
          await insertGameGeneratedPostStubIfNotExists(dbClient, {
            postId,
            authorId,
            gameId,
            timestamp: new Date(timestampStr),
          });
        }
      }

      const now = new Date();
      const replyId = await generateSnowflakeId();
      const newReply = await insertCommentReturning(dbClient, {
        id: replyId,
        content: content.trim(),
        postId: parentComment.postId,
        authorId: user.userId,
        parentCommentId,
        createdAt: now,
        updatedAt: now,
      });

      if (!newReply) {
        throw new BusinessLogicError('Failed to create reply', 'REPLY_FAILED');
      }

      const author = await selectCommentReplyAuthorSliceByUserId(
        dbClient,
        user.userId
      );

      return { ...newReply, author };
    });

    logger.info(
      'Reply created successfully',
      { parentCommentId, userId: user.userId, replyId: reply.id },
      'POST /api/comments/[id]/replies'
    );

    // New replies have 0 likes and 0 replies
    return successResponse(
      {
        id: reply.id,
        content: reply.content,
        postId: reply.postId,
        authorId: reply.authorId,
        parentCommentId: reply.parentCommentId,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: reply.author,
        likeCount: 0,
        replyCount: 0,
      },
      201
    );
  }
);
