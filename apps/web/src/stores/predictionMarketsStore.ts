/**
 * Prediction Markets Hooks - React Query based data fetching for prediction markets
 *
 * This module provides hooks for fetching and caching prediction markets data using react-query.
 * The hooks prevent duplicate API calls via react-query's built-in caching and deduplication.
 *
 * Usage:
 * ```tsx
 * import { usePredictionMarkets, usePredictionMarketsPolling } from '@/stores/predictionMarketsStore';
 *
 * function MyComponent() {
 *   const { markets, loading, error, refetch } = usePredictionMarkets();
 *   usePredictionMarketsPolling(30000); // Optional: enable polling every 30s
 *   return <div>{markets.map(m => ...)}</div>;
 * }
 * ```
 */

import { PredictionMarketsResponseSchema } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import type { PredictionMarket } from '@/types/markets';
import { MARKETS_CONFIG } from '@/types/markets';

// Re-export for backwards compatibility
export type { PredictionMarket } from '@/types/markets';

/** Query key for prediction markets */
export const PREDICTION_MARKETS_QUERY_KEY = ['markets', 'predictions'] as const;

/** Build query key with optional userId */
function buildQueryKey(userId?: string) {
  return userId
    ? ([...PREDICTION_MARKETS_QUERY_KEY, userId] as const)
    : PREDICTION_MARKETS_QUERY_KEY;
}

/** Fetch prediction markets from API */
async function fetchPredictionMarkets(
  userId?: string
): Promise<PredictionMarket[]> {
  const url = userId
    ? `/api/markets/predictions?userId=${encodeURIComponent(userId)}`
    : '/api/markets/predictions';

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch prediction markets: ${response.status}`);
  }

  const rawData: unknown = await response.json();
  const validated = PredictionMarketsResponseSchema.parse(rawData);
  return validated.questions as PredictionMarket[];
}

/**
 * Hook for consuming prediction markets data.
 * Automatically fetches data on mount and caches results.
 *
 * @param userId - Optional user ID for fetching with positions
 * @param options - Optional configuration
 */
export function usePredictionMarkets(
  userId?: string,
  options?: { pollingInterval?: number }
) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: buildQueryKey(userId),
    queryFn: () => fetchPredictionMarkets(userId),
    staleTime: MARKETS_CONFIG.CACHE_TTL_MS,
    refetchInterval: options?.pollingInterval,
    // Don't show loading spinner on background refetches
    placeholderData: (previousData) => previousData,
  });

  const markets = data ?? [];

  return {
    markets,
    loading: isLoading,
    error: error?.message ?? null,
    refetch: useCallback(() => refetch(), [refetch]),
  };
}

/**
 * Hook for enabling polling on prediction markets.
 * Uses react-query's refetchInterval for automatic background updates.
 *
 * This hook triggers a query that will be deduplicated with other usePredictionMarkets calls.
 *
 * @param intervalMs - Polling interval in milliseconds (default: 30000)
 * @param userId - Optional user ID for fetching with positions
 */
export function usePredictionMarketsPolling(
  intervalMs = 30000,
  userId?: string
) {
  // Store params in refs so they don't cause re-renders
  const intervalRef = useRef(intervalMs);
  const userIdRef = useRef(userId);

  // This query will be deduplicated with the main usePredictionMarkets query
  // The refetchInterval will be used if it's the shortest interval among all subscribers
  useQuery({
    queryKey: buildQueryKey(userIdRef.current),
    queryFn: () => fetchPredictionMarkets(userIdRef.current),
    staleTime: MARKETS_CONFIG.CACHE_TTL_MS,
    refetchInterval: intervalRef.current,
  });
}

/**
 * Get a specific market by ID (memoized)
 */
export function usePredictionMarket(marketId: string | number) {
  const { markets, loading, error, refetch } = usePredictionMarkets();

  const market = useMemo(
    () => markets.find((m) => m.id.toString() === marketId.toString()),
    [markets, marketId]
  );

  return { market, loading, error, refetch };
}

/**
 * Get active markets only (memoized)
 */
export function useActivePredictionMarkets() {
  const { markets, loading, error, refetch } = usePredictionMarkets();

  const activeMarkets = useMemo(
    () => markets.filter((m) => m.status === 'active'),
    [markets]
  );

  return { markets: activeMarkets, loading, error, refetch };
}

/**
 * Get market statistics (memoized)
 */
export function usePredictionMarketsStats() {
  const { markets, loading } = usePredictionMarkets();

  const stats = useMemo(
    () => ({
      total: markets.length,
      active: markets.filter((m) => m.status === 'active').length,
      resolved: markets.filter((m) => m.status === 'resolved').length,
      totalVolume: markets.reduce(
        (sum, m) => sum + (m.yesShares ?? 0) + (m.noShares ?? 0),
        0
      ),
    }),
    [markets]
  );

  return { stats, loading };
}

/**
 * Hook to invalidate prediction markets cache.
 * Useful after mutations (buy/sell shares).
 */
export function useInvalidatePredictionMarkets() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: PREDICTION_MARKETS_QUERY_KEY,
    });
  }, [queryClient]);
}
