/**
 * Portfolio P&L snapshot reads (user balance, open perps, open prediction positions).
 *
 * **Why here:** Single complex `select`/`join`/`where` path used for NPC/account
 * metrics; belongs with other audited SQL under `asSystem`.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { asSystem } from './db';
import { markets } from './tables/markets';
import { perpPositions } from './tables/perp-positions';
import { positions } from './tables/positions';
import { users } from './tables/user';

export type PortfolioPnLSnapshot = {
  lifetimePnL: number;
  netContributions: number;
  totalDeposited: number;
  totalWithdrawn: number;
  availableBalance: number;
  unrealizedPerpPnL: number;
  unrealizedPredictionPnL: number;
  totalUnrealizedPnL: number;
  totalPnL: number;
  accountEquity: number;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export async function fetchPortfolioPnLSnapshot(
  userId: string
): Promise<PortfolioPnLSnapshot | null> {
  return asSystem(async (c) => {
    const userResult = await c
      .select({
        virtualBalance: users.virtualBalance,
        totalDeposited: users.totalDeposited,
        totalWithdrawn: users.totalWithdrawn,
        lifetimePnL: users.lifetimePnL,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userResult[0];
    if (!user) return null;

    const perpPositionResults = await c
      .select({
        unrealizedPnL: perpPositions.unrealizedPnL,
      })
      .from(perpPositions)
      .where(
        and(eq(perpPositions.userId, userId), isNull(perpPositions.closedAt))
      );

    const predictionPositionResults = await c
      .select({
        shares: positions.shares,
        avgPrice: positions.avgPrice,
        side: positions.side,
        marketYesShares: markets.yesShares,
        marketNoShares: markets.noShares,
      })
      .from(positions)
      .innerJoin(markets, eq(positions.marketId, markets.id))
      .where(and(eq(positions.userId, userId), eq(markets.resolved, false)));

    const totalDeposited = toNumber(user.totalDeposited);
    const totalWithdrawn = toNumber(user.totalWithdrawn);
    const lifetimePnL = toNumber(user.lifetimePnL);
    const availableBalance = toNumber(user.virtualBalance);

    const perpUnrealized = perpPositionResults.reduce(
      (sum, position) => sum + toNumber(position.unrealizedPnL),
      0
    );

    const predictionUnrealized = predictionPositionResults.reduce(
      (sum, position) => {
        const shares = toNumber(position.shares);
        const avgPrice = toNumber(position.avgPrice);

        const yesShares = toNumber(position.marketYesShares);
        const noShares = toNumber(position.marketNoShares);
        const totalShares = yesShares + noShares;

        const currentPrice =
          totalShares > 0
            ? position.side === true
              ? noShares / totalShares
              : yesShares / totalShares
            : avgPrice;

        return sum + shares * (currentPrice - avgPrice);
      },
      0
    );

    const totalUnrealizedPnL = perpUnrealized + predictionUnrealized;
    const totalPnL = lifetimePnL + totalUnrealizedPnL;
    const netContributions = totalDeposited - totalWithdrawn;
    const accountEquity = netContributions + totalPnL;

    return {
      lifetimePnL,
      netContributions,
      totalDeposited,
      totalWithdrawn,
      availableBalance,
      unrealizedPerpPnL: perpUnrealized,
      unrealizedPredictionPnL: predictionUnrealized,
      totalUnrealizedPnL,
      totalPnL,
      accountEquity,
    };
  }, 'portfolio-pnl-calculate');
}
