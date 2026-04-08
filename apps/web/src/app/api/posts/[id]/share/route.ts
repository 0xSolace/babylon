/**
 * Post Share/Repost API
 *
 * @route POST /api/posts/[id]/share - Share/repost a post
 * @route DELETE /api/posts/[id]/share - Unshare/remove repost
 * @access Authenticated
 *
 * @description
 * Manages post sharing and reposting functionality. Creates repost posts that appear
 * in user feeds, handles quote posts with commentary, and manages share tracking.
 * Includes rate limiting, duplicate prevention, and automatic notifications.
 *
 * @openapi
 * /api/posts/{id}/share:
 *   post:
 *     tags:
 *       - Posts
 *     summary: Share/repost a post
 *     description: Creates a share/repost of a post. Optionally includes quote commentary. Creates repost post in user's feed.
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID to share
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *                 description: Optional quote comment/commentary
 *     responses:
 *       201:
 *         description: Post shared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     shareCount:
 *                       type: integer
 *                     isShared:
 *                       type: boolean
 *                     repostPost:
 *                       type: object
 *       400:
 *         description: Post already shared or invalid
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *       429:
 *         description: Rate limit exceeded
 *   delete:
 *     tags:
 *       - Posts
 *     summary: Unshare a post
 *     description: Removes share and deletes associated repost post
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID to unshare
 *     responses:
 *       200:
 *         description: Post unshared successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Share not found
 *
 * @example
 * ```typescript
 * // Share with quote comment
 * const response = await fetch(`/api/posts/${postId}/share`, {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({
 *     comment: 'Great analysis!'
 *   })
 * });
 *
 * // Unshare
 * await fetch(`/api/posts/${postId}/share`, {
 *   method: 'DELETE',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * ```
 *
 */

