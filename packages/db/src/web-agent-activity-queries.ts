/**
 * SQL for `apps/web` agent activity feeds (single-agent + all-owned-agents).
 */

import { desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { agentTrades } from './tables/agent-trades';
import { comments } from './tables/comments';
import { markets } from './tables/markets';
import { posts } from './tables/posts';
import { users } from './tables/user';

type AgentActDb = DrizzleClient | Transaction;

export type AgentTradeActivityRow = {
  id: string;
  marketType: string;
  marketId: string | null;
  ticker: string | null;
  action: string;
  side: string | null;
  amount: number;
  price: number;
  pnl: number | null;
  reasoning: string | null;
  executedAt: Date;
};

export type AgentTradeActivityWithAgentRow = AgentTradeActivityRow & {
  agentUserId: string;
};

export type AgentPostActivityRow = {
  id: string;
  content: string;
  createdAt: Date;
};

export type AgentPostActivityWithAuthorRow = AgentPostActivityRow & {
  authorId: string;
};

export type AgentCommentActivityRow = {
  id: string;
  postId: string;
  content: string;
  parentCommentId: string | null;
  createdAt: Date;
};

export type AgentCommentActivityWithAuthorRow = AgentCommentActivityRow & {
  authorId: string;
};

export async function selectManagedAgentsDisplayRows(
  db: AgentActDb,
  managerUserId: string
): Promise<
  { id: string; displayName: string | null; profileImageUrl: string | null }[]
> {
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(eq(users.managedBy, managerUserId));
}

export async function selectAgentTradesActivityForAgentOrderExecutedDescLimit(
  db: AgentActDb,
  agentUserId: string,
  limit: number
): Promise<AgentTradeActivityRow[]> {
  return db
    .select({
      id: agentTrades.id,
      marketType: agentTrades.marketType,
      marketId: agentTrades.marketId,
      ticker: agentTrades.ticker,
      action: agentTrades.action,
      side: agentTrades.side,
      amount: agentTrades.amount,
      price: agentTrades.price,
      pnl: agentTrades.pnl,
      reasoning: agentTrades.reasoning,
      executedAt: agentTrades.executedAt,
    })
    .from(agentTrades)
    .where(eq(agentTrades.agentUserId, agentUserId))
    .orderBy(desc(agentTrades.executedAt))
    .limit(limit);
}

export async function selectAgentTradesActivityForAgentsOrderExecutedDescLimit(
  db: AgentActDb,
  agentUserIds: string[],
  limit: number
): Promise<AgentTradeActivityWithAgentRow[]> {
  if (agentUserIds.length === 0) return [];
  return db
    .select({
      id: agentTrades.id,
      agentUserId: agentTrades.agentUserId,
      marketType: agentTrades.marketType,
      marketId: agentTrades.marketId,
      ticker: agentTrades.ticker,
      action: agentTrades.action,
      side: agentTrades.side,
      amount: agentTrades.amount,
      price: agentTrades.price,
      pnl: agentTrades.pnl,
      reasoning: agentTrades.reasoning,
      executedAt: agentTrades.executedAt,
    })
    .from(agentTrades)
    .where(inArray(agentTrades.agentUserId, agentUserIds))
    .orderBy(desc(agentTrades.executedAt))
    .limit(limit);
}

export async function selectMarketQuestionsByIds(
  db: AgentActDb,
  marketIds: string[]
): Promise<{ id: string; question: string }[]> {
  if (marketIds.length === 0) return [];
  return db
    .select({ id: markets.id, question: markets.question })
    .from(markets)
    .where(inArray(markets.id, marketIds));
}

export async function selectPostsForAuthorOrderCreatedDescLimit(
  db: AgentActDb,
  authorId: string,
  limit: number
): Promise<AgentPostActivityRow[]> {
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

export async function selectPostsForAuthorsOrderCreatedDescLimit(
  db: AgentActDb,
  authorIds: string[],
  limit: number
): Promise<AgentPostActivityWithAuthorRow[]> {
  if (authorIds.length === 0) return [];
  return db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      content: posts.content,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(inArray(posts.authorId, authorIds))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}

export async function selectCommentsForAuthorOrderCreatedDescLimit(
  db: AgentActDb,
  authorId: string,
  limit: number
): Promise<AgentCommentActivityRow[]> {
  return db
    .select({
      id: comments.id,
      postId: comments.postId,
      content: comments.content,
      parentCommentId: comments.parentCommentId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(eq(comments.authorId, authorId))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}

export async function selectCommentsForAuthorsOrderCreatedDescLimit(
  db: AgentActDb,
  authorIds: string[],
  limit: number
): Promise<AgentCommentActivityWithAuthorRow[]> {
  if (authorIds.length === 0) return [];
  return db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      postId: comments.postId,
      content: comments.content,
      parentCommentId: comments.parentCommentId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(inArray(comments.authorId, authorIds))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}
