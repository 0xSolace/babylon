/**
 * SQL for agent plugin CHECK_PNL / CHECK_OWNER_PNL actions.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { type AgentTrade, agentTrades } from './tables/agent-trades';

export type { AgentTrade } from './tables/agent-trades';

import { markets } from './tables/markets';
import { type PerpPosition, perpPositions } from './tables/perp-positions';
import { positions } from './tables/positions';
import { users } from './tables/user';

type PnlDb = DrizzleClient | Transaction;

export type AgentPnlUserSliceRow = {
  displayName: string | null;
  lifetimePnL: string | null;
};

export async function selectUserDisplayNameLifetimePnl(
  db: PnlDb,
  userId: string
): Promise<AgentPnlUserSliceRow | undefined> {
  const [row] = await db
    .select({
      displayName: users.displayName,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type OwnerPnlHeaderRow = {
  displayName: string | null;
  username: string | null;
  lifetimePnL: string | null;
};

export async function selectOwnerHeaderForPnl(
  db: PnlDb,
  ownerId: string
): Promise<OwnerPnlHeaderRow | undefined> {
  const [row] = await db
    .select({
      displayName: users.displayName,
      username: users.username,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  return row;
}

export type ActivePredictionPositionWithMarketRow = {
  id: string;
  marketId: string;
  side: boolean;
  shares: string;
  avgPrice: string;
  amount: string;
  question: string | null;
  yesShares: string | null;
  noShares: string | null;
};

export async function selectActivePredictionPositionsWithMarketForUser(
  db: PnlDb,
  userId: string
): Promise<ActivePredictionPositionWithMarketRow[]> {
  return db
    .select({
      id: positions.id,
      marketId: positions.marketId,
      side: positions.side,
      shares: positions.shares,
      avgPrice: positions.avgPrice,
      amount: positions.amount,
      question: markets.question,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
    })
    .from(positions)
    .leftJoin(markets, eq(positions.marketId, markets.id))
    .where(and(eq(positions.userId, userId), eq(positions.status, 'active')));
}

export async function selectOpenPerpPositionsForUser(
  db: PnlDb,
  userId: string
): Promise<PerpPosition[]> {
  return db
    .select()
    .from(perpPositions)
    .where(
      and(eq(perpPositions.userId, userId), isNull(perpPositions.closedAt))
    );
}

export async function selectMarketQuestionById(
  db: PnlDb,
  marketId: string
): Promise<string | undefined> {
  const [row] = await db
    .select({ question: markets.question })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);
  return row?.question ?? undefined;
}

export async function selectAgentTradesByAgentUserId(
  db: PnlDb,
  agentUserId: string,
  limit: number
): Promise<AgentTrade[]> {
  return db
    .select()
    .from(agentTrades)
    .where(eq(agentTrades.agentUserId, agentUserId))
    .orderBy(desc(agentTrades.executedAt))
    .limit(limit);
}

export async function selectLifetimePnLRowsForUsersManagedBy(
  db: PnlDb,
  managerUserId: string
): Promise<{ lifetimePnL: string | null }[]> {
  return db
    .select({ lifetimePnL: users.lifetimePnL })
    .from(users)
    .where(eq(users.managedBy, managerUserId));
}

export type RecentAgentTradeWithMarketRow = {
  action: string;
  marketType: string;
  ticker: string | null;
  marketId: string | null;
  amount: number;
  pnl: number | null;
  executedAt: Date;
  marketQuestion: string | null;
};

export async function selectRecentAgentTradesWithMarketQuestion(
  db: PnlDb,
  agentUserId: string,
  limit: number
): Promise<RecentAgentTradeWithMarketRow[]> {
  return db
    .select({
      action: agentTrades.action,
      marketType: agentTrades.marketType,
      ticker: agentTrades.ticker,
      marketId: agentTrades.marketId,
      amount: agentTrades.amount,
      pnl: agentTrades.pnl,
      executedAt: agentTrades.executedAt,
      marketQuestion: markets.question,
    })
    .from(agentTrades)
    .leftJoin(markets, eq(agentTrades.marketId, markets.id))
    .where(eq(agentTrades.agentUserId, agentUserId))
    .orderBy(desc(agentTrades.executedAt))
    .limit(limit);
}
