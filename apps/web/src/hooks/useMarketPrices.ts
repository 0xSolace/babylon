'use client';

import { useMemo, useState } from 'react';
import { useSSEChannel } from '@/hooks/useSSE';

/**
 * Market price data structure.
 */
export interface MarketPrice {
  ticker: string;
  price: number;
  change24h?: number;
  change24hPercent?: number;
  volume24h?: number;
  timestamp: number;
}

/**
 * SSE event for perp market price updates.
 */
interface PerpPriceSSE {
  type: 'perp_price';
  ticker: string;
  price: number;
  change24h?: number;
  change24hPercent?: number;
  volume24h?: number;
  timestamp: string;
}

/**
 * Type guard to check if data is a valid perp price SSE payload.
 */
const isPerpPricePayload = (data: unknown): data is PerpPriceSSE => {
  if (!data || typeof data !== 'object' || data === null) return false;
  const type = (data as { type?: string }).type;
  return (
    type === 'perp_price' &&
    typeof (data as { ticker?: string }).ticker === 'string'
  );
};

/**
 * Hook for tracking real-time market prices for perpetual markets.
 *
 * Subscribes to SSE price updates and maintains a Map of ticker -> price data.
 * Automatically filters updates for the specified tickers.
 *
 * @param tickers - Array of ticker symbols to track, or empty array to unsubscribe
 * @returns Map of ticker -> MarketPrice
 *
 * @example
 * ```tsx
 * const prices = useMarketPrices(['AAPL', 'TSLA']);
 * const aaplPrice = prices.get('AAPL')?.price;
 * ```
 */
export function useMarketPrices(tickers: string[]): Map<string, MarketPrice> {
  const [prices, setPrices] = useState<Map<string, MarketPrice>>(new Map());
  const tickerSet = useMemo(() => new Set(tickers), [tickers]);

  useSSEChannel(
    tickers.length > 0 ? 'markets' : null,
    (data: Record<string, unknown>) => {
      if (!isPerpPricePayload(data)) return;
      if (!tickerSet.has(data.ticker)) return;

      setPrices((prev) => {
        const next = new Map(prev);
        next.set(data.ticker, {
          ticker: data.ticker,
          price: data.price,
          change24h: data.change24h,
          change24hPercent: data.change24hPercent,
          volume24h: data.volume24h,
          timestamp: new Date(data.timestamp).getTime(),
        });
        return next;
      });
    }
  );

  return prices;
}
