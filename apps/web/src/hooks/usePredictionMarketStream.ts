import { useSSEChannel } from '@/hooks/useSSE'

/**
 * SSE event for prediction market trades.
 */
export interface PredictionTradeSSE {
  type: 'prediction_trade'
  marketId: string
  yesPrice: number
  noPrice: number
  yesShares: number
  noShares: number
  liquidity?: number
  trade: {
    actorType: 'user' | 'npc' | 'system'
    actorId?: string
    action: 'buy' | 'sell' | 'close'
    side: 'yes' | 'no'
    shares: number
    amount: number
    price: number
    source: 'user_trade' | 'npc_trade' | 'system'
    timestamp: string
  }
}

/**
 * SSE event for prediction market resolution.
 */
export interface PredictionResolutionSSE {
  type: 'prediction_resolution'
  marketId: string
  winningSide: 'yes' | 'no'
  yesPrice: number
  noPrice: number
  yesShares: number
  noShares: number
  liquidity?: number
  totalPayout: number
  timestamp: string
  resolutionProofUrl?: string
  resolutionDescription?: string
}

/**
 * Type guard to check if data is a prediction trade SSE payload.
 */
const isPredictionTrade = (data: unknown): data is PredictionTradeSSE => {
  if (!data || typeof data !== 'object' || data === null) return false
  const dataObj = data as Record<string, unknown>
  return (
    dataObj.type === 'prediction_trade' && typeof dataObj.marketId === 'string'
  )
}

/**
 * Type guard to check if data is a prediction resolution SSE payload.
 */
const isPredictionResolution = (
  data: unknown,
): data is PredictionResolutionSSE => {
  if (!data || typeof data !== 'object' || data === null) return false
  const dataObj = data as Record<string, unknown>
  return (
    dataObj.type === 'prediction_resolution' &&
    typeof dataObj.marketId === 'string'
  )
}

/**
 * Options for configuring prediction market stream subscriptions.
 */
interface UsePredictionMarketStreamOptions {
  /** Callback invoked when a trade event is received */
  onTrade?: (event: PredictionTradeSSE) => void
  /** Callback invoked when a resolution event is received */
  onResolution?: (event: PredictionResolutionSSE) => void
}

/**
 * Hook for subscribing to real-time prediction market updates for a specific market.
 *
 * Subscribes to the 'markets' SSE channel and filters events for the specified
 * market ID. Automatically handles subscription lifecycle and ensures callbacks
 * receive the latest version.
 *
 * @param marketId - The ID of the prediction market to subscribe to, or null to unsubscribe
 * @param options - Callback functions for trade and resolution events
 *
 * @example
 * ```tsx
 * usePredictionMarketStream(marketId, {
 *   onTrade: (event) => {
 *     console.log('Trade:', event.trade);
 *   },
 *   onResolution: (event) => {
 *     console.log('Resolved:', event.winningSide);
 *   }
 * });
 * ```
 */
export function usePredictionMarketStream(
  marketId: string | null,
  { onTrade, onResolution }: UsePredictionMarketStreamOptions = {},
) {
  const normalizedMarketId = marketId

  useSSEChannel(normalizedMarketId ? 'markets' : null, (data) => {
    if (!normalizedMarketId) return

    if (isPredictionTrade(data) && data.marketId === normalizedMarketId) {
      onTrade?.(data)
    } else if (
      isPredictionResolution(data) &&
      data.marketId === normalizedMarketId
    ) {
      onResolution?.(data)
    }
  })
}

/**
 * Hook for subscribing to all prediction market updates across all markets.
 *
 * Similar to usePredictionMarketStream but subscribes to events from all
 * prediction markets, not just a specific one. Useful for dashboards or
 * feeds showing activity across multiple markets.
 *
 * @param options - Callback functions for trade and resolution events
 *
 * @example
 * ```tsx
 * usePredictionMarketsSubscription({
 *   onTrade: (event) => {
 *     console.log('Trade in market:', event.marketId);
 *   }
 * });
 * ```
 */
export function _usePredictionMarketsSubscription({
  onTrade,
  onResolution,
}: UsePredictionMarketStreamOptions = {}) {
  useSSEChannel('markets', (data) => {
    if (isPredictionTrade(data)) {
      onTrade?.(data)
    } else if (isPredictionResolution(data)) {
      onResolution?.(data)
    }
  })
}
