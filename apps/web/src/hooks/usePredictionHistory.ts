import { PredictionHistoryApiResponseSchema } from '@babylon/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { usePredictionMarketStream } from '@/hooks/usePredictionMarketStream'

/**
 * Represents a single point in prediction market price history.
 */
export interface PredictionHistoryPoint {
  /** Timestamp in milliseconds */
  time: number
  /** Current YES outcome price (0-1) */
  yesPrice: number
  /** Current NO outcome price (0-1) */
  noPrice: number
  /** Trading volume since last point */
  volume: number
  /** Total liquidity in the market */
  liquidity: number
}

/**
 * Seed data for initializing history when API data is unavailable.
 */
interface SeedSnapshot {
  /** Initial YES shares */
  yesShares?: number
  /** Initial NO shares */
  noShares?: number
  /** Initial liquidity */
  liquidity?: number
}

/**
 * Options for configuring prediction history loading.
 */
interface UsePredictionHistoryOptions {
  /** Maximum number of history points to keep (default: 200) */
  limit?: number
  /** Seed data to use if API fails or returns no data */
  seed?: SeedSnapshot
}

interface HistoryApiPoint {
  yesPrice: number
  noPrice: number
  liquidity?: number
  timestamp: string
}

/**
 * Hook for fetching and managing prediction market price history.
 *
 * Loads historical price data from the API and maintains a rolling window
 * of price points. Automatically appends new points from real-time SSE
 * updates. Falls back to seed data if API fails or returns no data.
 *
 * @param marketId - The ID of the prediction market, or null to clear history
 * @param options - Configuration options including limit and seed data
 *
 * @returns An object containing:
 * - `history`: Array of price history points
 * - `loading`: Whether history is currently loading
 * - `error`: Any error that occurred while loading
 * - `refresh`: Function to manually reload history
 *
 * @example
 * ```tsx
 * const { history, loading } = usePredictionHistory(marketId, { limit: 100 });
 *
 * // Use history for charting
 * const chartData = history.map(point => ({
 *   x: point.time,
 *   y: point.yesPrice
 * }));
 * ```
 */
export function usePredictionHistory(
  marketId: string | null,
  options?: UsePredictionHistoryOptions,
) {
  const limit = options?.limit ?? 100
  const seedRef = useRef<SeedSnapshot | undefined>(options?.seed)
  const queryClient = useQueryClient()

  // Local state for SSE-updated history
  const [localHistory, setLocalHistory] = useState<PredictionHistoryPoint[]>([])

  // Keep seed ref in sync with options
  useEffect(() => {
    seedRef.current = options?.seed
  }, [
    options?.seed?.yesShares,
    options?.seed?.noShares,
    options?.seed?.liquidity,
    options?.seed,
  ])

  // If seed arrives after an empty load, ensure we render a minimal chart.
  useEffect(() => {
    const seed = options?.seed
    if (!marketId || !seed) return
    if (localHistory.length > 0) return
    const yesShares = seed.yesShares ?? 0
    const noShares = seed.noShares ?? 0
    const totalShares = yesShares + noShares
    const yesPrice = totalShares === 0 ? 0.5 : yesShares / totalShares
    const now = Date.now()
    setLocalHistory([
      {
        time: now - 60_000,
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: 0,
        liquidity: seed.liquidity ?? 0,
      },
      {
        time: now,
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: 0,
        liquidity: seed.liquidity ?? 0,
      },
    ])
  }, [marketId, options?.seed, localHistory.length])

  /**
   * Transform API response to history point format.
   * Calculates volume from liquidity changes.
   */
  const formatHistory = useCallback(
    (points: HistoryApiPoint[]): PredictionHistoryPoint[] => {
      let prevLiquidity: number | null = null
      return points.map((point) => {
        const liquidity = Number(point.liquidity ?? prevLiquidity ?? 0)
        const volume =
          prevLiquidity === null
            ? 0
            : Math.max(0, Math.abs(liquidity - prevLiquidity))
        prevLiquidity = liquidity
        return {
          time: new Date(point.timestamp).getTime(),
          yesPrice: point.yesPrice,
          noPrice: point.noPrice,
          volume,
          liquidity,
        }
      })
    },
    [],
  )

  const fallbackFromSeed = useCallback((): PredictionHistoryPoint[] => {
    const seed = seedRef.current
    if (!seed) return []
    const yesShares = seed.yesShares ?? 0
    const noShares = seed.noShares ?? 0
    const totalShares = yesShares + noShares
    const yesPrice = totalShares === 0 ? 0.5 : yesShares / totalShares
    const now = Date.now()
    return [
      {
        time: now - 60_000,
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: 0,
        liquidity: seed.liquidity ?? 0,
      },
      {
        time: now,
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: 0,
        liquidity: seed.liquidity ?? 0,
      },
    ]
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['predictionHistory', marketId, limit],
    queryFn: async (): Promise<PredictionHistoryPoint[]> => {
      const response = await fetch(
        `/api/markets/predictions/${marketId}/history?limit=${limit}`,
      )
      const json = await response.json()
      const responseData = PredictionHistoryApiResponseSchema.parse(json)

      if (
        response.ok &&
        Array.isArray(responseData.history) &&
        responseData.history.length > 0
      ) {
        return formatHistory(responseData.history as HistoryApiPoint[])
      }
      return fallbackFromSeed()
    },
    enabled: !!marketId,
    staleTime: 30000,
  })

  // Sync query data to local state when it changes
  useEffect(() => {
    if (data) {
      setLocalHistory(data)
    }
  }, [data])

  // Clear history when marketId changes to null
  useEffect(() => {
    if (!marketId) {
      setLocalHistory([])
    }
  }, [marketId])

  /**
   * Append a new price point to the history.
   * Maintains the rolling window by removing oldest points when limit exceeded.
   */
  const appendPoint = useCallback(
    (
      yesPrice: number,
      noPrice: number,
      liquidity: number | undefined,
      timestamp: number,
    ) => {
      setLocalHistory((prev) => {
        const lastPoint = prev.length > 0 ? prev[prev.length - 1] : null
        const normalizedLiquidity = Number.isFinite(liquidity)
          ? Number(liquidity)
          : (lastPoint?.liquidity ?? 0)
        const lastLiquidity = lastPoint?.liquidity ?? normalizedLiquidity
        const volume = Math.max(
          0,
          Math.abs(normalizedLiquidity - lastLiquidity),
        )
        const point: PredictionHistoryPoint = {
          time: timestamp,
          yesPrice,
          noPrice,
          volume,
          liquidity: normalizedLiquidity,
        }
        const next = [...prev, point]
        if (next.length > limit) {
          next.shift()
        }
        return next
      })
    },
    [limit],
  )

  // Subscribe to real-time updates via SSE
  usePredictionMarketStream(marketId, {
    onTrade: (event) => {
      const timestamp = new Date(
        event.trade.timestamp ?? new Date().toISOString(),
      ).getTime()
      appendPoint(event.yesPrice, event.noPrice, event.liquidity, timestamp)
    },
    onResolution: (event) => {
      const timestamp = new Date(event.timestamp).getTime()
      appendPoint(event.yesPrice, event.noPrice, event.liquidity, timestamp)
    },
  })

  const refresh = useCallback(() => {
    if (marketId) {
      void queryClient.invalidateQueries({
        queryKey: ['predictionHistory', marketId, limit],
      })
    }
  }, [queryClient, marketId, limit])

  return {
    history: localHistory,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh,
  }
}
