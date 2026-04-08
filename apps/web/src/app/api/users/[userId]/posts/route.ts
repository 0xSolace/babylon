/**
 * User Posts API
 *
 * @route GET /api/users/[userId]/posts - Get user posts and replies
 * @access Public
 *
 * @description
 * Returns user's posts and comments/replies with interaction counts. Supports
 * filtering by type (posts or replies). Includes reposts/shares and excludes
 * future posts. Optimized with batch queries to prevent N+1 problems.
 *
 * @openapi
 * /api/users/{userId}/posts:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user posts and replies
 *     description: Returns user's posts or replies with interaction counts and author information
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID, username, or wallet address
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [posts, replies]
 *           default: posts
 *         description: Type of content to retrieve
 *     responses:
 *       200:
 *         description: User posts/replies retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [posts, replies]
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       content:
 *                         type: string
 *                       authorId:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       likeCount:
 *                         type: integer
 *                       commentCount:
 *                         type: integer
 *                       shareCount:
 *                         type: integer
 *                       isLiked:
 *                         type: boolean
 *                       isShared:
 *                         type: boolean
 *                 total:
 *                   type: integer
 *
 * @example
 * ```typescript
 * // Get user posts
 * const posts = await fetch('/api/users/user_123/posts?type=posts');
 *
 * // Get user replies
 * const replies = await fetch('/api/users/user_123/posts?type=replies');
 * ```
 *
 * @see {@link /lib/db/context} RLS context
 */

