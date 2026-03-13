/**
 * Shared portfolio metric calculation utilities.
 *
 * These helpers are the single source of truth for computing portfolio metrics
 * (invested capital, PnL, utilization, etc.) from raw position data. They are
 * consumed by both NPCInvestmentManager.getPortfolioMetrics (per-pool live
 * path) and the leaderboard fallback batch path.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FallbackPositionRow = {
  id: string;
  poolId: string;
  marketType: string;
  size: number | null;
  leverage: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  closedAt: Date | null;
};

export type FallbackPerpRow = {
  id: string;
  userId: string;
  size: number | null;
  leverage: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  closedAt: Date | null;
};

export interface PoolMetrics {
  availableBalance: number;
  totalInvested: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positionCount: number;
  utilization: number;
  totalValue: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a leverage value: returns the numeric value when it is a
 * positive finite number, otherwise falls back to 1 (unleveraged).
 */
export function getEffectiveLeverage(
  leverage: number | null | undefined
): number {
  return Number.isFinite(leverage) && Number(leverage) > 0
    ? Number(leverage)
    : 1;
}

/**
 * Compute the capital exposure (margin) for a position.
 *
 * - When `leverage` is omitted the position is treated as spot / prediction
 *   and the absolute size is returned.
 * - When `leverage` is provided the size is divided by the effective leverage.
 */
export function getPositionExposure(
  size: number | null | undefined,
  leverage?: number | null
): number {
  const numericSize = Number(size ?? 0);
  if (!Number.isFinite(numericSize)) return 0;

  if (leverage === undefined) {
    return Math.abs(numericSize);
  }

  return Math.abs(numericSize / getEffectiveLeverage(leverage));
}

// ---------------------------------------------------------------------------
// Batch builder
// ---------------------------------------------------------------------------

/**
 * Build portfolio metrics for every pool in `activePools` from pre-fetched
 * position and balance rows.
 *
 * This uses the exact same calculation logic as the per-pool live path in
 * `NPCInvestmentManager.getPortfolioMetrics` so that live and fallback
 * numbers are always consistent.
 */
export function buildFallbackMetricsByPool<TPool extends { id: string }>(
  activePools: TPool[],
  balances: Array<{ id: string; tradingBalance: string | null }>,
  positionRows: FallbackPositionRow[],
  perpRows: FallbackPerpRow[]
): Map<string, PoolMetrics> {
  const balanceByPoolId = new Map(
    balances.map(({ id, tradingBalance }) => [
      id,
      Number.parseFloat(tradingBalance ?? '0'),
    ])
  );

  const perpIdsByPool = new Map<string, Set<string>>();
  for (const perp of perpRows) {
    const ids = perpIdsByPool.get(perp.userId) ?? new Set<string>();
    ids.add(perp.id);
    perpIdsByPool.set(perp.userId, ids);
  }

  const metricsByPool = new Map<
    string,
    {
      availableBalance: number;
      totalInvested: number;
      unrealizedPnL: number;
      realizedPnL: number;
      positionCount: number;
    }
  >();

  const ensureMetrics = (poolId: string) => {
    const existing = metricsByPool.get(poolId);
    if (existing) return existing;

    const created = {
      availableBalance: balanceByPoolId.get(poolId) ?? 0,
      totalInvested: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      positionCount: 0,
    };
    metricsByPool.set(poolId, created);
    return created;
  };

  for (const position of positionRows) {
    if (
      position.marketType === 'perp' &&
      perpIdsByPool.get(position.poolId)?.has(position.id)
    ) {
      continue;
    }

    const metrics = ensureMetrics(position.poolId);
    const isOpen = position.closedAt === null;

    if (isOpen) {
      metrics.totalInvested +=
        position.marketType === 'perp'
          ? getPositionExposure(position.size, position.leverage)
          : getPositionExposure(position.size);
      metrics.unrealizedPnL += Number(position.unrealizedPnL ?? 0);
      metrics.positionCount += 1;
      continue;
    }

    metrics.realizedPnL += Number(position.realizedPnL ?? 0);
  }

  for (const perp of perpRows) {
    const metrics = ensureMetrics(perp.userId);
    const isOpen = perp.closedAt === null;

    if (isOpen) {
      metrics.totalInvested += getPositionExposure(perp.size, perp.leverage);
      metrics.unrealizedPnL += Number(perp.unrealizedPnL ?? 0);
      metrics.positionCount += 1;
      continue;
    }

    metrics.realizedPnL += Number(perp.realizedPnL ?? 0);
  }

  return new Map(
    activePools.map((pool) => {
      const metrics = ensureMetrics(pool.id);
      const totalValue =
        metrics.availableBalance +
        metrics.totalInvested +
        metrics.unrealizedPnL;
      const utilization =
        totalValue > 0 ? (metrics.totalInvested / totalValue) * 100 : 0;

      return [
        pool.id,
        {
          availableBalance: metrics.availableBalance,
          totalInvested: metrics.totalInvested,
          unrealizedPnL: metrics.unrealizedPnL,
          realizedPnL: metrics.realizedPnL,
          positionCount: metrics.positionCount,
          utilization,
          totalValue,
        },
      ];
    })
  );
}
