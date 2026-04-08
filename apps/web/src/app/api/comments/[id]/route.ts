/**
 * Comment Management API
 *
 * @description
 * Edit or delete individual comments. Only comment authors can modify
 * their own comments. Includes cascade deletion of replies and reactions.
 *
 * **Features:**
 * - Author-only editing
 * - Author-only deletion
 * - Cascade delete (removes replies and reactions)
 * - Content validation
 * - RLS enforcement
 *
 * @openapi
 * /api/comments/{id}:
 *   patch:
 *     tags:
 *       - Comments
 *     summary: Edit comment
 *     description: Updates comment content (author only)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
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
 *                 description: Updated comment content
 *     responses:
 *       200:
 *         description: Comment updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 content:
 *                   type: string
 *                 author:
 *                   type: object
 *                 likeCount:
 *                   type: integer
 *                 replyCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the comment author
 *       404:
 *         description: Comment not found
 *   delete:
 *     tags:
 *       - Comments
 *     summary: Delete comment
 *     description: Deletes comment and all replies (author only)
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
 *         description: Comment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCommentId:
 *                   type: string
 *                 deletedRepliesCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the comment author
 *       404:
 *         description: Comment not found
 *
 * @example
 * ```typescript
 * // Edit comment
 * await fetch(`/api/comments/${commentId}`, {
 *   method: 'PATCH',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({
 *     content: 'Updated comment text'
 *   })
 * });
 *
 * // Delete comment
 * const response = await fetch(`/api/comments/${commentId}`, {
 *   method: 'DELETE',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { deletedRepliesCount } = await response.json();
 * console.log(`Deleted comment and ${deletedRepliesCount} replies`);
 * ```
 *
 * @see {@link /lib/db/context} RLS context
 */

