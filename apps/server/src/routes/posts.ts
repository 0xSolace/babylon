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
  posts,
  reactions,
  shares,
  users,
} from '@babylon/db'
import { generateSnowflakeId, logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

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

        const feedPosts = await db
          .select({
            id: posts.id,
            content: posts.content,
            authorId: posts.authorId,
            type: posts.type,
            timestamp: posts.timestamp,
            imageUrl: posts.imageUrl,
            articleTitle: posts.articleTitle,
            commentOnPostId: posts.commentOnPostId,
            originalPostId: posts.originalPostId,
          })
          .from(posts)
          .where(and(...conditions))
          .orderBy(desc(posts.timestamp))
          .limit(limit + 1)

        const hasMore = feedPosts.length > limit
        const resultPosts = hasMore ? feedPosts.slice(0, -1) : feedPosts
        const nextCursor =
          hasMore && resultPosts.length > 0
            ? resultPosts[resultPosts.length - 1]?.timestamp.toISOString()
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
          nextCursor,
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

        const [post] = await db
          .select()
          .from(posts)
          .where(and(eq(posts.id, params.id), isNull(posts.deletedAt)))
          .limit(1)

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
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { content, mediaUrls, replyTo, quotedPostId } = body

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

        logger.info(
          'Post created',
          { postId, userId: user.userId, type: newPost.type },
          'POST /api/posts',
        )

        return {
          success: true,
          post: newPost,
        }
      },
      {
        body: t.Object({
          content: t.String(),
          mediaUrls: t.Optional(t.Array(t.String())),
          replyTo: t.Optional(t.String()),
          quotedPostId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Posts'],
          summary: 'Create post',
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

        const [post] = await db
          .select()
          .from(posts)
          .where(eq(posts.id, params.id))
          .limit(1)

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
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
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
          .select()
          .from(comments)
          .where(and(...conditions))
          .orderBy(desc(comments.createdAt))
          .limit(limit + 1)

        const hasMore = replies.length > limit
        const resultReplies = hasMore ? replies.slice(0, -1) : replies
        const nextCursor =
          hasMore && resultReplies.length > 0
            ? resultReplies[resultReplies.length - 1]?.createdAt.toISOString()
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
            timestamp: p.timestamp.toISOString(),
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

export const postsRoutes = createPostsRoutes()