import type { JsonValue } from '@babylon/api';
import {
  authenticate,
  BusinessLogicError,
  broadcastToChannel,
  cachedDb,
  checkProgress,
  checkRateLimitAndDuplicates,
  ensureUserForAuth,
  getCanonicalUserId,
  invalidateCache,
  NotFoundError,
  narrativeEnrichmentKey,
  notifyShare,
  RATE_LIMIT_CONFIGS,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  countSharesForPostId,
  deletePostById,
  deleteShareById,
  hasBlocked,
  insertGamePostStubIfNotExists,
  insertRepostPostReturning,
  insertShareRow,
  selectOriginalPostContentAuthorTimestamp,
  selectPostAuthorIdById,
  selectPostIdContentOriginalById,
  selectPostShareTargetSliceById,
  selectRepostPostIdForAuthorAndOriginal,
  selectShareIdForUserAndPost,
  selectUserIdExists,
  selectUserUsernameDisplayProfileById,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import {
  NPCInteractionTracker,
  parsePostId,
  StaticDataRegistry,
} from '@babylon/engine';
import {
  generateSnowflakeId,
  isPureRepost,
  logger,
  PostIdParamSchema,
  SharePostSchema,
  toISO,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/posts/[id]/share
 *
 * Shares/reposts a post to the user's feed. Creates a repost post and share record.
 *
 * @param request - Next.js request containing optional quote comment
 * @param context - Route context with post ID parameter
 * @returns Share result with updated share count and repost post data
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    // Authenticate user
    const user = await authenticate(request);
    const { id: postId } = PostIdParamSchema.parse(await context.params);

    const rateLimitError = checkRateLimitAndDuplicates(
      user.userId,
      null,
      RATE_LIMIT_CONFIGS.SHARE_POST
    );
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = await request.json();
    const validatedBody =
      Object.keys(body).length > 0
        ? SharePostSchema.parse(body)
        : { comment: undefined };
    const quoteComment = validatedBody.comment?.trim();

    const fallbackDisplayName = user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Anonymous';

    const { user: canonicalUser } = await ensureUserForAuth(user, {
      displayName: fallbackDisplayName,
    });
    const canonicalUserId = canonicalUser.id;

    return asUser(user, async (db) => {
      const now = new Date();
      const post = await selectPostShareTargetSliceById(db, postId);

      let shareTargetPostId = postId;
      let shareTargetPost = post;

      if (post && isPureRepost(post)) {
        shareTargetPostId = post.originalPostId;
        const resolvedPost = await selectPostShareTargetSliceById(
          db,
          shareTargetPostId
        );

        if (!resolvedPost) {
          throw new NotFoundError('Post', shareTargetPostId);
        }

        shareTargetPost = resolvedPost;
      }

      if (shareTargetPost && shareTargetPost.timestamp > now) {
        throw new NotFoundError('Post', shareTargetPostId);
      }

      if (shareTargetPost) {
        const [isBlocked, hasBlockedMe] = await Promise.all([
          hasBlocked(shareTargetPost.authorId, canonicalUserId),
          hasBlocked(canonicalUserId, shareTargetPost.authorId),
        ]);

        if (isBlocked || hasBlockedMe) {
          throw new BusinessLogicError(
            'Cannot share this post',
            'BLOCKED_USER'
          );
        }
      }

      if (!post) {
        const parseResult = parsePostId(postId);

        if (!parseResult.success) {
          throw new BusinessLogicError(
            'Invalid post ID format',
            'INVALID_POST_ID_FORMAT'
          );
        }

        const { gameId, authorId, timestamp } = parseResult.metadata;

        await insertGamePostStubIfNotExists(db, {
          id: postId,
          content: '[Game-generated post]',
          authorId,
          gameId,
          timestamp,
        });
      } else if (shareTargetPost?.deletedAt) {
        throw new BusinessLogicError(
          'Cannot share deleted post',
          'POST_DELETED'
        );
      }

      const existingShare = await selectShareIdForUserAndPost(db, {
        userId: canonicalUserId,
        postId: shareTargetPostId,
      });

      if (existingShare) {
        throw new BusinessLogicError('Post already shared', 'ALREADY_SHARED');
      }

      // Backfill safety: legacy shares may still point at repost IDs
      if (post && isPureRepost(post) && shareTargetPostId !== postId) {
        const existingRepostShare = await selectShareIdForUserAndPost(db, {
          userId: canonicalUserId,
          postId,
        });

        if (existingRepostShare) {
          throw new BusinessLogicError('Post already shared', 'ALREADY_SHARED');
        }
      }

      await insertShareRow(db, {
        id: await generateSnowflakeId(),
        userId: canonicalUserId,
        postId: shareTargetPostId,
      });

      await NPCInteractionTracker.trackShare(
        canonicalUserId,
        shareTargetPostId
      );

      const repostId = await generateSnowflakeId();

      const originalPost = await selectOriginalPostContentAuthorTimestamp(
        db,
        shareTargetPostId
      );

      if (originalPost && originalPost.timestamp > now) {
        throw new NotFoundError('Post', shareTargetPostId);
      }

      let repostPostData = null;

      if (originalPost) {
        const originalUser = await selectUserUsernameDisplayProfileById(
          db,
          originalPost.authorId
        );

        const originalActor = StaticDataRegistry.getActor(
          originalPost.authorId
        );
        const originalOrg = StaticDataRegistry.getOrganization(
          originalPost.authorId
        );

        const originalAuthorName =
          originalUser?.displayName ||
          originalUser?.username ||
          originalActor?.name ||
          originalOrg?.name ||
          originalPost.authorId;
        const originalAuthorUsername =
          originalUser?.username || originalPost.authorId;
        const originalAuthorProfileImageUrl =
          originalUser?.profileImageUrl ||
          originalActor?.profileImageUrl ||
          originalOrg?.imageUrl;

        const repostContent = quoteComment || '';

        const createdRepost = await insertRepostPostReturning(db, {
          id: repostId,
          content: repostContent,
          authorId: canonicalUserId,
          timestamp: new Date(),
          originalPostId: shareTargetPostId,
        });

        if (!createdRepost) {
          throw new BusinessLogicError(
            'Failed to create repost',
            'CREATE_FAILED'
          );
        }

        repostPostData = {
          id: createdRepost.id,
          content: createdRepost.content,
          authorId: createdRepost.authorId,
          authorName:
            canonicalUser.username ||
            canonicalUser.displayName ||
            `user_${canonicalUserId.slice(0, 8)}`,
          authorUsername: canonicalUser.username,
          authorDisplayName: canonicalUser.displayName,
          authorProfileImageUrl: canonicalUser.profileImageUrl,
          timestamp: toISO(createdRepost.timestamp),
          isRepost: true,
          isQuote: !!quoteComment,
          originalPostId: shareTargetPostId,
          originalPost: {
            id: shareTargetPostId,
            content: originalPost.content,
            authorId: originalPost.authorId,
            authorName: originalAuthorName,
            authorUsername: originalAuthorUsername,
            authorProfileImageUrl: originalAuthorProfileImageUrl,
            timestamp: toISO(originalPost.timestamp),
          },
          quoteComment: quoteComment || null,
        };

        await cachedDb.invalidatePostsCache();
        await cachedDb.invalidateActorPostsCache(canonicalUserId);
        logger.info(
          'Invalidated post caches after repost',
          { repostId },
          'POST /api/posts/[id]/share'
        );

        broadcastToChannel('feed', {
          type: 'new_post',
          post: repostPostData as JsonValue,
        });
        logger.info(
          'Broadcast repost to feed channel',
          { repostId, postId: shareTargetPostId },
          'POST /api/posts/[id]/share'
        );
      }

      const postAuthor = await selectPostAuthorIdById(db, shareTargetPostId);

      if (
        postAuthor &&
        postAuthor.authorId &&
        postAuthor.authorId !== canonicalUserId
      ) {
        const postAuthorUser = await selectUserIdExists(
          db,
          postAuthor.authorId
        );

        if (postAuthorUser) {
          await notifyShare(
            postAuthor.authorId,
            canonicalUserId,
            shareTargetPostId
          );
        }
      }

      const shareCount = await countSharesForPostId(db, shareTargetPostId);

      // Bust the narrative enrichment cache so isShared reflects immediately
      invalidateCache(narrativeEnrichmentKey(canonicalUserId), {
        namespace: 'feed',
      }).catch((err) =>
        logger.warn(
          'Failed to invalidate narrative enrichment cache on share',
          { error: err, userId: canonicalUserId },
          'POST /api/posts/[id]/share'
        )
      );

      logger.info(
        'Post shared successfully',
        { postId: shareTargetPostId, userId: canonicalUserId, shareCount },
        'POST /api/posts/[id]/share'
      );

      trackServerEvent(canonicalUserId, 'post_shared', {
        postId: shareTargetPostId,
        ...(postAuthor?.authorId && { originalAuthorId: postAuthor.authorId }),
        shareCount,
        ...(repostId && { repostId }),
      });

      void checkProgress(canonicalUserId, { type: 'share_created' });

      return successResponse(
        {
          data: {
            shareCount,
            isShared: true,
            repostPost: repostPostData, // Include repost post data for optimistic UI
          },
        },
        201
      );
    });
  }
);

