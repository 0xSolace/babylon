/**
 * SQL for autonomous agent context / interaction gatherers (`packages/agents` autonomous utils).
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { AgentLog, Chat, Market, Message } from './model-types';
import { agentLogs } from './tables/agent-logs';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { comments } from './tables/comments';
import { groups } from './tables/groups';
import { markets } from './tables/markets';
import { messages } from './tables/messages';
import { perpPositions } from './tables/perp-positions';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { tags } from './tables/tags';
import { trendingTags } from './tables/trending-tags';
import { users } from './tables/user';
import { userAgentConfigs } from './tables/user-agent-configs';

type AutonomousCtxDb = DrizzleClient | Transaction;

export async function selectActivePredictionMarketsUnresolvedEndingAfterNowOrderCreatedDescLimit(
  db: AutonomousCtxDb,
  limit: number
): Promise<Market[]> {
  const now = new Date();
  return db
    .select()
    .from(markets)
    .where(and(eq(markets.resolved, false), gte(markets.endDate, now)))
    .orderBy(desc(markets.createdAt))
    .limit(limit);
}

export async function selectPredictionPositionActiveSliceByUserId(
  db: AutonomousCtxDb,
  userId: string,
  limit: number
): Promise<
  Array<{
    marketId: string;
    side: boolean;
    shares: string;
    avgPrice: string;
    createdAt: Date;
  }>
> {
  return db
    .select({
      marketId: positions.marketId,
      side: positions.side,
      shares: positions.shares,
      avgPrice: positions.avgPrice,
      createdAt: positions.createdAt,
    })
    .from(positions)
    .where(and(eq(positions.userId, userId), eq(positions.status, 'active')))
    .limit(limit);
}

export async function selectMarketIdQuestionYesNoSharesByIds(
  db: AutonomousCtxDb,
  marketIds: string[]
): Promise<
  Array<{
    id: string;
    question: string;
    yesShares: string | null;
    noShares: string | null;
  }>
> {
  if (marketIds.length === 0) return [];
  return db
    .select({
      id: markets.id,
      question: markets.question,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
    })
    .from(markets)
    .where(inArray(markets.id, marketIds));
}

export async function selectOpenPerpPositionContextSliceByUserId(
  db: AutonomousCtxDb,
  userId: string,
  limit: number
): Promise<
  Array<{
    ticker: string;
    side: string;
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    openedAt: Date;
  }>
> {
  return db
    .select({
      ticker: perpPositions.ticker,
      side: perpPositions.side,
      size: perpPositions.size,
      entryPrice: perpPositions.entryPrice,
      currentPrice: perpPositions.currentPrice,
      unrealizedPnL: perpPositions.unrealizedPnL,
      unrealizedPnLPercent: perpPositions.unrealizedPnLPercent,
      openedAt: perpPositions.openedAt,
    })
    .from(perpPositions)
    .where(
      and(eq(perpPositions.userId, userId), isNull(perpPositions.closedAt))
    )
    .limit(limit);
}

export async function selectGroupChatIdForAgentAndGroupNameIlike(
  db: AutonomousCtxDb,
  agentUserId: string,
  namePattern: string
): Promise<string | null> {
  const [row] = await db
    .select({ chatId: chats.id })
    .from(chatParticipants)
    .innerJoin(chats, eq(chatParticipants.chatId, chats.id))
    .innerJoin(groups, eq(chats.groupId, groups.id))
    .where(
      and(
        eq(chatParticipants.userId, agentUserId),
        eq(chats.isGroup, true),
        ilike(groups.name, namePattern)
      )
    )
    .limit(1);
  return row?.chatId ?? null;
}

export async function selectPostIdsByAuthorSinceCreated(
  db: AutonomousCtxDb,
  authorId: string,
  since: Date
): Promise<Array<{ id: string }>> {
  return db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.authorId, authorId),
        isNull(posts.deletedAt),
        gte(posts.createdAt, since)
      )
    );
}

export async function selectDistinctPostIdsFromCommentsByAuthorSince(
  db: AutonomousCtxDb,
  authorId: string,
  since: Date
): Promise<Array<{ postId: string }>> {
  return db
    .selectDistinct({ postId: comments.postId })
    .from(comments)
    .where(
      and(eq(comments.authorId, authorId), gte(comments.createdAt, since))
    );
}

export type InteractionCommentWithRelations = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  authorId: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
  };
  post: {
    id: string;
    content: string;
    authorId: string;
    deletedAt: Date | null;
    User: {
      id: string;
      username: string | null;
      displayName: string | null;
    } | null;
  };
};

export async function selectCommentsWithPostAndAuthorsForInteractionGathering(
  db: AutonomousCtxDb,
  postIds: string[],
  limit: number
): Promise<InteractionCommentWithRelations[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      parentCommentId: comments.parentCommentId,
      authorId: comments.authorId,
      content: comments.content,
      createdAt: comments.createdAt,
      authorUserId: users.id,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      postIdInner: posts.id,
      postContent: posts.content,
      postAuthorId: posts.authorId,
      postDeletedAt: posts.deletedAt,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(and(inArray(comments.postId, postIds), isNull(comments.deletedAt)))
    .orderBy(desc(comments.createdAt))
    .limit(limit);

  const postAuthorIds = [...new Set(rows.map((r) => r.postAuthorId))];
  const postAuthorRows =
    postAuthorIds.length === 0
      ? []
      : await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
          })
          .from(users)
          .where(inArray(users.id, postAuthorIds));
  const postAuthorMap = new Map(postAuthorRows.map((u) => [u.id, u] as const));

  return rows.map((r) => {
    const pu = postAuthorMap.get(r.postAuthorId);
    return {
      id: r.id,
      postId: r.postId,
      parentCommentId: r.parentCommentId,
      authorId: r.authorId,
      content: r.content,
      createdAt: r.createdAt,
      author: {
        id: r.authorUserId,
        username: r.authorUsername,
        displayName: r.authorDisplayName,
      },
      post: {
        id: r.postIdInner,
        content: r.postContent,
        authorId: r.postAuthorId,
        deletedAt: r.postDeletedAt,
        User: pu
          ? {
              id: pu.id,
              username: pu.username,
              displayName: pu.displayName,
            }
          : null,
      },
    };
  });
}

export async function selectChatParticipantsWithChatsByUserId(
  db: AutonomousCtxDb,
  userId: string
): Promise<Array<{ chatId: string; chat: Chat | null }>> {
  return db
    .select({
      chatId: chatParticipants.chatId,
      chat: chats,
    })
    .from(chatParticipants)
    .leftJoin(chats, eq(chatParticipants.chatId, chats.id))
    .where(eq(chatParticipants.userId, userId));
}

export async function selectChatParticipantsWithChatsByUserIdLimit(
  db: AutonomousCtxDb,
  userId: string,
  limit: number
): Promise<Array<{ chatId: string; chat: Chat | null }>> {
  return db
    .select({
      chatId: chatParticipants.chatId,
      chat: chats,
    })
    .from(chatParticipants)
    .leftJoin(chats, eq(chatParticipants.chatId, chats.id))
    .where(eq(chatParticipants.userId, userId))
    .orderBy(desc(chatParticipants.joinedAt))
    .limit(limit);
}

export async function selectMessagesByChatIdsSinceOrderCreatedDescLimit(
  db: AutonomousCtxDb,
  chatIds: string[],
  since: Date,
  limit: number
): Promise<Message[]> {
  if (chatIds.length === 0) return [];
  return db
    .select()
    .from(messages)
    .where(
      and(inArray(messages.chatId, chatIds), gte(messages.createdAt, since))
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function selectMessagesByChatIdSinceOrderCreatedDescLimit(
  db: AutonomousCtxDb,
  chatId: string,
  since: Date,
  limit: number
): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.chatId, chatId), gte(messages.createdAt, since)))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function selectUsersDisplayUsernameByIds(
  db: AutonomousCtxDb,
  userIds: string[]
): Promise<
  Array<{ id: string; displayName: string | null; username: string | null }>
> {
  if (userIds.length === 0) return [];
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}

export async function selectOwnPostsIdContentTimestampByAuthorNotDeletedOrderTimestampDescLimit(
  db: AutonomousCtxDb,
  authorId: string,
  limit: number
): Promise<Array<{ id: string; content: string; timestamp: Date }>> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      timestamp: posts.timestamp,
    })
    .from(posts)
    .where(and(eq(posts.authorId, authorId), isNull(posts.deletedAt)))
    .orderBy(desc(posts.timestamp))
    .limit(limit);
}

export async function countReactionsLikesByPostIdsGrouped(
  db: AutonomousCtxDb,
  postIds: string[]
): Promise<Array<{ postId: string | null; count: number }>> {
  if (postIds.length === 0) return [];
  return db
    .select({
      postId: reactions.postId,
      count: sql<number>`count(*)`,
    })
    .from(reactions)
    .where(and(inArray(reactions.postId, postIds), eq(reactions.type, 'like')))
    .groupBy(reactions.postId);
}

export async function countCommentsByPostIdsGroupedNotDeleted(
  db: AutonomousCtxDb,
  postIds: string[]
): Promise<Array<{ postId: string | null; count: number }>> {
  if (postIds.length === 0) return [];
  return db
    .select({
      postId: comments.postId,
      count: sql<number>`count(*)`,
    })
    .from(comments)
    .where(and(inArray(comments.postId, postIds), isNull(comments.deletedAt)))
    .groupBy(comments.postId);
}

export async function selectRecentPostsForEngagementByOthersInTimestampWindowOrderCreatedDescLimit(
  db: AutonomousCtxDb,
  params: {
    excludeAuthorId: string;
    since: Date;
    until: Date;
    limit: number;
  }
): Promise<
  Array<{
    id: string;
    content: string;
    authorId: string;
    createdAt: Date;
  }>
> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(
      and(
        ne(posts.authorId, params.excludeAuthorId),
        isNull(posts.deletedAt),
        gte(posts.timestamp, params.since),
        lte(posts.timestamp, params.until)
      )
    )
    .orderBy(desc(posts.createdAt))
    .limit(params.limit);
}

export async function selectAgentTopLevelCommentsOnPosts(
  db: AutonomousCtxDb,
  agentUserId: string,
  postIds: string[]
): Promise<Array<{ postId: string | null; content: string }>> {
  if (postIds.length === 0) return [];
  return db
    .select({
      postId: comments.postId,
      content: comments.content,
    })
    .from(comments)
    .where(
      and(
        inArray(comments.postId, postIds),
        eq(comments.authorId, agentUserId),
        isNull(comments.parentCommentId),
        isNull(comments.deletedAt)
      )
    );
}

export async function selectReactionPostIdsForUserAndPostsTypeLike(
  db: AutonomousCtxDb,
  userId: string,
  postIds: string[]
): Promise<Array<{ postId: string | null }>> {
  if (postIds.length === 0) return [];
  return db
    .select({ postId: reactions.postId })
    .from(reactions)
    .where(
      and(
        inArray(reactions.postId, postIds),
        eq(reactions.userId, userId),
        eq(reactions.type, 'like')
      )
    );
}

export async function selectSharePostIdsForUserAndPosts(
  db: AutonomousCtxDb,
  userId: string,
  postIds: string[]
): Promise<Array<{ postId: string }>> {
  if (postIds.length === 0) return [];
  return db
    .select({ postId: shares.postId })
    .from(shares)
    .where(and(inArray(shares.postId, postIds), eq(shares.userId, userId)));
}

export async function countSharesByPostIdsGrouped(
  db: AutonomousCtxDb,
  postIds: string[]
): Promise<Array<{ postId: string; count: number }>> {
  if (postIds.length === 0) return [];
  return db
    .select({
      postId: shares.postId,
      count: sql<number>`count(*)`,
    })
    .from(shares)
    .where(inArray(shares.postId, postIds))
    .groupBy(shares.postId);
}

export async function selectAgentUsersIdDisplayNameAnyAutonomousEnabled(
  db: AutonomousCtxDb
): Promise<Array<{ id: string; displayName: string | null }>> {
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
    })
    .from(users)
    .innerJoin(userAgentConfigs, eq(users.id, userAgentConfigs.userId))
    .where(
      and(
        eq(users.isAgent, true),
        or(
          eq(userAgentConfigs.autonomousTrading, true),
          eq(userAgentConfigs.autonomousPosting, true),
          eq(userAgentConfigs.autonomousCommenting, true),
          eq(userAgentConfigs.autonomousDMs, true),
          eq(userAgentConfigs.autonomousGroupChats, true)
        )
      )
    );
}

export async function selectUserVirtualBalanceAndLifetimePnLById(
  db: AutonomousCtxDb,
  userId: string
): Promise<
  | {
      displayName: string | null;
      virtualBalance: string | null;
      lifetimePnL: string | null;
    }
  | undefined
> {
  const [row] = await db
    .select({
      displayName: users.displayName,
      virtualBalance: users.virtualBalance,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function countOpenPerpPositionsByUserId(
  db: AutonomousCtxDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(perpPositions)
    .where(
      and(eq(perpPositions.userId, userId), isNull(perpPositions.closedAt))
    );
  return Number(row?.c ?? 0);
}

export async function countUnresolvedMarkets(
  db: AutonomousCtxDb
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(markets)
    .where(eq(markets.resolved, false));
  return Number(row?.c ?? 0);
}

export async function selectMessagesByChatIdExcludingSenderSinceOrderCreatedDescLimit(
  db: AutonomousCtxDb,
  params: {
    chatId: string;
    excludeSenderId: string;
    since: Date;
    limit: number;
  }
): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.chatId, params.chatId),
        ne(messages.senderId, params.excludeSenderId),
        gte(messages.createdAt, params.since)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(params.limit);
}

export async function selectMessagesByChatIdOrderCreatedAscLimit(
  db: AutonomousCtxDb,
  chatId: string,
  limit: number
): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function selectChatParticipantExistsForChatAndUser(
  db: AutonomousCtxDb,
  chatId: string,
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: chatParticipants.id })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId)
      )
    )
    .limit(1);
  return row !== undefined;
}

export async function countActivePredictionPositionsByUserId(
  db: AutonomousCtxDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(positions)
    .where(and(eq(positions.userId, userId), eq(positions.status, 'active')));
  return Number(row?.c ?? 0);
}

export async function selectAgentLogsByTypesOrderCreatedDescLimit(
  db: AutonomousCtxDb,
  agentUserId: string,
  types: string[],
  limit: number
): Promise<AgentLog[]> {
  if (types.length === 0) return [];
  return db
    .select()
    .from(agentLogs)
    .where(
      and(
        eq(agentLogs.agentUserId, agentUserId),
        inArray(agentLogs.type, types)
      )
    )
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit);
}

export async function selectTrendingTagsWithNamesOrderScoreDescLimit(
  db: AutonomousCtxDb,
  limit: number
): Promise<Array<{ score: number; tagName: string; tagDisplayName: string }>> {
  return db
    .select({
      score: trendingTags.score,
      tagName: tags.name,
      tagDisplayName: tags.displayName,
    })
    .from(trendingTags)
    .innerJoin(tags, eq(trendingTags.tagId, tags.id))
    .orderBy(desc(trendingTags.score))
    .limit(limit);
}

export async function selectCommentPostIdsByAuthorId(
  db: AutonomousCtxDb,
  authorId: string
): Promise<Array<{ postId: string }>> {
  return db
    .select({ postId: comments.postId })
    .from(comments)
    .where(eq(comments.authorId, authorId));
}

export async function selectNonDeletedCommentsSliceOrderCreatedDescLimit(
  db: AutonomousCtxDb,
  limit: number
): Promise<
  Array<{
    id: string;
    content: string;
    postId: string;
    authorId: string;
    parentCommentId: string | null;
    createdAt: Date;
  }>
> {
  return db
    .select({
      id: comments.id,
      content: comments.content,
      postId: comments.postId,
      authorId: comments.authorId,
      parentCommentId: comments.parentCommentId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(isNull(comments.deletedAt))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}

export async function countReactionsLikesByCommentIdsGrouped(
  db: AutonomousCtxDb,
  commentIds: string[]
): Promise<Array<{ commentId: string | null; count: number }>> {
  if (commentIds.length === 0) return [];
  return db
    .select({
      commentId: reactions.commentId,
      count: sql<number>`count(*)`,
    })
    .from(reactions)
    .where(
      and(inArray(reactions.commentId, commentIds), eq(reactions.type, 'like'))
    )
    .groupBy(reactions.commentId);
}
