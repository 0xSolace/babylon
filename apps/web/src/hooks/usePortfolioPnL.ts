'use client';

import type { PortfolioPnLSnapshot } from '@babylon/engine/client';
import {
  BalanceApiResponseSchema,
  UserPositionsApiResponseSchema,
} from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Re-export for components that import from this hook
export type { PortfolioPnLSnapshot } from '@babylon/engine/client';

/**
 * Return type for the usePortfolioPnL hook.
 */
interface UsePortfolioPnLResult {
  /** Whether portfolio data is currently loading */
  loading: boolean;
  /** Any error that occurred while fetching portfolio data */
  error: string | null;
  /** Portfolio PnL snapshot containing all calculated metrics */
  data: PortfolioPnLSnapshot | null;
  /** Function to manually refresh portfolio data */
  refresh: () => Promise<void>;
  /** Timestamp of last successful update */
  lastUpdated: number | null;
}

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

interface PortfolioQueryData {
  snapshot: PortfolioPnLSnapshot;
  lastUpdated: number;
}

/**
 * Hook for fetching and managing portfolio profit and loss (PnL) data.
 *
 * Calculates comprehensive portfolio metrics including:
 * - Lifetime PnL (realized gains/losses)
 * - Unrealized PnL from open positions (perpetuals and predictions)
 * - Net contributions (deposits minus withdrawals)
 * - Account equity (net contributions + total PnL)
 * - Available balance
 *
 * Automatically fetches data when the user is authenticated and refreshes
 * when the user changes.
 *
 * @returns Portfolio PnL state including loading status, error, data, and refresh function.
 *
 * @example
 * ```tsx
 * const { data, loading, refresh } = usePortfolioPnL();
 *
 * if (loading) return <div>Loading...</div>;
 * if (data) {
 *   return (
 *     <div>
 *       <p>Total PnL: ${data.totalPnL}</p>
 *       <p>Account Equity: ${data.accountEquity}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePortfolioPnL(): UsePortfolioPnLResult {
  const { user, authenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolioPnL', user?.id],
    queryFn: async (): Promise<PortfolioQueryData> => {
      const [balanceRes, positionsRes] = await Promise.all([
        fetch(`/api/users/${encodeURIComponent(user!.id)}/balance`),
        fetch(`/api/markets/positions/${encodeURIComponent(user!.id)}`),
      ]);

      const balanceRaw: unknown = await balanceRes.json();
      const positionsRaw: unknown = await positionsRes.json();
      const balanceJson = BalanceApiResponseSchema.parse(balanceRaw);
      const positionsJson = UserPositionsApiResponseSchema.parse(positionsRaw);

      const totalDeposited = toNumber(balanceJson.totalDeposited);
      const totalWithdrawn = toNumber(balanceJson.totalWithdrawn);
      const lifetimePnL = toNumber(balanceJson.lifetimePnL);
      const availableBalance = toNumber(balanceJson.balance);

      const perpUnrealized = (positionsJson.perpetuals?.positions ?? []).reduce(
        (
          sum: number,
          position: { unrealizedPnL?: number | string | undefined }
        ) => sum + toNumber(position.unrealizedPnL),
        0
      );

      const predictionUnrealized = (
        positionsJson.predictions?.positions ?? []
      ).reduce(
        (
          sum: number,
          position: { unrealizedPnL?: number | string | undefined }
        ) => sum + toNumber(position.unrealizedPnL),
        0
      );

      const totalUnrealizedPnL = perpUnrealized + predictionUnrealized;
      const totalPnL = lifetimePnL + totalUnrealizedPnL;
      const netContributions = totalDeposited - totalWithdrawn;
      const accountEquity = netContributions + totalPnL;

      return {
        snapshot: {
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
        },
        lastUpdated: Date.now(),
      };
    },
    enabled: authenticated && !!user?.id,
    staleTime: 30000,
  });

  const refresh = useCallback(async () => {
    if (authenticated && user?.id) {
      await queryClient.invalidateQueries({
        queryKey: ['portfolioPnL', user.id],
      });
    }
  }, [queryClient, authenticated, user?.id]);

  return {
    loading: isLoading,
    error: error ? (error as Error).message : null,
    data: data?.snapshot ?? null,
    refresh,
    lastUpdated: data?.lastUpdated ?? null,
  };
}
