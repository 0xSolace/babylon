/**
 * Participation aggregates for `participation-service`.
 */

import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';

type PartDb = DrizzleClient | Transaction;

export async function fetchParticipationAggregates(
  db: PartDb,
  userId: string
): Promise<{
  postsCreated: number;
  commentsMade: number;
  sharesMade: number;
  reactionsGiven: number;
  marketsParticipated: number;
  lastPostAt: Date | undefined;
  lastCommentAt: Date | undefined;
  lastShareAt: Date | undefined;
  lastReactionAt: Date | undefined;
  lastPositionAt: Date | undefined;
}> {
  const [
    postsCountResult,
    commentsCountResult,
    sharesCountResult,
    reactionsCountResult,
    positionsCountResult,
    lastPostResult,
    lastCommentResult,
    lastShareResult,
    lastReactionResult,
    lastPositionResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(posts).where(eq(posts.authorId, userId)),
    db
      .select({ count: count() })
      .from(comments)
      .where(eq(comments.authorId, userId)),
    db.select({ count: count() }).from(shares).where(eq(shares.userId, userId)),
    db
      .select({ count: count() })
      .from(reactions)
      .where(eq(reactions.userId, userId)),
    db
      .select({ count: count() })
      .from(positions)
      .where(eq(positions.userId, userId)),
    db
      .select({ createdAt: posts.createdAt })
      .from(posts)
      .where(and(eq(posts.authorId, userId), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(1),
    db
      .select({ createdAt: comments.createdAt })
      .from(comments)
      .where(eq(comments.authorId, userId))
      .orderBy(desc(comments.createdAt))
      .limit(1),
    db
      .select({ createdAt: shares.createdAt })
      .from(shares)
      .where(eq(shares.userId, userId))
      .orderBy(desc(shares.createdAt))
      .limit(1),
    db
      .select({ createdAt: reactions.createdAt })
      .from(reactions)
      .where(eq(reactions.userId, userId))
      .orderBy(desc(reactions.createdAt))
      .limit(1),
    db
      .select({ createdAt: positions.createdAt })
      .from(positions)
      .where(eq(positions.userId, userId))
      .orderBy(desc(positions.createdAt))
      .limit(1),
  ]);

  return {
    postsCreated: postsCountResult[0]?.count ?? 0,
    commentsMade: commentsCountResult[0]?.count ?? 0,
    sharesMade: sharesCountResult[0]?.count ?? 0,
    reactionsGiven: reactionsCountResult[0]?.count ?? 0,
    marketsParticipated: positionsCountResult[0]?.count ?? 0,
    lastPostAt: lastPostResult[0]?.createdAt,
    lastCommentAt: lastCommentResult[0]?.createdAt,
    lastShareAt: lastShareResult[0]?.createdAt,
    lastReactionAt: lastReactionResult[0]?.createdAt,
    lastPositionAt: lastPositionResult[0]?.createdAt,
  };
}
