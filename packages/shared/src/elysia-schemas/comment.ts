/**
 * Comment Elysia Type Schemas
 *
 * Schemas for comment-related API endpoints
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId, URLString } from './common';

/**
 * Comment author
 */
export const CommentAuthorSchema = t.Object({
  id: SnowflakeId,
  username: t.Nullable(t.String()),
  displayName: t.Nullable(t.String()),
  profileImageUrl: t.Nullable(URLString),
  isActor: t.Optional(t.Boolean()),
});

/**
 * Comment schema
 */
export const CommentSchema = t.Object({
  id: SnowflakeId,
  postId: SnowflakeId,
  authorId: SnowflakeId,
  parentCommentId: t.Nullable(SnowflakeId),
  content: t.String(),
  createdAt: ISODateString,
  updatedAt: ISODateString,
  author: CommentAuthorSchema,
  likeCount: t.Number(),
  replyCount: t.Number(),
  isLiked: t.Optional(t.Boolean()),
});

/**
 * Create comment request
 */
export const CreateCommentRequestSchema = t.Object({
  content: t.String({ minLength: 1, maxLength: 2000 }),
  parentCommentId: t.Optional(SnowflakeId),
});

/**
 * Create comment response
 */
export const CreateCommentResponseSchema = t.Object({
  success: t.Boolean(),
  comment: CommentSchema,
});

/**
 * Update comment request
 */
export const UpdateCommentRequestSchema = t.Object({
  content: t.String({ minLength: 1, maxLength: 2000 }),
});

/**
 * Update comment response
 */
export const UpdateCommentResponseSchema = t.Object({
  id: SnowflakeId,
  content: t.String(),
  postId: SnowflakeId,
  authorId: SnowflakeId,
  parentCommentId: t.Nullable(SnowflakeId),
  createdAt: ISODateString,
  updatedAt: ISODateString,
  author: CommentAuthorSchema,
  likeCount: t.Number(),
  replyCount: t.Number(),
});

/**
 * Delete comment response
 */
export const DeleteCommentResponseSchema = t.Object({
  message: t.String(),
  deletedCommentId: SnowflakeId,
  deletedRepliesCount: t.Number(),
});

/**
 * Comments list query
 */
export const CommentsListQuerySchema = t.Object({
  limit: t.Optional(t.Number({ default: 50, minimum: 1, maximum: 100 })),
  offset: t.Optional(t.Number({ default: 0, minimum: 0 })),
  sort: t.Optional(t.Union([t.Literal('newest'), t.Literal('oldest'), t.Literal('top')])),
});

/**
 * Comments list response
 */
export const CommentsListResponseSchema = t.Object({
  success: t.Boolean(),
  comments: t.Array(CommentSchema),
  total: t.Number(),
  hasMore: t.Boolean(),
});

/**
 * Like comment response
 */
export const LikeCommentResponseSchema = t.Object({
  success: t.Boolean(),
  liked: t.Boolean(),
  likeCount: t.Number(),
});

