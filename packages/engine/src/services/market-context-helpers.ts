import type { PerpMarketRecord } from '@babylon/core/markets/perps';
import {
  type PredictionMarketRecord,
  PredictionPricing,
} from '@babylon/core/markets/prediction';
import type {
  PerpMarketSnapshot,
  PredictionMarketSnapshot,
} from '../types/market-context';

export const MAX_MARKET_QUESTION_LENGTH = 120;

function truncateQuestion(question: string): string {
  return question.length > MAX_MARKET_QUESTION_LENGTH
    ? question.slice(0, MAX_MARKET_QUESTION_LENGTH) + '...'
    : question;
}

export function buildPerpMarketSnapshot(
  market: PerpMarketRecord
): PerpMarketSnapshot {
  return {
    ticker: market.ticker,
    organizationId: market.organizationId,
    name: market.name ?? market.ticker,
    currentPrice: market.currentPrice,
    change24h: market.change24h,
    changePercent24h: market.changePercent24h,
    high24h: market.high24h,
    low24h: market.low24h,
    volume24h: market.volume24h,
    openInterest: market.openInterest,
  };
}

export function buildPredictionMarketSnapshot(
  market: Pick<
    PredictionMarketRecord,
    'id' | 'question' | 'yesShares' | 'noShares' | 'liquidity' | 'endDate'
  >,
  now: Date = new Date()
): PredictionMarketSnapshot {
  const yesPrice =
    PredictionPricing.getCurrentPrice(
      market.yesShares,
      market.noShares,
      'yes'
    ) * 100;
  const noPrice =
    PredictionPricing.getCurrentPrice(market.yesShares, market.noShares, 'no') *
    100;
  const daysUntilResolution = Math.max(
    0,
    Math.ceil(
      (market.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  return {
    id: market.id,
    text: truncateQuestion(market.question),
    yesPrice,
    noPrice,
    // Liquidity is the most stable canonical depth metric we currently have.
    totalVolume: market.liquidity,
    resolutionDate: market.endDate.toISOString(),
    daysUntilResolution,
  };
}