import {
  AuthorizationError,
  authenticate,
  getCanonicalUserId,
  NotFoundError,
  optionalAuth,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  countCommentsOnPost,
  countDirectChildCommentsByParentId,
  countLikesOnComment,
  countPostLikes,
  countReplySubtreesBfsCappedPerRoot,
  countSharesOnPost,
  deleteCommentById,
  deleteCommentsWithParentCommentId,
  deleteReactionsForCommentId,
  deleteReactionsForCommentIds,
  selectCommentAncestorChainOldestFirst,
  selectCommentIdsInListLikedByUser,
  selectCommentReplyAuthorSliceByUserId,
  selectCommentRowById,
  selectDirectChildCommentIdsByParentId,
  selectDirectChildCommentsOrderCreatedAsc,
  selectGroupedCommentLikeCountsForCommentIds,
  selectPostCoreById,
  selectUserPostLikeExists,
  selectUserPostShareExists,
  selectUsersAuthorDisplayByIds,
  updateCommentContentByIdReturning,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { StaticDataRegistry } from '@babylon/engine';
import { IdParamSchema, logger, UpdateCommentSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';

import { MAX_REPLY_COUNT } from '@/lib/constants';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

const MAX_PARENT_DEPTH = 50;

/**
 * GET /api/comments/[id]
 * Get a single comment with its direct replies
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id: commentId } = IdParamSchema.parse(await context.params);

    const user = await optionalAuth(request);
    const canonicalUserId = user ? getCanonicalUserId(user) : undefined;

    return runWithOptionalUserRls(user, async (db) => {
      const comment = await selectCommentRowById(db, commentId);

      if (!comment) {
        throw new NotFoundError('Comment', commentId);
      }

      const post = await selectPostCoreById(db, comment.postId);

      let postAuthorName = post?.authorId || 'Unknown';
      let postAuthorUsername: string | null = null;
      let postAuthorProfileImageUrl: string | null = null;

      if (post) {
        const actor = StaticDataRegistry.getActor(post.authorId);
        if (actor) {
          postAuthorName = actor.name;
          postAuthorProfileImageUrl =
            actor.profileImageUrl || `/images/actors/${actor.id}.jpg`;
        } else {
          const org = StaticDataRegistry.getOrganization(post.authorId);
          if (org) {
            postAuthorName = org.name;
            postAuthorProfileImageUrl =
              org.imageUrl || `/images/organizations/${org.id}.jpg`;
          } else {
            const userRecord = await selectCommentReplyAuthorSliceByUserId(
              db,
              post.authorId
            );

            if (userRecord) {
              postAuthorName =
                userRecord.displayName || userRecord.username || post.authorId;
              postAuthorUsername = userRecord.username || null;
              postAuthorProfileImageUrl = userRecord.profileImageUrl || null;
            }
          }
        }
      }

      let postLikeCount = 0;
      let postCommentCount = 0;
      let postShareCount = 0;
      let postIsLiked = false;
      let postIsShared = false;

      if (post) {
        const [likes, commentsOnPost, sharesN] = await Promise.all([
          countPostLikes(db, post.id),
          countCommentsOnPost(db, post.id),
          countSharesOnPost(db, post.id),
        ]);
        postLikeCount = likes;
        postCommentCount = commentsOnPost;
        postShareCount = sharesN;

        if (canonicalUserId) {
          const [liked, shared] = await Promise.all([
            selectUserPostLikeExists(db, {
              postId: post.id,
              userId: canonicalUserId,
            }),
            selectUserPostShareExists(db, {
              postId: post.id,
              userId: canonicalUserId,
            }),
          ]);
          postIsLiked = liked;
          postIsShared = shared;
        }
      }

      const commentAuthor = await selectCommentReplyAuthorSliceByUserId(
        db,
        comment.authorId
      );

      const directReplies = await selectDirectChildCommentsOrderCreatedAsc(
        db,
        commentId
      );

      const replyAuthorIds = [...new Set(directReplies.map((r) => r.authorId))];

      const replyAuthors =
        replyAuthorIds.length > 0
          ? await selectUsersAuthorDisplayByIds(db, replyAuthorIds)
          : [];

      const authorMap = new Map(replyAuthors.map((a) => [a.id, a]));

      const allCommentIds = [commentId, ...directReplies.map((r) => r.id)];

      const likeCountMap = await selectGroupedCommentLikeCountsForCommentIds(
        db,
        allCommentIds
      );

      const userLikes =
        canonicalUserId !== undefined
          ? await selectCommentIdsInListLikedByUser(db, {
              commentIds: allCommentIds,
              userId: canonicalUserId,
            })
          : new Set<string>();

      const parentChainRaw = comment.parentCommentId
        ? await selectCommentAncestorChainOldestFirst(db, {
            startFromCommentId: comment.parentCommentId,
            maxDepth: MAX_PARENT_DEPTH,
          })
        : [];

      const parentAuthorIds = [
        ...new Set(parentChainRaw.map((p) => p.authorId)),
      ];
      const parentAuthors =
        parentAuthorIds.length > 0
          ? await selectUsersAuthorDisplayByIds(db, parentAuthorIds)
          : [];
      const parentAuthorMap = new Map(parentAuthors.map((a) => [a.id, a]));

      const parentChain = parentChainRaw.map((parent) => {
        const author = parentAuthorMap.get(parent.authorId);
        return {
          id: parent.id,
          content: parent.content,
          authorId: parent.authorId,
          authorName: author?.displayName || 'Unknown',
          authorUsername: author?.username || null,
          authorProfileImageUrl: author?.profileImageUrl || null,
          createdAt: parent.createdAt,
        };
      });

      const parentComment =
        parentChain.length > 0 ? parentChain[parentChain.length - 1] : null;

      const allIdsToCount = [commentId, ...directReplies.map((r) => r.id)];
      const replyCountMap = await countReplySubtreesBfsCappedPerRoot(db, {
        rootCommentIds: allIdsToCount,
        maxReplyCount: MAX_REPLY_COUNT,
      });

      const formattedComment = {
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        authorId: comment.authorId,
        authorName: commentAuthor?.displayName || 'Unknown',
        authorUsername: commentAuthor?.username || null,
        authorProfileImageUrl: commentAuthor?.profileImageUrl || null,
        parentCommentId: comment.parentCommentId,
        parentComment,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        likeCount: likeCountMap.get(commentId) || 0,
        replyCount: replyCountMap.get(commentId) || 0,
        isLiked: userLikes.has(commentId),
      };

      const formattedReplies = directReplies.map((reply) => {
        const author = authorMap.get(reply.authorId);
        return {
          id: reply.id,
          content: reply.content,
          postId: reply.postId,
          authorId: reply.authorId,
          authorName: author?.displayName || 'Unknown',
          authorUsername: author?.username || null,
          authorProfileImageUrl: author?.profileImageUrl || null,
          parentCommentId: reply.parentCommentId,
          parentCommentAuthorName: commentAuthor?.displayName || 'Unknown',
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
          likeCount: likeCountMap.get(reply.id) || 0,
          replyCount: replyCountMap.get(reply.id) || 0,
          isLiked: userLikes.has(reply.id),
        };
      });

      return successResponse({
        comment: formattedComment,
        replies: formattedReplies,
        parentChain,
        post: post
          ? {
              id: post.id,
              content: post.content,
              authorId: post.authorId,
              authorName: postAuthorName,
              authorUsername: postAuthorUsername,
              authorProfileImageUrl: postAuthorProfileImageUrl,
              createdAt: post.createdAt,
              likeCount: postLikeCount,
              commentCount: postCommentCount,
              shareCount: postShareCount,
              isLiked: postIsLiked,
              isShared: postIsShared,
            }
          : null,
      });
    });
  }
);

/**
 * PATCH /api/comments/[id]
 * Edit a comment (only by the author)
 */
export const PATCH = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const user = await authenticate(request);
    const { id: commentId } = IdParamSchema.parse(await context.params);

    const body = await request.json();
    const { content } = UpdateCommentSchema.parse(body);

    return asUser(user.userId, async (tx) => {
      const comment = await selectCommentRowById(tx, commentId);

      if (!comment) {
        throw new NotFoundError('Comment', commentId);
      }

      if (comment.authorId !== user.userId) {
        throw new AuthorizationError(
          'You can only edit your own comments',
          'comment',
          'edit'
        );
      }

      const now = new Date();
      const updatedComment = await updateCommentContentByIdReturning(tx, {
        commentId,
        content: content.trim(),
        updatedAt: now,
      });

      if (!updatedComment) {
        throw new NotFoundError('Comment', commentId);
      }

      const commentUser = await selectCommentReplyAuthorSliceByUserId(
        tx,
        updatedComment.authorId
      );

      const [likeCount, replyCount] = await Promise.all([
        countLikesOnComment(tx, commentId),
        countDirectChildCommentsByParentId(tx, commentId),
      ]);

      logger.info(
        'Comment updated successfully',
        { commentId, userId: user.userId },
        'PATCH /api/comments/[id]'
      );

      return successResponse({
        id: updatedComment.id,
        content: updatedComment.content,
        postId: updatedComment.postId,
        authorId: updatedComment.authorId,
        parentCommentId: updatedComment.parentCommentId,
        createdAt: updatedComment.createdAt,
        updatedAt: updatedComment.updatedAt,
        author: commentUser,
        likeCount,
        replyCount,
      });
    });
  }
);

