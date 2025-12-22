import { useCallback } from 'react';

/**
 * Parameters for opening a perpetual position.
 */
interface OpenPositionParams {
  /** Ticker symbol of the market */
  ticker: string;
  /** Trade side: long or short */
  side: 'long' | 'short';
  /** Position size in USD */
  size: number;
  /** Leverage multiplier */
  leverage: number;
}

/**
 * Response from opening a perpetual position.
 */
interface OpenPositionResponse {
  /** Created position ID */
  positionId: string;
  /** Entry price */
  entryPrice: number;
  /** Margin required */
  margin: number;
  /** Trading fee charged */
  fee: number;
}

/**
 * Response from closing a perpetual position.
 */
interface ClosePositionResponse {
  /** Realized PnL from the position */
  pnl?: number;
  /** Alternative field for realized PnL */
  realizedPnL?: number;
  /** Exit price */
  exitPrice: number;
  /** Fee charged for closing */
  fee: number;
}

/**
 * Options for the usePerpTrade hook.
 */
interface UsePerpTradeOptions {
  /** Function to get access token for authenticated requests */
  getAccessToken: () => Promise<string | null>;
}

/**
 * Hook for executing perpetual trades (open/close positions).
 *
 * Provides functions to open new perpetual positions and close existing ones.
 * Handles authentication and error handling.
 *
 * @param options - Hook options including auth token getter
 * @returns Object with openPosition and closePosition functions
 *
 * @example
 * ```tsx
 * const { openPosition, closePosition } = usePerpTrade({ getAccessToken });
 *
 * // Open a long position
 * await openPosition({
 *   ticker: 'TRUMP',
 *   side: 'long',
 *   size: 100,
 *   leverage: 10,
 * });
 *
 * // Close a position
 * await closePosition('position-id');
 * ```
 */
export function usePerpTrade({ getAccessToken }: UsePerpTradeOptions) {
  const openPosition = useCallback(
    async (params: OpenPositionParams): Promise<OpenPositionResponse> => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/markets/perps/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const data: { error?: string } = await response.json();
        throw new Error(data.error ?? 'Failed to open position');
      }

      return response.json() as Promise<OpenPositionResponse>;
    },
    [getAccessToken]
  );

  const closePosition = useCallback(
    async (positionId: string): Promise<ClosePositionResponse> => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `/api/markets/perps/positions/${positionId}/close`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data: { error?: string } = await response.json();
        throw new Error(data.error ?? 'Failed to close position');
      }

      return response.json() as Promise<ClosePositionResponse>;
    },
    [getAccessToken]
  );

  return {
    openPosition,
    closePosition,
  };
}
