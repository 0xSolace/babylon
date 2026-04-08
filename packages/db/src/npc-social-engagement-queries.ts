/**
 * Reads/writes for `processNPCSocialEngagements` (system scope).
 *
 * **Why here:** Drizzle + `asSystem` / `withTransaction`; LLM prompts and probability
 * math stay in `packages/engine`.
 */

import { and, desc, gte, inArray, isNull } from 'drizzle-orm';
import type { JsonValue } from './client';
import { asSystem, withTransaction } from './db';
import { comments } from './tables/comments';
import { npcInteractions } from './tables/npc-interactions';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';

export type NpcEngagementRecentPostRow = {
  id: string;
  authorId: string;
  content: string;
  type: string;
  originalPostId: string | null;
  relatedQuestion: number | null;
};

export async function listRecentPostsForNpcEngagement(params: {
  since: Date;
  take: number;
}): Promise<NpcEngagementRecentPostRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          id: posts.id,
          authorId: posts.authorId,
          content: posts.content,
          type: posts.type,
          originalPostId: posts.originalPostId,
          relatedQuestion: posts.relatedQuestion,
        })
        .from(posts)
        .where(and(isNull(posts.deletedAt), gte(posts.timestamp, params.since)))
        .orderBy(desc(posts.timestamp))
        .limit(params.take),
    'npc-social-recent-posts'
  );
}

export async function listPostAuthorsByIdsForNpcEngagement(
  ids: string[]
): Promise<Array<{ id: string; authorId: string }>> {
  if (ids.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({ id: posts.id, authorId: posts.authorId })
        .from(posts)
        .where(inArray(posts.id, ids)),
    'npc-social-quoted-authors'
  );
}

export async function listReactionsForNpcEngagementPostIds(
  postIds: string[]
): Promise<Array<{ postId: string | null; userId: string }>> {
  if (postIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({ postId: reactions.postId, userId: reactions.userId })
        .from(reactions)
        .where(inArray(reactions.postId, postIds)),
    'npc-social-existing-reactions'
  );
}

export async function listSharesForNpcEngagementPostIds(
  postIds: string[]
): Promise<Array<{ postId: string; userId: string }>> {
  if (postIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({ postId: shares.postId, userId: shares.userId })
        .from(shares)
        .where(inArray(shares.postId, postIds)),
    'npc-social-existing-shares'
  );
}

export async function listQuotePostCommentPairsForNpcEngagement(
  postIds: string[],
  take: number
): Promise<Array<{ postId: string; authorId: string }>> {
  if (postIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          postId: comments.postId,
          authorId: comments.authorId,
        })
        .from(comments)
        .where(
          and(inArray(comments.postId, postIds), isNull(comments.deletedAt))
        )
        .orderBy(desc(comments.createdAt))
        .limit(take),
    'npc-social-quote-comments'
  );
}

export type NpcEngagementThreadCommentRow = {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentCommentId: string | null;
  createdAt: Date;
};

export async function listRecentCommentsForNpcEngagementThreads(params: {
  postIds: string[];
  since: Date;
  take: number;
}): Promise<NpcEngagementThreadCommentRow[]> {
  if (params.postIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          id: comments.id,
          postId: comments.postId,
          authorId: comments.authorId,
          content: comments.content,
          parentCommentId: comments.parentCommentId,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .where(
          and(
            inArray(comments.postId, params.postIds),
            isNull(comments.deletedAt),
            gte(comments.createdAt, params.since)
          )
        )
        .orderBy(desc(comments.createdAt))
        .limit(params.take),
    'npc-social-thread-comments'
  );
}

export async function insertNpcEngagementReaction(row: {
  id: string;
  postId: string;
  userId: string;
  type: string;
}): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(reactions).values({
      id: row.id,
      postId: row.postId,
      userId: row.userId,
      type: row.type,
    });
  }, 'npc-social-insert-reaction');
}

export async function insertNpcEngagementComment(row: {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  updatedAt: Date;
  parentCommentId?: string | null;
}): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(comments).values({
      id: row.id,
      postId: row.postId,
      authorId: row.authorId,
      content: row.content,
      updatedAt: row.updatedAt,
      parentCommentId: row.parentCommentId ?? null,
    });
  }, 'npc-social-insert-comment');
}

export async function insertNpcEngagementNpcInteraction(row: {
  id: string;
  actor1Id: string;
  actor2Id: string;
  interactionType: string;
  sentiment: number;
  context: string;
  metadata: JsonValue;
  timestamp: Date;
}): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(npcInteractions).values({
      id: row.id,
      actor1Id: row.actor1Id,
      actor2Id: row.actor2Id,
      interactionType: row.interactionType,
      sentiment: row.sentiment,
      context: row.context,
      metadata: row.metadata,
      timestamp: row.timestamp,
    });
  }, 'npc-social-insert-npc-interaction');
}

export async function createNpcShareAndRepostInTransaction(params: {
  shareId: string;
  sharePostId: string;
  userId: string;
  repostId: string;
  repostTimestamp: Date;
}): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.insert(shares).values({
      id: params.shareId,
      postId: params.sharePostId,
      userId: params.userId,
    });
    await tx.insert(posts).values({
      id: params.repostId,
      content: '',
      authorId: params.userId,
      timestamp: params.repostTimestamp,
      originalPostId: params.sharePostId,
      type: 'repost',
    });
  });
}