/**
 * DELETE /api/posts/[id]/share
 *
 * Unshares a post and removes the associated repost post from the user's feed.
 * Deletes the share record, removes the repost post if it exists, invalidates caches,
 * and updates share count. Tracks unshare event for analytics.
 *
 * @param request - Next.js request
 * @param context - Route context with post ID parameter
 * @returns Unshare result with updated share count and success status
 * @throws {401} Unauthorized
 * @throws {404} Share not found
 */
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    // Authenticate user
    const user = await authenticate(request);
    const { id: postId } = PostIdParamSchema.parse(await context.params);

    const fallbackDisplayName = user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Anonymous';

    await ensureUserForAuth(user, { displayName: fallbackDisplayName });
    const canonicalUserId = getCanonicalUserId(user);

    return asUser(user, async (db) => {
      let shareTargetPostId = postId;
      let share = await selectShareIdForUserAndPost(db, {
        userId: canonicalUserId,
        postId,
      });

      if (!share) {
        const post = await selectPostIdContentOriginalById(db, postId);

        if (post && isPureRepost(post)) {
          shareTargetPostId = post.originalPostId;
          share = await selectShareIdForUserAndPost(db, {
            userId: canonicalUserId,
            postId: shareTargetPostId,
          });
        }
      }

      if (!share) {
        throw new NotFoundError('Share', `${postId}-${canonicalUserId}`);
      }

      const repostPost = await selectRepostPostIdForAuthorAndOriginal(db, {
        authorId: canonicalUserId,
        originalPostId: shareTargetPostId,
      });

      if (repostPost) {
        await deletePostById(db, repostPost.id);
        logger.info(
          'Deleted repost post',
          {
            repostPostId: repostPost.id,
            originalPostId: shareTargetPostId,
            requestedPostId: postId,
          },
          'DELETE /api/posts/[id]/share'
        );
      } else {
        logger.warn(
          'No repost post found to delete',
          { postId: shareTargetPostId, userId: canonicalUserId },
          'DELETE /api/posts/[id]/share'
        );
      }

      await deleteShareById(db, share.id);

      const shareCount = await countSharesForPostId(db, shareTargetPostId);

      await cachedDb.invalidatePostsCache();
      await cachedDb.invalidateActorPostsCache(canonicalUserId);
      logger.info(
        'Invalidated post caches after unshare',
        { postId: shareTargetPostId, requestedPostId: postId },
        'DELETE /api/posts/[id]/share'
      );

      logger.info(
        'Post unshared successfully',
        { postId: shareTargetPostId, userId: canonicalUserId, shareCount },
        'DELETE /api/posts/[id]/share'
      );

      trackServerEvent(canonicalUserId, 'post_unshared', {
        postId: shareTargetPostId,
        shareCount,
      });

      return successResponse({
        data: {
          shareCount,
          isShared: false,
        },
      });
    });
  }
);
