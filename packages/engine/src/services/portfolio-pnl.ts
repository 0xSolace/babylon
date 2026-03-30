/**
 * Server-side portfolio P&L calculation
 */

import { db, markets, perpPositions, positions, users } from '@babylon/db';
import {
  isOnchainPerpSettlementMode,
  resolveUserIdentifierKind,
} from '@babylon/shared';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  getOnchainPerpAvailableBalanceForUser,
  syncOnchainPerpPositionsForUser,
} from './onchain-perp-read-model';
import { OnchainPerpService } from './onchain-perp-service';

export interface PortfolioPnLSnapshot {
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
}

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

export async function calculatePortfolioPnL(
  userId: string
): Promise<PortfolioPnLSnapshot | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return null;
  }

  const kind = resolveUserIdentifierKind(normalizedUserId);
  const whereClause =
    kind === 'id'
      ? eq(users.id, normalizedUserId)
      : kind === 'privyId'
        ? eq(users.privyId, normalizedUserId)
        : sql`lower(${users.username}) = lower(${normalizedUserId})`;

  const userResult = await db
    .select({
      id: users.id,
      privyId: users.privyId,
      virtualBalance: users.virtualBalance,
      totalDeposited: users.totalDeposited,
      totalWithdrawn: users.totalWithdrawn,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(whereClause)
    .limit(1);

  let user = userResult[0];
  if (!user && kind !== 'id') {
    const fallbackResult = await db
      .select({
        id: users.id,
        privyId: users.privyId,
        virtualBalance: users.virtualBalance,
        totalDeposited: users.totalDeposited,
        totalWithdrawn: users.totalWithdrawn,
        lifetimePnL: users.lifetimePnL,
      })
      .from(users)
      .where(eq(users.id, normalizedUserId))
      .limit(1);
    user = fallbackResult[0];
  }

  if (!user) return null;

  const canonicalUserId = user.id;
  const positionUserIds = Array.from(
    new Set([canonicalUserId, user.privyId].filter(Boolean))
  ) as string[];

  const onchainPerpsEnabled = isOnchainPerpSettlementMode();
  const onchainService = onchainPerpsEnabled ? new OnchainPerpService() : null;
  const [onchainPerpPositions, onchainAvailableBalance] =
    onchainPerpsEnabled && onchainService
      ? await Promise.all([
          syncOnchainPerpPositionsForUser(canonicalUserId, onchainService),
          getOnchainPerpAvailableBalanceForUser(
            canonicalUserId,
            onchainService
          ),
        ])
      : [[], null];

  const perpPositionResults = onchainPerpsEnabled
    ? []
    : await db
        .select({
          unrealizedPnL: perpPositions.unrealizedPnL,
        })
        .from(perpPositions)
        .where(
          and(
            inArray(perpPositions.userId, positionUserIds),
            isNull(perpPositions.closedAt)
          )
        );

  // For prediction positions, we need to join with markets
  const predictionPositionResults = await db
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
    );

  const totalDeposited = toNumber(user.totalDeposited);
  const totalWithdrawn = toNumber(user.totalWithdrawn);
  const lifetimePnL = toNumber(user.lifetimePnL);
  const availableBalance =
    toNumber(user.virtualBalance) + (onchainAvailableBalance ?? 0);

  const perpUnrealized = onchainPerpsEnabled
    ? onchainPerpPositions.reduce(
        (sum, position) => sum + position.unrealizedPnL,
        0
      )
    : perpPositionResults.reduce(
        (sum, position) => sum + toNumber(position.unrealizedPnL),
        0
      );

  const predictionUnrealized = predictionPositionResults.reduce(
    (sum, position) => {
      const shares = toNumber(position.shares);
      const avgPrice = toNumber(position.avgPrice);

      // Calculate current price from shares (CPMM pricing)
      const yesShares = toNumber(position.marketYesShares);
      const noShares = toNumber(position.marketNoShares);
      const totalShares = yesShares + noShares;

      const currentPrice =
        totalShares > 0
          ? position.side === true
            ? noShares / totalShares // Yes price = noShares / total
            : yesShares / totalShares // No price = yesShares / total
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
}
