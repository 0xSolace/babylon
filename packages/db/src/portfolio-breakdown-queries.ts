/**
 * Read model for `calculatePortfolioBreakdown` in the engine.
 *
 * **Why here:** Keeps the multi-table portfolio SQL under `asSystem`; valuation
 * and fee math stay in `packages/engine`.
 */

import { resolveUserIdentifierKind } from '@babylon/shared';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { asSystem } from './db';
import { markets } from './tables/markets';
import { perpPositions } from './tables/perp-positions';
import { pointsTransactions } from './tables/points-transactions';
import { positions } from './tables/positions';
import { users } from './tables/user';

export type PortfolioBreakdownUserRow = {
  id: string;
  privyId: string | null;
  displayName: string | null;
  username: string | null;
  virtualBalance: unknown;
  totalDeposited: unknown;
  totalWithdrawn: unknown;
  reputationPoints: number;
};

export type PortfolioBreakdownAgentRow = {
  id: string;
  displayName: string | null;
  username: string | null;
  virtualBalance: unknown;
};

export type PortfolioBreakdownPerpRow = {
  size: number;
  leverage: number;
  unrealizedPnL: number;
};

export type PortfolioBreakdownPredictionRow = {
  shares: unknown;
  avgPrice: unknown;
  side: boolean;
  marketYesShares: unknown;
  marketNoShares: unknown;
};

const portfolioSelect = {
  id: users.id,
  privyId: users.privyId,
  displayName: users.displayName,
  username: users.username,
  virtualBalance: users.virtualBalance,
  totalDeposited: users.totalDeposited,
  totalWithdrawn: users.totalWithdrawn,
  reputationPoints: users.reputationPoints,
} as const;

export async function fetchPortfolioBreakdownReadModel(
  normalizedUserId: string
): Promise<{
  user: PortfolioBreakdownUserRow;
  agentRows: PortfolioBreakdownAgentRow[];
  perpRows: PortfolioBreakdownPerpRow[];
  predictionRows: PortfolioBreakdownPredictionRow[];
  netTransfersRaw: unknown;
} | null> {
  const kind = resolveUserIdentifierKind(normalizedUserId);

  const whereClause =
    kind === 'id'
      ? eq(users.id, normalizedUserId)
      : kind === 'privyId'
        ? eq(users.privyId, normalizedUserId)
        : sql`lower(${users.username}) = lower(${normalizedUserId})`;

  return asSystem(async (c) => {
    const userResult = await c
      .select(portfolioSelect)
      .from(users)
      .where(whereClause)
      .limit(1);

    let user = userResult[0] as PortfolioBreakdownUserRow | undefined;

    if (!user && kind === 'privyId') {
      const fallbackResult = await c
        .select(portfolioSelect)
        .from(users)
        .where(eq(users.id, normalizedUserId))
        .limit(1);
      user = fallbackResult[0] as PortfolioBreakdownUserRow | undefined;
    }

    if (!user) return null;

    const canonicalUserId = user.id;
    const positionUserIds = Array.from(
      new Set([canonicalUserId, user.privyId].filter(Boolean))
    ) as string[];

    const agentRows = await c
      .select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        virtualBalance: users.virtualBalance,
      })
      .from(users)
      .where(
        and(eq(users.managedBy, canonicalUserId), eq(users.isAgent, true))
      );

    const [perpRows, predictionRows] = await Promise.all([
      c
        .select({
          size: perpPositions.size,
          leverage: perpPositions.leverage,
          unrealizedPnL: perpPositions.unrealizedPnL,
        })
        .from(perpPositions)
        .where(
          and(
            inArray(perpPositions.userId, positionUserIds),
            isNull(perpPositions.closedAt)
          )
        ),
      c
        .select({
          shares: positions.shares,
          avgPrice: positions.avgPrice,
          side: positions.side,
          marketYesShares: markets.yesShares,
          marketNoShares: markets.noShares,
        })
        .from(positions)
        .innerJoin(markets, eq(positions.marketId, markets.id))
        .where(
          and(
            inArray(positions.userId, positionUserIds),
            eq(markets.resolved, false)
          )
        ),
    ]);

    const transferResult = await c
      .select({
        netTransfers: sql<number>`COALESCE(SUM(${pointsTransactions.amount}), 0)`,
      })
      .from(pointsTransactions)
      .where(
        and(
          inArray(pointsTransactions.userId, positionUserIds),
          inArray(pointsTransactions.reason, [
            'transfer_sent',
            'transfer_received',
          ])
        )
      )
      .limit(1);

    return {
      user,
      agentRows,
      perpRows,
      predictionRows,
      netTransfersRaw: transferResult[0]?.netTransfers,
    };
  }, 'portfolio-breakdown');
}