import {
  addPublicReadHeaders,
  findUserByIdentifier,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  fetchUserPostsFeedDbPayload,
  fetchUserRepliesFeedDbPayload,
} from '@babylon/db';
import { StaticDataRegistry } from '@babylon/engine';
import {
  logger,
  toISO,
  UserIdParamSchema,
  UserPostsQuerySchema,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

/**
 * GET /api/users/[userId]/posts
 * Get user's posts and comments/replies
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    const { error, user, rateLimitInfo } = await publicRateLimit(request);
    if (error) return error;

    const params = await context.params;
    const { userId } = UserIdParamSchema.parse(params);
    const targetUser = await findUserByIdentifier(userId, { id: true });

    // If user doesn't exist yet (new Privy user), return empty data
    if (!targetUser) {
      logger.info(
        'User not found - returning empty data (may be new Privy user)',
        { userId },
        'GET /api/users/[userId]/posts'
      );
      const emptyRes = successResponse({
        items: [],
        total: 0,
        type: 'posts',
      });
      if (rateLimitInfo) addPublicReadHeaders(emptyRes, rateLimitInfo);
      return emptyRes;
    }

    const canonicalUserId = targetUser.id;

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      type: searchParams.get('type') || 'posts',
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };
    const { type } = UserPostsQuerySchema.parse(queryParams);

    return runWithOptionalUserRls(user, async (db) => {
      if (type === 'replies') {
        const payload = await fetchUserRepliesFeedDbPayload(
          db,
          canonicalUserId,
          user?.userId
        );
        const { userComments } = payload;
        if (userComments.length === 0) {
          return successResponse({
            type: 'replies',
            items: [],
            total: 0,
          });
        }

        const postsMap = new Map(payload.postsData.map((p) => [p.id, p]));
        const parentCommentsMap = new Map(
          payload.parentCommentsData.map((c) => [c.id, c])
        );

        const likeCountsMap = new Map(
          payload.likeCountsResult.map((r) => [r.commentId, Number(r.count)])
        );
        const replyCountsMap = new Map(
          payload.replyCountsResult.map((r) => [
            r.parentCommentId,
            Number(r.count),
          ])
        );
        const userLikesSet = new Set(payload.userLikesCommentIds);

        const postLikeCountsMap = new Map(
          payload.postLikeCounts.map((r) => [r.postId, Number(r.count)])
        );
        const postCommentCountsMap = new Map(
          payload.postCommentCounts.map((r) => [r.postId, Number(r.count)])
        );
        const postShareCountsMap = new Map(
          payload.postShareCounts.map((r) => [r.postId, Number(r.count)])
        );

        const parentCommentLikeCountsMap = new Map(
          payload.parentCommentLikeCounts
            .filter(
              (r): r is typeof r & { commentId: string } => r.commentId !== null
            )
            .map((r) => [r.commentId, Number(r.count)])
        );
        const parentCommentReplyCountsMap = new Map(
          payload.parentCommentReplyCounts
            .filter(
              (r): r is typeof r & { parentCommentId: string } =>
                r.parentCommentId !== null
            )
            .map((r) => [r.parentCommentId, Number(r.count)])
        );

        const userPostLikesSet = new Set(payload.userPostLikes);
        const userPostSharesSet = new Set(payload.userPostShares);
        const userParentCommentLikesSet = new Set(
          payload.userParentCommentLikes
        );

        const userAuthorsMap = new Map(
          payload.authorsUsers.map((u) => [u.id, u])
        );

        // Helper function to get author info (same pattern as comment API)
        // Check StaticDataRegistry first (for actors/orgs), then database
        const getAuthorInfo = (
          authorId: string
        ): {
          id: string;
          displayName: string;
          username: string | null;
          profileImageUrl: string | null;
        } | null => {
          // Check if it's an actor (NPC/agent) - check FIRST like comment API
          const actor = StaticDataRegistry.getActor(authorId);
          if (actor) {
            return {
              id: actor.id,
              displayName: actor.name,
              username: null,
              profileImageUrl:
                actor.profileImageUrl || `/images/actors/${actor.id}.jpg`,
            };
          }
          // Check if it's an organization
          const org = StaticDataRegistry.getOrganization(authorId);
          if (org) {
            return {
              id: org.id,
              displayName: org.name,
              username: null,
              profileImageUrl:
                org.imageUrl || `/images/organizations/${org.id}.jpg`,
            };
          }
          // Fall back to database user lookup
          const dbUser = userAuthorsMap.get(authorId);
          if (dbUser) {
            return {
              id: dbUser.id,
              displayName: dbUser.displayName ?? dbUser.username ?? authorId,
              username: dbUser.username,
              profileImageUrl: dbUser.profileImageUrl,
            };
          }
          return null;
        };

        // Format comments as replies
        const replies = userComments.map((comment) => {
          const post = postsMap.get(comment.postId);

          // Get parent comment if this is a reply to a comment
          const parentComment = comment.parentCommentId
            ? parentCommentsMap.get(comment.parentCommentId)
            : null;

          return {
            id: comment.id,
            content: comment.content,
            postId: comment.postId,
            parentCommentId: comment.parentCommentId,
            createdAt: toISO(comment.createdAt),
            updatedAt: toISO(comment.updatedAt),
            likeCount: likeCountsMap.get(comment.id) ?? 0,
            replyCount: replyCountsMap.get(comment.id) ?? 0,
            isLiked: userLikesSet.has(comment.id),
            // Parent comment (if replying to a comment)
            parentComment: parentComment
              ? {
                  id: parentComment.id,
                  content: parentComment.content,
                  authorId: parentComment.authorId,
                  createdAt: toISO(parentComment.createdAt),
                  author: getAuthorInfo(parentComment.authorId),
                  likeCount:
                    parentCommentLikeCountsMap.get(parentComment.id) ?? 0,
                  replyCount:
                    parentCommentReplyCountsMap.get(parentComment.id) ?? 0,
                  isLiked: userParentCommentLikesSet.has(parentComment.id),
                }
              : null,
            // Original post (always included for context)
            post: post
              ? {
                  id: post.id,
                  content: post.content,
                  authorId: post.authorId,
                  timestamp: toISO(post.timestamp),
                  author: getAuthorInfo(post.authorId),
                  likeCount: postLikeCountsMap.get(post.id) ?? 0,
                  commentCount: postCommentCountsMap.get(post.id) ?? 0,
                  shareCount: postShareCountsMap.get(post.id) ?? 0,
                  isLiked: userPostLikesSet.has(post.id),
                  isShared: userPostSharesSet.has(post.id),
                }
              : null,
          };
        });

        logger.info(
          'User replies fetched successfully',
          { userId: canonicalUserId, total: replies.length },
          'GET /api/users/[userId]/posts'
        );

        return successResponse({
          type: 'replies',
          items: replies,
          total: replies.length,
        });
      }
      // Get user's posts - filter out future posts
      const now = new Date();
      const postsPayload = await fetchUserPostsFeedDbPayload(
        db,
        canonicalUserId,
        user?.userId,
        now
      );
      const { userPosts } = postsPayload;
      if (userPosts.length === 0) {
        return successResponse({
          type: 'posts',
          items: [],
          total: 0,
        });
      }

      const likeCountsMap = new Map(
        postsPayload.likeCountsResult.map((r) => [r.postId, Number(r.count)])
      );
      const commentCountsMap = new Map(
        postsPayload.commentCountsResult.map((r) => [r.postId, Number(r.count)])
      );
      const shareCountsMap = new Map(
        postsPayload.shareCountsResult.map((r) => [r.postId, Number(r.count)])
      );
      const userLikesSet = new Set(postsPayload.userLikedPostIds);
      const userSharesSet = new Set(postsPayload.userSharedPostIds);
      const postAuthor = postsPayload.postAuthor;

      const originalPostsMap = new Map(
        postsPayload.originalPosts.map((op) => [op.id, op])
      );

      const originalPostAuthorIds = [
        ...new Set(
          Array.from(originalPostsMap.values()).map((p) => p.authorId)
        ),
      ];

      let originalUserAuthorsMap = new Map<
        string,
        {
          id: string;
          displayName: string | null;
          username: string | null;
          profileImageUrl: string | null;
        }
      >();
      let originalActorAuthorsMap = new Map<
        string,
        { id: string; name: string; profileImageUrl: string | null }
      >();
      let originalOrgAuthorsMap = new Map<
        string,
        { id: string; name: string; imageUrl: string | null }
      >();

      if (originalPostAuthorIds.length > 0) {
        originalUserAuthorsMap = new Map(
          postsPayload.originalAuthorsUsers.map((u) => [u.id, u])
        );
        originalActorAuthorsMap = new Map(
          originalPostAuthorIds
            .map((id) => StaticDataRegistry.getActor(id))
            .filter((a): a is NonNullable<typeof a> => a !== null)
            .map((a) => [
              a.id,
              {
                id: a.id,
                name: a.name,
                profileImageUrl: a.profileImageUrl ?? null,
              },
            ])
        );
        originalOrgAuthorsMap = new Map(
          originalPostAuthorIds
            .map((id) => StaticDataRegistry.getOrganization(id))
            .filter((o): o is NonNullable<typeof o> => o !== null)
            .map((o) => [
              o.id,
              { id: o.id, name: o.name, imageUrl: o.imageUrl ?? null },
            ])
        );
      }

      const originalReactionMap = new Map(
        postsPayload.originalPostReactions.map((r) => [
          r.postId!,
          Number(r.count),
        ])
      );
      const originalCommentMap = new Map(
        postsPayload.originalPostComments.map((c) => [
          c.postId,
          Number(c.count),
        ])
      );
      const originalShareMap = new Map(
        postsPayload.originalPostShares.map((s) => [s.postId, Number(s.count)])
      );

      // Filter out reposts where the original post is deleted
      const validPosts = userPosts.filter((post) => {
        if (post.originalPostId) {
          const originalPost = originalPostsMap.get(post.originalPostId);
          const hasOriginalPost = originalPost && !originalPost.deletedAt;
          const isQuote = post.content && post.content.length > 0;

          // For quote posts, keep them even if original is deleted (user has commentary)
          // For simple reposts, filter out if original is deleted
          if (isQuote) {
            return true;
          }
          return hasOriginalPost;
        }
        return true;
      });

      // Format posts (includes both regular posts and reposts/quotes)
      const formattedPosts = validPosts.map((post) => {
        const basePost = {
          id: post.id,
          content: post.content,
          authorId: post.authorId,
          timestamp: toISO(post.timestamp),
          createdAt: toISO(post.createdAt),
          likeCount: likeCountsMap.get(post.id) ?? 0,
          commentCount: commentCountsMap.get(post.id) ?? 0,
          shareCount: shareCountsMap.get(post.id) ?? 0,
          isLiked: userLikesSet.has(post.id),
          isShared: userSharesSet.has(post.id),
          author: postAuthor
            ? {
                id: postAuthor.id,
                displayName: postAuthor.displayName,
                username: postAuthor.username,
                profileImageUrl: postAuthor.profileImageUrl,
              }
            : null,
        };

        // Check if this is a repost/quote
        if (post.originalPostId) {
          const isQuote = post.content && post.content.length > 0;
          const originalPost = originalPostsMap.get(post.originalPostId);

          // If original post exists and is not deleted
          if (originalPost && !originalPost.deletedAt) {
            // Get original post author info
            const originalUser = originalUserAuthorsMap.get(
              originalPost.authorId
            );
            const originalActor = originalActorAuthorsMap.get(
              originalPost.authorId
            );
            const originalOrg = originalOrgAuthorsMap.get(
              originalPost.authorId
            );

            // For simple reposts (not quotes), use the original post's interaction counts
            // For quote posts, keep the quote post's interaction counts
            const interactionCounts = !isQuote
              ? {
                  likeCount: originalReactionMap.get(originalPost.id) ?? 0,
                  commentCount: originalCommentMap.get(originalPost.id) ?? 0,
                  shareCount: originalShareMap.get(originalPost.id) ?? 0,
                }
              : {
                  likeCount: basePost.likeCount,
                  commentCount: basePost.commentCount,
                  shareCount: basePost.shareCount,
                };

            return {
              ...basePost,
              ...interactionCounts,
              isRepost: true,
              isQuote,
              quoteComment: isQuote ? post.content : null,
              originalPostId: originalPost.id,
              originalPost: {
                id: originalPost.id,
                content: originalPost.content,
                authorId: originalPost.authorId,
                authorName:
                  originalUser?.displayName ||
                  originalActor?.name ||
                  originalOrg?.name ||
                  originalPost.authorId,
                authorUsername: originalUser?.username || null,
                authorProfileImageUrl:
                  originalUser?.profileImageUrl ||
                  originalActor?.profileImageUrl ||
                  originalOrg?.imageUrl ||
                  null,
                timestamp: toISO(originalPost.timestamp),
              },
            };
          }

          // If original post is deleted but this is a quote post, return with null originalPost
          if (isQuote) {
            return {
              ...basePost,
              isRepost: true,
              isQuote: true,
              quoteComment: post.content,
              originalPostId: post.originalPostId,
              originalPost: null,
            };
          }
        }

        return basePost;
      });

      // Sort by timestamp (posts already include reposts/quotes)
      const allItems = formattedPosts.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      logger.info(
        'User posts fetched successfully',
        { userId: canonicalUserId, total: allItems.length },
        'GET /api/users/[userId]/posts'
      );

      const res = successResponse({
        type: 'posts',
        items: allItems,
        total: allItems.length,
      });
      if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
      return res;
    });
  }
);
