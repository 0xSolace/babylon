'use client';

import { useMemo } from 'react';
import { useUserPositions } from '@/hooks/useUserPositions';

/**
 * Hook to calculate an agent's total P&L (realized + unrealized).
 *
 * Fetches positions for the agent and calculates unrealized P&L from open positions,
 * then combines with realized P&L to provide the true total.
 *
 * @param agentId - Agent ID to fetch positions for
 * @param realizedPnL - Realized P&L from the agent record (lifetimePnL field)
 *
 * @example
 * ```tsx
 * const { totalPnL, unrealizedPnL, loading } = useAgentTotalPnL(agent.id, agent.lifetimePnL);
 * ```
 */
export function useAgentTotalPnL(
  agentId: string | undefined,
  realizedPnL: string | number
) {
  const {
    predictionPositions: predictions,
    perpPositions: perps,
    loading: positionsLoading,
    error: positionsError,
  } = useUserPositions(agentId);

  // Calculate unrealized P&L and points in positions in a single pass
  // Uses explicit Number coercion with isFinite checks to prevent NaN propagation
  const { unrealizedPnL, pointsInPositions } = useMemo(() => {
    let predictionPnL = 0;
    let predictionValue = 0;

    for (const pos of predictions) {
      const unrealized = Number(pos.unrealizedPnL);
      predictionPnL += Number.isFinite(unrealized) ? unrealized : 0;

      const currentVal = Number(pos.currentValue);
      if (Number.isFinite(currentVal)) {
        predictionValue += currentVal;
      } else {
        const shares = Number(pos.shares);
        const price = Number(pos.currentPrice);
        if (Number.isFinite(shares) && Number.isFinite(price)) {
          predictionValue += shares * price;
        }
      }
    }

    let perpPnL = 0;
    let perpValue = 0;

    for (const pos of perps) {
      const unrealized = Number(pos.unrealizedPnL);
      perpPnL += Number.isFinite(unrealized) ? unrealized : 0;

      const leverage = Number(pos.leverage);
      const size = Number(pos.size);
      if (Number.isFinite(leverage) && leverage > 0 && Number.isFinite(size)) {
        perpValue += Math.abs(size / leverage);
      }
    }

    return {
      unrealizedPnL: predictionPnL + perpPnL,
      pointsInPositions: predictionValue + perpValue,
    };
  }, [predictions, perps]);

  const realized =
    typeof realizedPnL === 'string'
      ? parseFloat(realizedPnL) || 0
      : realizedPnL;
  const totalPnL = realized + unrealizedPnL;

  // Defer profitability determination until positions are loaded to avoid color flash
  const isProfitable = positionsLoading ? realized >= 0 : totalPnL >= 0;

  return {
    /** Realized P&L (from closed trades) */
    realizedPnL: realized,
    /** Unrealized P&L (from open positions) */
    unrealizedPnL,
    /** Total P&L (realized + unrealized) */
    totalPnL,
    /** Total value of open positions */
    pointsInPositions,
    /** Whether total P&L is positive (defers to realized while loading) */
    isProfitable,
    /** Whether positions are still loading */
    loading: positionsLoading,
    /** Error from fetching positions */
    error: positionsError,
    /** Prediction positions */
    predictions,
    /** Perpetual positions */
    perps,
  };
}
