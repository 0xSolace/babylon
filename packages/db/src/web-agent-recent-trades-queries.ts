/**
 * SQL for public GET /api/agents/[agentId]/recent-trades (user agents + NPC actors).
 */

import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { agentTrades } from './tables/agent-trades';
import { markets } from './tables/markets';
import { npcTrades } from './tables/npc-trades';
import { users } from './tables/user';

type RecentTradesDb = DrizzleClient | Transaction;

export type RecentTradeFeedRow = {
  id: string;
  marketType: string;
  marketId: string | null;
  ticker: string | null;
  action: string;
  side: string | null;
  amount: number;
  pnl: number | null;
  executedAt: Date;
};

export async function selectUserDisplayNameAndIsAgentById(
  db: RecentTradesDb,
  userId: string
): Promise<
  | { id: string; displayName: string | null; isAgent: boolean | null }
  | undefined
> {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      isAgent: users.isAgent,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectRecentAgentTradesForPublicProfileOrderExecutedDescLimit(
  db: RecentTradesDb,
  agentUserId: string,
  limit: number
): Promise<RecentTradeFeedRow[]> {
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
      executedAt: agentTrades.executedAt,
    })
    .from(agentTrades)
    .where(eq(agentTrades.agentUserId, agentUserId))
    .orderBy(desc(agentTrades.executedAt))
    .limit(limit);
}

export async function selectRecentNpcTradesForActorOrderExecutedDescLimit(
  db: RecentTradesDb,
  npcActorId: string,
  limit: number
): Promise<RecentTradeFeedRow[]> {
  return db
    .select({
      id: npcTrades.id,
      marketType: npcTrades.marketType,
      marketId: npcTrades.marketId,
      ticker: npcTrades.ticker,
      action: npcTrades.action,
      side: npcTrades.side,
      amount: npcTrades.amount,
      pnl: sql<number | null>`null`,
      executedAt: npcTrades.executedAt,
    })
    .from(npcTrades)
    .where(eq(npcTrades.npcActorId, npcActorId))
    .orderBy(desc(npcTrades.executedAt))
    .limit(limit);
}

export async function countAgentTradesForAgentUserId(
  db: RecentTradesDb,
  agentUserId: string
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(agentTrades)
    .where(eq(agentTrades.agentUserId, agentUserId));
  return Number(row?.n ?? 0);
}

export async function countNpcTradesForNpcActorId(
  db: RecentTradesDb,
  npcActorId: string
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(npcTrades)
    .where(eq(npcTrades.npcActorId, npcActorId));
  return Number(row?.n ?? 0);
}

export async function selectMarketQuestionsByIdsForRecentTrades(
  db: RecentTradesDb,
  marketIds: string[]
): Promise<{ id: string; question: string }[]> {
  if (marketIds.length === 0) return [];
  return db
    .select({ id: markets.id, question: markets.question })
    .from(markets)
    .where(inArray(markets.id, marketIds));
}
