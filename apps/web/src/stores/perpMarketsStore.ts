/**
 * Perp Markets Hooks - React Query based data fetching for perpetual markets
 *
 * This module provides hooks for fetching and caching perp markets data using react-query.
 * The hooks prevent duplicate API calls via react-query's built-in caching and deduplication.
 *
 * Usage:
 * ```tsx
 * import { usePerpMarkets, usePerpMarket } from '@/stores/perpMarketsStore';
 *
 * function MyComponent() {
 *   const { markets, loading, error, refetch } = usePerpMarkets();
 *   return <div>{markets.map(m => ...)}</div>;
 * }
 * ```
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { PerpMarket } from '@/types/markets';
import { MARKETS_CONFIG } from '@/types/markets';

// Re-export for backwards compatibility
export type { PerpMarket } from '@/types/markets';

/** Query key for perp markets */
export const PERP_MARKETS_QUERY_KEY = ['markets', 'perps'] as const;

/** Fetch perp markets from API */
async function fetchPerpMarkets(): Promise<PerpMarket[]> {
  const response = await fetch('/api/markets/perps');

  if (!response.ok) {
    throw new Error(`Failed to fetch perp markets: ${response.status}`);
  }

  const data = (await response.json()) as { markets?: PerpMarket[] };
  return data.markets ?? [];
}

/**
 * Hook for consuming perp markets data.
 * Automatically fetches data on mount and caches results.
 *
 * @param options - Optional configuration
 */
export function usePerpMarkets(options?: { pollingInterval?: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: PERP_MARKETS_QUERY_KEY,
    queryFn: fetchPerpMarkets,
    staleTime: MARKETS_CONFIG.CACHE_TTL_MS,
    refetchInterval: options?.pollingInterval,
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
 * Get a specific perp market by ticker (memoized)
 */
export function usePerpMarket(ticker: string) {
  const { markets, loading, error, refetch } = usePerpMarkets();

  const market = useMemo(
    () => markets.find((m) => m.ticker === ticker),
    [markets, ticker]
  );

  return { market, loading, error, refetch };
}

/**
 * Hook to invalidate perp markets cache.
 * Useful after mutations (open/close positions).
 */
export function useInvalidatePerpMarkets() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: PERP_MARKETS_QUERY_KEY,
    });
  }, [queryClient]);
}
