'use client';

import type { PerpPosition } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Represents a user's position in a prediction market.
 */

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export interface UserPredictionPosition {
  id: string;
  marketId: string;
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  unrealizedPnL: number;
  resolved: boolean;
  resolution: boolean | null;
}

interface PerpStats {
  totalPositions: number;
  totalPnL: number;
  totalFunding: number;
}

interface PositionsState {
  perpPositions: PerpPosition[];
  predictionPositions: UserPredictionPosition[];
  perpStats: PerpStats;
}

type NumericLike = number | string | null | undefined;

interface ApiPerpPositionPayload {
  id: string;
  userId?: string;
  ticker: string;
  organizationId?: string;
  side: PerpPosition['side'];
  entryPrice: NumericLike;
  currentPrice: NumericLike;
  size: NumericLike;
  leverage: NumericLike;
  liquidationPrice?: NumericLike;
  unrealizedPnL?: NumericLike;
  unrealizedPnLPercent?: NumericLike;
  fundingPaid?: NumericLike;
  openedAt: string;
  lastUpdated?: string;
}

interface ApiPredictionPositionPayload {
  id: string;
  marketId: string;
  question: string;
  side: UserPredictionPosition['side'];
  shares: NumericLike;
  avgPrice: NumericLike;
  currentPrice: NumericLike;
  currentValue?: NumericLike;
  costBasis?: NumericLike;
  unrealizedPnL?: NumericLike;
  currentProbability?: NumericLike;
  resolved?: boolean;
  resolution?: boolean | null;
}

interface PositionsApiResponse {
  perpetuals?: {
    positions?: ApiPerpPositionPayload[];
    stats?: PerpStats;
  };
  predictions?: {
    positions?: ApiPredictionPositionPayload[];
  };
}

/**
 * Options for configuring user positions loading.
 */
interface UseUserPositionsOptions {
  /** Whether to enable position fetching (default: true) */
  enabled?: boolean;
}

const DEFAULT_STATS: PerpStats = {
  totalPositions: 0,
  totalPnL: 0,
  totalFunding: 0,
};

const createDefaultState = (): PositionsState => ({
  perpPositions: [],
  predictionPositions: [],
  perpStats: { ...DEFAULT_STATS },
});

/**
 * Hook for fetching and managing user trading positions.
 *
 * Loads all positions (both perpetual and prediction markets) for a given user.
 * Automatically refreshes when the userId changes.
 *
 * @param userId - The user ID to fetch positions for, or null/undefined to clear positions
 * @param options - Configuration options including enabled flag
 *
 * @returns An object containing:
 * - `perpPositions`: Array of perpetual market positions
 * - `predictionPositions`: Array of prediction market positions
 * - `perpStats`: Aggregate statistics for perpetual positions
 * - `loading`: Whether positions are currently loading
 * - `error`: Any error that occurred while fetching
 * - `refresh`: Function to manually refresh positions
 *
 * @example
 * ```tsx
 * const { perpPositions, predictionPositions, loading } = useUserPositions(userId);
 *
 * if (loading) return <div>Loading positions...</div>;
 *
 * return (
 *   <div>
 *     <h2>Perpetual Positions: {perpPositions.length}</h2>
 *     <h2>Prediction Positions: {predictionPositions.length}</h2>
 *   </div>
 * );
 * ```
 */
export function useUserPositions(
  userId?: string | null,
  options: UseUserPositionsOptions = {}
) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const {
    data = createDefaultState(),
    isLoading,
    error,
  } = useQuery({
    queryKey: ['userPositions', userId],
    queryFn: async (): Promise<PositionsState> => {
      const response = await fetch(
        `/api/markets/positions/${encodeURIComponent(userId!)}`
      );

      const responseData = (await response.json()) as PositionsApiResponse;

      const perpetuals = responseData?.perpetuals ?? {};
      const predictions = responseData?.predictions ?? {};

      const normalizedPerps = (perpetuals.positions ?? []).map(
        (pos: ApiPerpPositionPayload) => ({
          id: pos.id,
          userId: pos.userId,
          ticker: pos.ticker,
          organizationId: pos.organizationId,
          side: pos.side,
          entryPrice: toNumber(pos.entryPrice),
          currentPrice: toNumber(pos.currentPrice),
          size: toNumber(pos.size),
          leverage: toNumber(pos.leverage),
          liquidationPrice: toNumber(pos.liquidationPrice),
          unrealizedPnL: toNumber(pos.unrealizedPnL),
          unrealizedPnLPercent: toNumber(pos.unrealizedPnLPercent),
          fundingPaid: toNumber(pos.fundingPaid),
          openedAt: pos.openedAt,
          lastUpdated: pos.lastUpdated ?? pos.openedAt,
        })
      ) as PerpPosition[];

      const normalizedPredictions = (predictions.positions ?? []).map(
        (pos: ApiPredictionPositionPayload) => {
          const shares = toNumber(pos.shares);
          const avgPrice = toNumber(pos.avgPrice);
          return {
            id: pos.id,
            marketId: pos.marketId,
            question: pos.question,
            side: pos.side,
            shares,
            avgPrice,
            currentPrice: toNumber(pos.currentPrice),
            currentValue: toNumber(pos.currentValue ?? 0),
            costBasis: toNumber(pos.costBasis ?? shares * avgPrice),
            unrealizedPnL: toNumber(pos.unrealizedPnL ?? 0),
            resolved: Boolean(pos.resolved),
            resolution: pos.resolution ?? null,
          };
        }
      ) as UserPredictionPosition[];

      return {
        perpPositions: normalizedPerps,
        predictionPositions: normalizedPredictions,
        perpStats: perpetuals.stats ?? { ...DEFAULT_STATS },
      };
    },
    enabled: enabled && !!userId,
    staleTime: 30000,
  });

  const refresh = useCallback(() => {
    if (userId && enabled) {
      void queryClient.invalidateQueries({
        queryKey: ['userPositions', userId],
      });
    }
  }, [queryClient, userId, enabled]);

  return {
    perpPositions: data.perpPositions,
    predictionPositions: data.predictionPositions,
    perpStats: data.perpStats,
    loading: isLoading,
    error: error as Error | null,
    refresh,
  };
}
