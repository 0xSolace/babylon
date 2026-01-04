import {
  and,
  comments,
  db,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  markets,
  type Post,
  posts,
  reactions,
  shares,
  users,
} from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { Elysia, t } from 'elysia'
import type { Hex } from 'viem'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'
import {
  checkHubHealth,
  fetchFarcasterFeedPosts,
  getFollowingFids,
  postToFarcaster,
  storeSignerKey,
} from '../services/farcaster'

/**
 * Post routes
 * Migrated from: apps/web/app/api/posts/* and apps/web/app/api/feed/*
 */
const createPostsRoutes = () =>
  new Elysia({ prefix: '/api' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // List posts / feed
    // Migrated from: apps/web/app/api/feed/route.ts
    .get(
      '/posts',
      async (ctx) => {
        const { user } = getAuthContext(ctx)
        const { query } = ctx
        const limit = Math.min(Number.parseInt(query.limit || '20', 10), 100)
        const cursor = query.cursor
        const authorId = query.userId

        const conditions = [isNull(posts.deletedAt)]

        if (cursor) {
          conditions.push(lt(posts.timestamp, new Date(cursor)))
        }

        if (authorId) {
          conditions.push(eq(posts.authorId, authorId))
        }

        // First, get the posts
        const feedPosts = (await db
          .select()
          .from(posts)
          .where(and(...conditions))
          .orderBy(desc(posts.timestamp))
          .limit(limit + 1)) as unknown as Post[]

        // Get unique author IDs (filter out null/undefined with type guard)
        const authorIds = Array.from(
          new Set(
            feedPosts
              .map((p) => p.authorId)
              .filter((id): id is string => typeof id === 'string'),
          ),
        )

        // Fetch author details
        const authorMap = new Map<
          string,
          {
            username: string | null
            displayName: string | null
            profileImageUrl: string | null
          }
        >()
        if (authorIds.length > 0) {
          const authorsResult = await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              profileImageUrl: users.profileImageUrl,
            })
            .from(users)
            .where(inArray(users.id, authorIds))

          for (const author of authorsResult) {
            authorMap.set(author.id, {
              username: author.username,
              displayName: author.displayName,
              profileImageUrl: author.profileImageUrl,
            })
          }
        }

        // Map posts with author info
        const feedPostsWithAuthor = feedPosts.map((post) => {
          const authorId = post.authorId ?? ''
          return {
            id: post.id,
            content: post.content,
            authorId: post.authorId,
            type: post.type,
            timestamp: post.timestamp,
            imageUrl: post.imageUrl,
            articleTitle: post.articleTitle,
            commentOnPostId: post.commentOnPostId,
            originalPostId: post.originalPostId,
            authorUsername: authorMap.get(authorId)?.username ?? null,
            authorDisplayName: authorMap.get(authorId)?.displayName ?? null,
            authorProfileImageUrl:
              authorMap.get(authorId)?.profileImageUrl ?? null,
          }
        })

        const hasMore = feedPostsWithAuthor.length > limit
        const resultPosts = hasMore
          ? feedPostsWithAuthor.slice(0, -1)
          : feedPostsWithAuthor
        const lastTimestamp = resultPosts[resultPosts.length - 1]?.timestamp
        const nextCursor =
          hasMore && resultPosts.length > 0 && lastTimestamp
            ? lastTimestamp instanceof Date
              ? lastTimestamp.toISOString()
              : String(lastTimestamp)
            : null

        // Get like counts for each post
        const postIds = resultPosts.map((p) => p.id)
        const likeCountMap = new Map<string, number>()

        if (postIds.length > 0) {
          // Get likes for these posts
          const allLikes = await db
            .select({ postId: reactions.postId })
            .from(reactions)
            .where(
              and(
                eq(reactions.type, 'like'),
                inArray(reactions.postId, postIds),
              ),
            )

          // Count likes per post
          for (const like of allLikes) {
            if (like.postId) {
              likeCountMap.set(
                like.postId,
                (likeCountMap.get(like.postId) ?? 0) + 1,
              )
            }
          }
        }

        // Get user's own likes if authenticated
        const userLikes = new Set<string>()
        if (user) {
          const likes = await db
            .select({ postId: reactions.postId })
            .from(reactions)
            .where(
              and(
                eq(reactions.userId, user.userId),
                eq(reactions.type, 'like'),
              ),
            )
          likes.forEach((l) => {
            if (l.postId) {
              userLikes.add(l.postId)
            }
          })
        }

        const postsWithMeta = resultPosts.map((post) => ({
          ...post,
          // Add required fields for FeedPostSchema
          author: post.authorId, // Use authorId as author identifier
          authorName:
            post.authorDisplayName || post.authorUsername || post.authorId,
          // Keep optional author fields
          authorUsername: post.authorUsername,
          authorProfileImageUrl: post.authorProfileImageUrl,
          // Counts
          likeCount: likeCountMap.get(post.id) ?? 0,
          isLiked: userLikes.has(post.id),
        }))

        logger.info(
          'Feed fetched',
          { count: postsWithMeta.length, hasMore, userId: user?.userId },
          'GET /api/posts',
        )

        return {
          success: true,
          posts: postsWithMeta,
          cursor: nextCursor,
          hasMore,
        }
      },
      {
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          filter: t.Optional(t.String()),
          userId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'List posts',
        },
      },
    )

    // Get post by ID
    // Migrated from: apps/web/app/api/posts/[id]/route.ts
    .get(
      '/posts/:id',
      async (ctx) => {
        const { user } = getAuthContext(ctx)
        const { params, set } = ctx

        const postResult = (await db
          .select()
          .from(posts)
          .where(and(eq(posts.id, params.id), isNull(posts.deletedAt)))
          .limit(1)) as unknown as Post[]
        const post = postResult[0]

        if (!post) {
          set.status = 404
          return { error: 'Post not found' }
        }

        // Get like count
        const likes = await db
          .select({ id: reactions.id })
          .from(reactions)
          .where(
            and(eq(reactions.postId, params.id), eq(reactions.type, 'like')),
          )
        const likeCount = likes.length

        // Check if user liked this post
        let isLiked = false
        if (user) {
          const [userLike] = await db
            .select()
            .from(reactions)
            .where(
              and(
                eq(reactions.postId, params.id),
                eq(reactions.userId, user.userId),
                eq(reactions.type, 'like'),
              ),
            )
            .limit(1)
          isLiked = !!userLike
        }

        // Get comments
        const postComments = await db
          .select()
          .from(comments)
          .where(
            and(eq(comments.postId, params.id), isNull(comments.deletedAt)),
          )
          .orderBy(desc(comments.createdAt))
          .limit(50)

        return {
          success: true,
          post: {
            ...post,
            likeCount,
            isLiked,
            comments: postComments,
          },
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Get post by ID',
        },
      },
    )

    // Create post
    // Migrated from: apps/web/app/api/posts/route.ts
    .post(
      '/posts',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Type assertion for body (Elysia type inference limitation)
        const body = ctx.body as {
          content: string
          mediaUrls?: string[]
          replyTo?: string
          quotedPostId?: string
          postToFarcaster?: boolean
        }

        const {
          content,
          mediaUrls,
          replyTo,
          quotedPostId,
          postToFarcaster: shouldPostToFarcaster,
        } = body

        if (!content || content.trim().length === 0) {
          set.status = 400
          return { error: 'Content is required' }
        }

        const postId = await generateSnowflakeId()
        const now = new Date()

        const [newPost] = await db
          .insert(posts)
          .values({
            id: postId,
            content: content.trim(),
            authorId: user.userId,
            type: replyTo ? 'comment' : quotedPostId ? 'quote' : 'post',
            timestamp: now,
            createdAt: now,
            imageUrl: mediaUrls?.[0] ?? null,
            commentOnPostId: replyTo ?? null,
            originalPostId: quotedPostId ?? null,
          })
          .returning()

        if (!newPost) {
          set.status = 500
          return { error: 'Failed to create post' }
        }

        // Post to Farcaster if requested and user has Farcaster linked
        let farcasterHash: string | null = null
        if (shouldPostToFarcaster) {
          try {
            const farcasterResult = await postToFarcaster(
              user.userId,
              content.trim(),
              { embeds: mediaUrls },
            )

            farcasterHash = farcasterResult.hash
            // Update post with Farcaster hash in metadata
            await db
              .update(posts)
              .set({
                metadata: {
                  farcasterHash: farcasterResult.hash,
                  source: 'local+farcaster',
                },
              })
              .where(eq(posts.id, postId))

            logger.info(
              'Posted to Farcaster',
              {
                postId,
                userId: user.userId,
                farcasterHash: farcasterResult.hash,
              },
              'POST /api/posts',
            )
          } catch (farcasterError) {
            // Log but don't fail the local post creation
            logger.warn(
              'Failed to post to Farcaster',
              {
                postId,
                userId: user.userId,
                error:
                  farcasterError instanceof Error
                    ? farcasterError.message
                    : 'Unknown',
              },
              'POST /api/posts',
            )
          }
        }

        logger.info(
          'Post created',
          { postId, userId: user.userId, type: newPost.type, farcasterHash },
          'POST /api/posts',
        )

        return {
          success: true,
          post: newPost,
          farcasterHash,
        }
      },
      {
        body: t.Object({
          content: t.String(),
          mediaUrls: t.Optional(t.Array(t.String())),
          replyTo: t.Optional(t.String()),
          quotedPostId: t.Optional(t.String()),
          postToFarcaster: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Create post',
          description:
            'Create a new post. If postToFarcaster is true and user has Farcaster linked, also posts to Farcaster.',
        },
      },
    )

    // Delete post
    // Migrated from: apps/web/app/api/posts/[id]/route.ts
    .delete(
      '/posts/:id',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const deleteQueryResult = (await db
          .select()
          .from(posts)
          .where(eq(posts.id, params.id))
          .limit(1)) as unknown as Post[]
        const post = deleteQueryResult[0]

        if (!post) {
          set.status = 404
          return { error: 'Post not found' }
        }

        if (post.authorId !== user.userId && !user.isAdmin) {
          set.status = 403
          return { error: 'Forbidden' }
        }

        await db
          .update(posts)
          .set({ deletedAt: new Date() })
          .where(eq(posts.id, params.id))

        logger.info(
          'Post deleted',
          { postId: params.id, userId: user.userId },
          'DELETE /api/posts/:id',
        )

        return { success: true }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Delete post',
        },
      },
    )

    // Like post
    // Migrated from: apps/web/app/api/posts/[id]/like/route.ts
    .post(
      '/posts/:id/like',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Check if post exists
        const [post] = await db
          .select()
          .from(posts)
          .where(and(eq(posts.id, params.id), isNull(posts.deletedAt)))
          .limit(1)

        if (!post) {
          set.status = 404
          return { error: 'Post not found' }
        }

        // Check if already liked
        const [existingLike] = await db
          .select()
          .from(reactions)
          .where(
            and(
              eq(reactions.postId, params.id),
              eq(reactions.userId, user.userId),
              eq(reactions.type, 'like'),
            ),
          )
          .limit(1)

        if (existingLike) {
          return { success: true, message: 'Already liked' }
        }

        // Create like
        const reactionId = await generateSnowflakeId()
        await db.insert(reactions).values({
          id: reactionId,
          postId: params.id,
          userId: user.userId,
          type: 'like',
          createdAt: new Date(),
        })

        logger.info(
          'Post liked',
          { postId: params.id, userId: user.userId },
          'POST /api/posts/:id/like',
        )

        return { success: true }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Like post',
        },
      },
    )

    // Unlike post
    // Migrated from: apps/web/app/api/posts/[id]/like/route.ts
    .delete(
      '/posts/:id/like',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        await db
          .delete(reactions)
          .where(
            and(
              eq(reactions.postId, params.id),
              eq(reactions.userId, user.userId),
              eq(reactions.type, 'like'),
            ),
          )

        logger.info(
          'Post unliked',
          { postId: params.id, userId: user.userId },
          'DELETE /api/posts/:id/like',
        )

        return { success: true }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Unlike post',
        },
      },
    )

    // Repost
    // Migrated from: apps/web/app/api/posts/[id]/repost/route.ts
    .post(
      '/posts/:id/repost',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Check if post exists
        const [originalPost] = await db
          .select()
          .from(posts)
          .where(and(eq(posts.id, params.id), isNull(posts.deletedAt)))
          .limit(1)

        if (!originalPost) {
          set.status = 404
          return { error: 'Post not found' }
        }

        // Check if already reposted
        const [existingRepost] = await db
          .select()
          .from(shares)
          .where(
            and(eq(shares.postId, params.id), eq(shares.userId, user.userId)),
          )
          .limit(1)

        if (existingRepost) {
          return { success: true, message: 'Already reposted' }
        }

        // Create repost
        const shareId = await generateSnowflakeId()
        await db.insert(shares).values({
          id: shareId,
          postId: params.id,
          userId: user.userId,
          createdAt: new Date(),
        })

        logger.info(
          'Post reposted',
          { postId: params.id, userId: user.userId },
          'POST /api/posts/:id/repost',
        )

        return { success: true }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Repost',
        },
      },
    )

    // Add comment to post
    // Migrated from: apps/web/app/api/posts/[id]/comment/route.ts
    .post(
      '/posts/:id/comment',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Type assertion for body (Elysia type inference limitation)
        const body = ctx.body as {
          content: string
          parentCommentId?: string
        }
        const { content, parentCommentId } = body

        if (!content || content.trim().length === 0) {
          set.status = 400
          return { error: 'Content is required' }
        }

        // Check if post exists
        const [post] = await db
          .select()
          .from(posts)
          .where(and(eq(posts.id, params.id), isNull(posts.deletedAt)))
          .limit(1)

        if (!post) {
          set.status = 404
          return { error: 'Post not found' }
        }

        const commentId = await generateSnowflakeId()
        const now = new Date()

        const [newComment] = await db
          .insert(comments)
          .values({
            id: commentId,
            content: content.trim(),
            postId: params.id,
            authorId: user.userId,
            parentCommentId: parentCommentId ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning()

        logger.info(
          'Comment created',
          { commentId, postId: params.id, userId: user.userId },
          'POST /api/posts/:id/comment',
        )

        return {
          success: true,
          comment: newComment,
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          content: t.String(),
          parentCommentId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Comment on post',
        },
      },
    )

    // Get comment replies
    // Migrated from: apps/web/app/api/comments/[id]/replies/route.ts
    .get(
      '/comments/:id/replies',
      async ({ params, query }) => {
        const limit = Math.min(Number.parseInt(query.limit || '20', 10), 100)
        const cursor = query.cursor

        const conditions = [
          eq(comments.parentCommentId, params.id),
          isNull(comments.deletedAt),
        ]

        if (cursor) {
          conditions.push(lt(comments.createdAt, new Date(cursor)))
        }

        const replies = await db
          .select({
            id: comments.id,
            content: comments.content,
            postId: comments.postId,
            authorId: comments.authorId,
            parentCommentId: comments.parentCommentId,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            deletedAt: comments.deletedAt,
          })
          .from(comments)
          .where(and(...conditions))
          .orderBy(desc(comments.createdAt))
          .limit(limit + 1)

        const hasMore = replies.length > limit
        const resultReplies = hasMore ? replies.slice(0, -1) : replies
        const nextCursor =
          hasMore && resultReplies.length > 0
            ? resultReplies[resultReplies.length - 1]?.createdAt?.toISOString()
            : null

        return {
          success: true,
          replies: resultReplies,
          nextCursor,
          hasMore,
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Get comment replies',
        },
      },
    )

    // Feed widgets - stats
    .get(
      '/feed/widgets/stats',
      async () => {
        // Get platform stats
        const postsList = await db
          .select({ id: posts.id })
          .from(posts)
          .limit(10000)
        const usersList = await db
          .select({ id: users.id })
          .from(users)
          .limit(10000)
        const reactionsList = await db
          .select({ id: reactions.id })
          .from(reactions)
          .limit(10000)

        return {
          success: true,
          stats: {
            totalPosts: postsList.length,
            totalUsers: usersList.length,
            totalReactions: reactionsList.length,
            activeUsers24h: 0,
            newPosts24h: 0,
          },
        }
      },
      {
        detail: {
          tags: ['Posts', 'Widgets'],
          summary: 'Get feed stats widget data',
        },
      },
    )

    // Feed widgets - trending (alias for trending-posts)
    .get(
      '/feed/widgets/trending',
      async () => {
        // Get recent posts
        const recentPosts = await db
          .select({
            id: posts.id,
            content: posts.content,
            authorId: posts.authorId,
            timestamp: posts.timestamp,
          })
          .from(posts)
          .where(isNull(posts.deletedAt))
          .orderBy(desc(posts.timestamp))
          .limit(100)

        // Get like counts
        const postIds = recentPosts.map((p) => p.id)
        const likeCountMap = new Map<string, number>()

        if (postIds.length > 0) {
          const allLikes = await db
            .select({ postId: reactions.postId })
            .from(reactions)
            .where(
              and(
                eq(reactions.type, 'like'),
                inArray(reactions.postId, postIds),
              ),
            )

          for (const like of allLikes) {
            if (like.postId) {
              likeCountMap.set(
                like.postId,
                (likeCountMap.get(like.postId) ?? 0) + 1,
              )
            }
          }
        }

        // Sort by like count and take top 10
        const trendingPosts = recentPosts
          .map((p) => ({
            ...p,
            likeCount: likeCountMap.get(p.id) ?? 0,
            timestamp:
              p.timestamp instanceof Date
                ? p.timestamp.toISOString()
                : String(p.timestamp),
          }))
          .sort((a, b) => b.likeCount - a.likeCount)
          .slice(0, 10)

        return {
          success: true,
          trending: trendingPosts,
        }
      },
      {
        detail: {
          tags: ['Posts', 'Widgets'],
          summary: 'Get trending topics widget data',
        },
      },
    )

    // Feed widgets - trending posts
    .get(
      '/feed/widgets/trending-posts',
      async () => {
        // Get recent posts
        const recentPosts = await db
          .select({
            id: posts.id,
            content: posts.content,
            authorId: posts.authorId,
            timestamp: posts.timestamp,
          })
          .from(posts)
          .where(isNull(posts.deletedAt))
          .orderBy(desc(posts.timestamp))
          .limit(100)

        // Get like counts
        const postIds = recentPosts.map((p) => p.id)
        const likeCountMap = new Map<string, number>()

        if (postIds.length > 0) {
          const allLikes = await db
            .select({ postId: reactions.postId })
            .from(reactions)
            .where(
              and(
                eq(reactions.type, 'like'),
                inArray(reactions.postId, postIds),
              ),
            )

          for (const like of allLikes) {
            if (like.postId) {
              likeCountMap.set(
                like.postId,
                (likeCountMap.get(like.postId) ?? 0) + 1,
              )
            }
          }
        }

        // Sort by like count and take top 10
        const trendingPosts = recentPosts
          .map((p) => ({
            ...p,
            likeCount: likeCountMap.get(p.id) ?? 0,
            timestamp:
              p.timestamp instanceof Date
                ? p.timestamp.toISOString()
                : String(p.timestamp),
          }))
          .sort((a, b) => b.likeCount - a.likeCount)
          .slice(0, 10)

        return {
          success: true,
          trending: trendingPosts,
        }
      },
      {
        detail: {
          tags: ['Posts', 'Widgets'],
          summary: 'Get trending posts widget data',
        },
      },
    )

    // Feed widgets - upcoming events
    .get(
      '/feed/widgets/upcoming-events',
      async () => {
        // Get prediction markets with upcoming end dates as "events"
        const now = new Date()
        const marketsList = await db
          .select({
            id: markets.id,
            question: markets.question,
            endDate: markets.endDate,
            resolved: markets.resolved,
          })
          .from(markets)
          .where(eq(markets.resolved, false))
          .limit(10)

        const upcomingEvents = marketsList
          .filter((m) => m.endDate && m.endDate > now)
          .map((m) => ({
            id: m.id,
            title: m.question,
            date: m.endDate ? m.endDate.toISOString() : null,
            type: 'market_resolution' as const,
          }))

        return {
          success: true,
          events: upcomingEvents,
        }
      },
      {
        detail: {
          tags: ['Posts', 'Widgets'],
          summary: 'Get upcoming events widget data',
        },
      },
    )

    // Feed widgets - markets
    .get(
      '/feed/widgets/markets',
      async () => {
        // Get active prediction markets
        const marketsList = await db
          .select({
            id: markets.id,
            question: markets.question,
            yesShares: markets.yesShares,
            noShares: markets.noShares,
            resolved: markets.resolved,
          })
          .from(markets)
          .where(eq(markets.resolved, false))
          .orderBy(desc(markets.createdAt))
          .limit(5)

        const marketData = marketsList.map((m) => {
          const yesNum = Number(m.yesShares ?? 0)
          const noNum = Number(m.noShares ?? 0)
          const total = yesNum + noNum
          const yesProbability = total > 0 ? yesNum / total : 0.5
          return {
            id: m.id,
            question: m.question,
            yesProbability,
            noProbability: 1 - yesProbability,
            volume: total,
            status: 'active',
          }
        })

        return {
          success: true,
          markets: marketData,
        }
      },
      {
        detail: {
          tags: ['Posts', 'Widgets'],
          summary: 'Get markets widget data',
        },
      },
    )

    // Farcaster feed - fetch casts from decentralized Farcaster Hubs
    .get(
      '/feed/farcaster',
      async (ctx) => {
        const { user } = getAuthContext(ctx)
        const { query, set } = ctx
        const pageSize = Math.min(Number.parseInt(query.limit || '20', 10), 100)
        const pageToken = query.cursor

        // Must have either channel or authenticated user with Farcaster
        if (!query.channel && !user?.userId) {
          set.status = 400
          return {
            error:
              'Must provide channel parameter or be authenticated with Farcaster linked',
          }
        }

        let fids: number[] | undefined

        // If authenticated, get following FIDs
        if (user?.userId) {
          const [userData] = await db
            .select({ farcasterFid: users.farcasterFid })
            .from(users)
            .where(eq(users.id, user.userId))
            .limit(1)

          if (userData?.farcasterFid) {
            const userFid = Number(userData.farcasterFid)
            // Get FIDs of users they follow
            const followingFids = await getFollowingFids(userFid)
            fids = followingFids.length > 0 ? followingFids : [userFid]
          } else if (!query.channel) {
            set.status = 400
            return {
              error:
                'User has no Farcaster account linked and no channel provided',
            }
          }
        }

        // Fetch from Farcaster
        const result = await fetchFarcasterFeedPosts({
          fids,
          channelUrl: query.channel,
          pageSize,
          pageToken,
        })

        logger.info(
          'Fetched Farcaster feed',
          { postCount: result.posts.length, userId: user?.userId },
          'GET /api/feed/farcaster',
        )

        return {
          success: true,
          posts: result.posts,
          cursor: result.nextPageToken,
          hasMore: !!result.nextPageToken,
          source: 'farcaster',
        }
      },
      {
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          channel: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Posts', 'Farcaster'],
          summary: 'Get Farcaster feed',
          description:
            'Fetch posts directly from Farcaster Hubs. Returns casts from followed users or a specific channel.',
        },
      },
    )

    // Register Farcaster signer key
    .post(
      '/farcaster/signer',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Type assertion for body (Elysia type inference limitation)
        const body = ctx.body as { signerKey: string }
        const { signerKey } = body

        // Validate signer key format
        if (!signerKey || !signerKey.startsWith('0x')) {
          set.status = 400
          return { error: 'Invalid signer key format' }
        }

        // Store signer key (in production, encrypt and store in KMS)
        storeSignerKey(user.userId, signerKey as Hex)

        logger.info(
          'Farcaster signer key registered',
          { userId: user.userId },
          'POST /api/farcaster/signer',
        )

        return { success: true }
      },
      {
        body: t.Object({
          signerKey: t.String(),
        }),
        detail: {
          tags: ['Farcaster'],
          summary: 'Register Farcaster signer key',
          description:
            'Register a signer key for posting to Farcaster. In production, this would be stored in KMS.',
        },
      },
    )

    // Farcaster Hub health check
    .get(
      '/farcaster/health',
      async () => {
        const health = await checkHubHealth()
        return {
          success: true,
          health,
        }
      },
      {
        detail: {
          tags: ['Farcaster'],
          summary: 'Check Farcaster Hub health',
        },
      },
    )

export const postsRoutes = createPostsRoutes()
