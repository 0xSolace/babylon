/**
 * Server-side portfolio breakdown (wallet + agents + positions) for consistent P/L.
 */

import { isOpenPerpPositionStateValid } from '@babylon/core/markets/perps';
import { PredictionPricing } from '@babylon/core/markets/prediction';
import { fetchPortfolioBreakdownReadModel } from '@babylon/db';
import { logger } from '@babylon/shared';
import { FEE_CONFIG } from '../config/fees';
import {
  calculatePerpPositionMarketValue,
  toNumber,
} from '../portfolio-valuation';

export interface PortfolioBreakdownSnapshot {
  wallet: number;
  agents: number;
  positions: number;
  available: number;
  originalAmount: number;
  totalAssets: number;
  totalPnL: number;
  agentCount: number;
  totalPoints: number;
  members: PortfolioBreakdownMember[];
}

export interface PortfolioBreakdownMember {
  id: string;
  name: string;
  wallet: number;
  isAgent: boolean;
}

function clampFeeRate(rate: number): number {
  return rate > 0 && rate < 1 ? rate : 0;
}

function calculatePredictionPositionValue(position: {
  shares: unknown;
  avgPrice: unknown;
  side: boolean | null;
  marketYesShares: unknown;
  marketNoShares: unknown;
}): number {
  const shares = toNumber(position.shares);
  const avgPrice = toNumber(position.avgPrice);

  const yesShares = toNumber(position.marketYesShares);
  const noShares = toNumber(position.marketNoShares);

  const feeRate = clampFeeRate(FEE_CONFIG.TRADING_FEE_RATE);
  const costBasisNet = shares * avgPrice;
  const costBasis = feeRate > 0 ? costBasisNet / (1 - feeRate) : costBasisNet;

  if (shares <= 0 || yesShares <= 0 || noShares <= 0) {
    return costBasis;
  }

  const sideKey = position.side ? 'yes' : 'no';
  const sellPreview = PredictionPricing.calculateSellWithFees(
    yesShares,
    noShares,
    sideKey,
    shares,
    feeRate
  );

  return sellPreview.netProceeds ?? sellPreview.totalCost;
}

/**
 * Canonical portfolio breakdown used across Profile, Dashboard, OG, etc.
 *
 * Total P/L formula:
 *   totalPnL = (agents + positions + wallet) - originalAmount
 * where originalAmount includes net peer transfers.
 *
 * **WHY classification-based routing on the initial user row?**
 * - Previously: `or(eq(users.id, userId), eq(users.privyId, userId))` forced the planner to merge predicates and often blocked a clean single-index plan.
 * - Now: `resolveUserIdentifierKind` from `@babylon/shared` picks one branch (PK, unique privyId, or case-insensitive username) so each lookup uses one optimal index.
 * - **WHY `lower(username)` for the username branch?** Matches `idx_users_username_lower` and stays consistent with `findUserByIdentifier` (case-insensitive usernames).
 *
 * Further detail: `packages/engine/src/services/PORTFOLIO_BREAKDOWN_OPTIMIZATION.md`.
 *
 * @param userId - User identifier (UUID, snowflake ID, privyId, or username)
 * @returns Portfolio snapshot or null if user not found
 */
export async function calculatePortfolioBreakdown(
  userId: string
): Promise<PortfolioBreakdownSnapshot | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return null;
  }

  const readModel = await fetchPortfolioBreakdownReadModel(normalizedUserId);
  if (!readModel) return null;

  const { user, agentRows, perpRows, predictionRows, netTransfersRaw } =
    readModel;

  const canonicalUserId = user.id;
  const agentCount = agentRows.length;

  const wallet = toNumber(user.virtualBalance);
  const agents = agentRows.reduce(
    (sum, agent) => sum + toNumber(agent.virtualBalance),
    0
  );

  const invalidPerpRows = perpRows.filter(
    (position) => !isOpenPerpPositionStateValid(position)
  );
  if (invalidPerpRows.length > 0) {
    logger.warn(
      'Excluding invalid open perp positions from portfolio breakdown',
      {
        userId: canonicalUserId,
        invalidPerpPositions: invalidPerpRows.length,
      },
      'PortfolioBreakdown'
    );
  }

  const perpsValue = perpRows.reduce(
    (sum, p) => sum + calculatePerpPositionMarketValue(p),
    0
  );

  const predictionsValue = predictionRows.reduce(
    (sum, p) =>
      sum +
      calculatePredictionPositionValue({
        shares: p.shares,
        avgPrice: p.avgPrice,
        side: p.side,
        marketYesShares: p.marketYesShares,
        marketNoShares: p.marketNoShares,
      }),
    0
  );

  const positionsValue = perpsValue + predictionsValue;

  const totalDeposited = toNumber(user.totalDeposited);
  const totalWithdrawn = toNumber(user.totalWithdrawn);

  const netTransfers = toNumber(netTransfersRaw);
  const originalAmount = totalDeposited - totalWithdrawn + netTransfers;

  const available = wallet + agents;
  const totalAssets = wallet + agents + positionsValue;
  const totalPnL = totalAssets - originalAmount;
  const totalPoints = wallet + positionsValue + user.reputationPoints;
  const members: PortfolioBreakdownMember[] = [
    {
      id: canonicalUserId,
      name: user.displayName || user.username || 'You (Owner)',
      wallet,
      isAgent: false,
    },
    ...agentRows.map((agent) => ({
      id: agent.id,
      name: agent.displayName || agent.username || 'Agent',
      wallet: toNumber(agent.virtualBalance),
      isAgent: true,
    })),
  ];

  return {
    wallet,
    agents,
    positions: positionsValue,
    available,
    originalAmount,
    totalAssets,
    totalPnL,
    agentCount,
    totalPoints,
    members,
  };
}
