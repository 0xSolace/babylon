/**
 * Post Elysia Type Schemas
 *
 * Schemas for post-related API endpoints
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId, URLString } from './common';

/**
 * Original post in a repost
 */
export const OriginalPostSchema = t.Object({
  id: SnowflakeId,
  content: t.String(),
  authorId: t.String(),
  authorName: t.String(),
  authorUsername: t.Nullable(t.String()),
  authorProfileImageUrl: t.Nullable(URLString),
  timestamp: ISODateString,
});

/**
 * Post in feed
 */
export const FeedPostSchema = t.Object({
  id: SnowflakeId,
  type: t.Optional(t.String()),
  content: t.String(),
  fullContent: t.Optional(t.String()),
  articleTitle: t.Optional(t.String()),
  byline: t.Optional(t.String()),
  biasScore: t.Optional(t.Number()),
  sentiment: t.Optional(t.String()),
  slant: t.Optional(t.String()),
  category: t.Optional(t.String()),
  author: t.Optional(t.String()),
  authorId: t.String(),
  authorName: t.String(),
  authorUsername: t.Nullable(t.String()),
  authorProfileImageUrl: t.Nullable(URLString),
  timestamp: ISODateString,
  createdAt: ISODateString,
  gameId: t.Optional(t.String()),
  dayNumber: t.Optional(t.Number()),
  likeCount: t.Number(),
  commentCount: t.Number(),
  shareCount: t.Number(),
  isLiked: t.Boolean(),
  isShared: t.Boolean(),
  isRepost: t.Optional(t.Boolean()),
  isQuote: t.Optional(t.Boolean()),
  quoteComment: t.Optional(t.Nullable(t.String())),
  originalPostId: t.Optional(t.String()),
  originalPost: t.Optional(t.Nullable(OriginalPostSchema)),
});

/**
 * Posts feed response
 */
export const PostsFeedResponseSchema = t.Object({
  success: t.Boolean(),
  posts: t.Array(FeedPostSchema),
  limit: t.Number(),
  cursor: t.Optional(t.Nullable(t.String())),
  hasMore: t.Boolean(),
  source: t.Optional(t.String()),
});

/**
 * Posts query parameters
 */
export const PostsQuerySchema = t.Object({
  limit: t.Optional(t.Number({ default: 100, maximum: 100 })),
  cursor: t.Optional(t.String()),
  actorId: t.Optional(t.String()),
  following: t.Optional(t.Boolean()),
  userId: t.Optional(t.String()),
  type: t.Optional(t.Union([t.Literal('article'), t.Literal('post')])),
});

/**
 * Create post request
 */
export const CreatePostRequestSchema = t.Object({
  content: t.String({ minLength: 1, maxLength: 280 }),
  imageUrl: t.Optional(URLString),
  repostOfId: t.Optional(SnowflakeId),
});

/**
 * Created post response
 */
export const CreatePostResponseSchema = t.Object({
  success: t.Boolean(),
  post: t.Object({
    id: SnowflakeId,
    content: t.String(),
    authorId: t.String(),
    authorName: t.String(),
    authorUsername: t.Nullable(t.String()),
    authorDisplayName: t.Nullable(t.String()),
    authorProfileImageUrl: t.Nullable(URLString),
    timestamp: ISODateString,
    createdAt: ISODateString,
  }),
});

/**
 * Single post response
 */
export const PostResponseSchema = t.Object({
  success: t.Boolean(),
  post: FeedPostSchema,
});

/**
 * Like/reaction request
 */
export const LikeRequestSchema = t.Object({
  type: t.Optional(t.Literal('like')),
});

/**
 * Share/repost request
 */
export const ShareRequestSchema = t.Object({
  comment: t.Optional(t.String({ maxLength: 500 })),
});

