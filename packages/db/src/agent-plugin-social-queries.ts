/**
 * SQL for agent plugin social / feed actions (recent posts, predictions, team chat, trades).
 */

import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { agentTrades } from './tables/agent-trades';
import { comments } from './tables/comments';
import type { Market } from './tables/markets';
import { markets } from './tables/markets';
import { messages } from './tables/messages';
import { npcTrades } from './tables/npc-trades';
import { posts } from './tables/posts';
import { users } from './tables/user';

type SocialDb = DrizzleClient | Transaction;

export type UserDisplayUsernameRow = {
  displayName: string | null;
  username: string | null;
};

export async function selectUserDisplayAndUsernameById(
  db: SocialDb,
  userId: string
): Promise<UserDisplayUsernameRow | undefined> {
  const [row] = await db
    .select({
      displayName: users.displayName,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type RecentPostSummaryRow = {
  id: string;
  content: string;
  createdAt: Date;
};

export async function selectRecentPostsByAuthorId(
  db: SocialDb,
  authorId: string,
  limit: number
): Promise<RecentPostSummaryRow[]> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.authorId, authorId))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}

export type RecentCommentByAuthorRow = {
  id: string;
  content: string;
  createdAt: Date;
  postId: string;
  parentCommentId: string | null;
};

export async function selectRecentCommentsByAuthorId(
  db: SocialDb,
  authorId: string,
  limit: number
): Promise<RecentCommentByAuthorRow[]> {
  return db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      postId: comments.postId,
      parentCommentId: comments.parentCommentId,
    })
    .from(comments)
    .where(eq(comments.authorId, authorId))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}

export type PostWithAuthorNamesRow = {
  id: string;
  content: string;
  authorId: string;
  authorName: string | null;
  authorUsername: string | null;
};

export async function selectPostsWithAuthorsByPostIds(
  db: SocialDb,
  postIds: string[]
): Promise<PostWithAuthorNamesRow[]> {
  if (postIds.length === 0) return [];
  return db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorUsername: users.username,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(inArray(posts.id, postIds));
}

export async function selectMarketByIdForPredictionCheck(
  db: SocialDb,
  marketId: string
): Promise<Market | undefined> {
  const [row] = await db
    .select()
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);
  return row;
}

export async function selectMarketsListForAgentPredictions(
  db: SocialDb,
  statusFilter: 'active' | 'resolved' | 'all',
  limit: number
): Promise<Market[]> {
  const now = new Date();
  if (statusFilter === 'active') {
    return db
      .select()
      .from(markets)
      .where(and(eq(markets.resolved, false), gte(markets.endDate, now)))
      .orderBy(desc(markets.createdAt))
      .limit(limit);
  }
  if (statusFilter === 'resolved') {
    return db
      .select()
      .from(markets)
      .where(eq(markets.resolved, true))
      .orderBy(desc(markets.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(markets)
    .orderBy(desc(markets.createdAt))
    .limit(limit);
}

export type TeamChatMessageWithSenderRow = {
  id: string;
  content: string;
  senderId: string;
  createdAt: Date;
  senderDisplayName: string | null;
  senderUsername: string | null;
  isAgent: boolean | null;
};

export async function selectTeamChatMessagesWithSenders(
  db: SocialDb,
  chatId: string,
  limit: number
): Promise<TeamChatMessageWithSenderRow[]> {
  return db
    .select({
      id: messages.id,
      content: messages.content,
      senderId: messages.senderId,
      createdAt: messages.createdAt,
      senderDisplayName: users.displayName,
      senderUsername: users.username,
      isAgent: users.isAgent,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export type NpcTradeFeedRow = {
  action: string;
  side: string | null;
  amount: number;
  price: number;
  marketType: string;
  ticker: string | null;
  executedAt: Date;
  npcActorId: string;
};

export async function selectRecentNpcTradesForFeed(
  db: SocialDb,
  limit: number
): Promise<NpcTradeFeedRow[]> {
  return db
    .select({
      action: npcTrades.action,
      side: npcTrades.side,
      amount: npcTrades.amount,
      price: npcTrades.price,
      marketType: npcTrades.marketType,
      ticker: npcTrades.ticker,
      executedAt: npcTrades.executedAt,
      npcActorId: npcTrades.npcActorId,
    })
    .from(npcTrades)
    .orderBy(desc(npcTrades.executedAt))
    .limit(limit);
}

export type AgentTradeWithTraderNamesRow = {
  action: string;
  side: string | null;
  amount: number;
  price: number;
  marketType: string;
  ticker: string | null;
  executedAt: Date;
  displayName: string | null;
  username: string | null;
};

export async function selectRecentAgentTradesWithTraderNames(
  db: SocialDb,
  limit: number
): Promise<AgentTradeWithTraderNamesRow[]> {
  return db
    .select({
      action: agentTrades.action,
      side: agentTrades.side,
      amount: agentTrades.amount,
      price: agentTrades.price,
      marketType: agentTrades.marketType,
      ticker: agentTrades.ticker,
      executedAt: agentTrades.executedAt,
      displayName: users.displayName,
      username: users.username,
    })
    .from(agentTrades)
    .leftJoin(users, eq(agentTrades.agentUserId, users.id))
    .orderBy(desc(agentTrades.executedAt))
    .limit(limit);
}