/**
 * DELETE /api/comments/[id]
 * Delete a comment (only by the author)
 */
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const user = await authenticate(request);
    const { id: commentId } = IdParamSchema.parse(await context.params);

    return asUser(user.userId, async (tx) => {
      const comment = await selectCommentRowById(tx, commentId);

      if (!comment) {
        throw new NotFoundError('Comment', commentId);
      }

      if (comment.authorId !== user.userId) {
        throw new AuthorizationError(
          'You can only delete your own comments',
          'comment',
          'delete'
        );
      }

      const repliesCount = await countDirectChildCommentsByParentId(
        tx,
        commentId
      );

      const replyIds = await selectDirectChildCommentIdsByParentId(
        tx,
        commentId
      );

      await deleteReactionsForCommentIds(tx, replyIds);

      await deleteCommentsWithParentCommentId(tx, commentId);

      await deleteReactionsForCommentId(tx, commentId);

      await deleteCommentById(tx, commentId);

      logger.info(
        'Comment deleted successfully',
        { commentId, userId: user.userId, deletedRepliesCount: repliesCount },
        'DELETE /api/comments/[id]'
      );

      return successResponse({
        message: 'Comment deleted successfully',
        deletedCommentId: commentId,
        deletedRepliesCount: repliesCount,
      });
    });
  }
);
