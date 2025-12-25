/**
 * Perp Markets Hooks - react-query based data fetching for perpetual markets
 *
 * Uses react-query for automatic caching, deduplication, and background refetching.
 *
 * @example
 * ```tsx
 * import { usePerpMarkets, usePerpMarket, usePerpTopMovers } from '@/hooks/usePerpMarkets';
 *
 * function MyComponent() {
 *   const { markets, loading, error, refetch } = usePerpMarkets();
 *   return <div>{markets.map(m => ...)}</div>;
 * }
 *
 * // With polling:
 * const { markets } = usePerpMarkets({ pollingInterval: 30000 });
 * ```
 */

import { PerpMarketsResponseSchema } from '@babylon/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { PerpMarket } from '../types/markets'
import { MARKETS_CONFIG } from '../types/markets'

/** Query key for perp markets - export for cache invalidation */
export const PERP_MARKETS_QUERY_KEY = ['perpMarkets'] as const

interface UsePerpMarketsOptions {
  /** Polling interval in ms. Set to enable automatic refetching. */
  pollingInterval?: number
  /** Whether the query is enabled (default: true) */
  enabled?: boolean
}

async function fetchPerpMarkets(): Promise<PerpMarket[]> {
  const response = await fetch('/api/markets/perps')
  if (!response.ok) {
    throw new Error(`Failed to fetch perp markets: ${response.status}`)
  }

  const rawData = await response.json()
  const validated = PerpMarketsResponseSchema.parse(rawData)
  return validated.markets as PerpMarket[]
}

/**
 * Hook for consuming perp markets data.
 * Uses react-query for automatic caching, deduplication, and stale-while-revalidate.
 *
 * @param options - Configuration options including pollingInterval and enabled
 */
export function usePerpMarkets(options: UsePerpMarketsOptions = {}) {
  const { pollingInterval, enabled = true } = options

  const {
    data: markets = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: PERP_MARKETS_QUERY_KEY,
    queryFn: fetchPerpMarkets,
    staleTime: MARKETS_CONFIG.CACHE_TTL_MS,
    refetchInterval: pollingInterval,
    enabled,
  })

  const handleRefetch = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    markets,
    loading: isLoading,
    error: error as Error | null,
    refetch: handleRefetch,
  }
}

/**
 * Hook for enabling polling on perp markets.
 * This is a convenience wrapper for components that just need to enable polling.
 *
 * @param intervalMs - Polling interval in milliseconds (default: 30000)
 */
export function _usePerpMarketsPolling(
  intervalMs = MARKETS_CONFIG.DEFAULT_POLLING_INTERVAL_MS,
) {
  // Just return the hook with polling enabled - react-query handles the rest
  return usePerpMarkets({ pollingInterval: intervalMs })
}

/**
 * Get a specific market by ticker (memoized).
 *
 * @param ticker - The market ticker to find
 * @param options - Configuration options including pollingInterval
 */
export function _usePerpMarket(
  ticker: string,
  options: UsePerpMarketsOptions = {},
) {
  const { markets, loading, error, refetch } = usePerpMarkets(options)

  const market = useMemo(
    () => markets.find((m) => m.ticker.toLowerCase() === ticker.toLowerCase()),
    [markets, ticker],
  )

  return { market, loading, error, refetch }
}

/**
 * Get top movers (gainers and losers) - memoized.
 *
 * @param count - Number of top movers to return (default: 4)
 * @param options - Configuration options including pollingInterval
 */
export function usePerpTopMovers(
  count = MARKETS_CONFIG.TOP_MOVERS_COUNT,
  options: UsePerpMarketsOptions = {},
) {
  const { markets, loading, error, refetch } = usePerpMarkets(options)

  const { topGainers, topLosers } = useMemo(() => {
    const sorted = [...markets].sort(
      (a, b) => b.changePercent24h - a.changePercent24h,
    )
    return {
      topGainers: sorted.slice(0, count),
      topLosers: sorted.slice(-count).reverse(),
    }
  }, [markets, count])

  return { topGainers, topLosers, loading, error, refetch }
}

/**
 * Prefetch perp markets data.
 * Useful for prefetching before navigation or in SSR.
 */
export function _usePrefetchPerpMarkets() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    return queryClient.prefetchQuery({
      queryKey: PERP_MARKETS_QUERY_KEY,
      queryFn: fetchPerpMarkets,
      staleTime: MARKETS_CONFIG.CACHE_TTL_MS,
    })
  }, [queryClient])
}

/**
 * Get cached perp markets data synchronously.
 * Useful when you need to access cached data outside of a component render.
 */
export function _useGetCachedPerpMarkets() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    return queryClient.getQueryData<PerpMarket[]>(PERP_MARKETS_QUERY_KEY) ?? []
  }, [queryClient])
}

/**
 * Fetch and return perp markets (awaitable).
 * Useful for imperative fetching in event handlers.
 */
export function useFetchPerpMarkets() {
  const queryClient = useQueryClient()

  return useCallback(async () => {
    return queryClient.fetchQuery({
      queryKey: PERP_MARKETS_QUERY_KEY,
      queryFn: fetchPerpMarkets,
      staleTime: MARKETS_CONFIG.CACHE_TTL_MS,
    })
  }, [queryClient])
}
