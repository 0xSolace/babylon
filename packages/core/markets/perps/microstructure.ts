import type { PerpMarketRecord } from './types';

export type SyntheticQuoteSide = 'buy' | 'sell';

export interface SyntheticPerpExecution {
  midPrice: number;
  bidPrice: number;
  askPrice: number;
  spreadBps: number;
  bidDepth: number;
  askDepth: number;
  impactBps: number;
  executionPrice: number;
  nextMidPrice: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeRatio(numerator: number, denominator: number): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0;
  }
  return numerator / denominator;
}

function getBaseDepth(market: PerpMarketRecord): number {
  const minOrderSize = market.minOrderSize ?? 10;
  const baseDepth = 500 + market.openInterest * 0.08 + market.volume24h * 0.02;
  return Math.max(minOrderSize * 10, baseDepth);
}

export function getSyntheticPerpExecutionPrice(params: {
  market: PerpMarketRecord;
  side: SyntheticQuoteSide;
  size: number;
}): SyntheticPerpExecution {
  const { market, side, size } = params;
  const midPrice =
    Number.isFinite(market.currentPrice) && market.currentPrice > 0
      ? market.currentPrice
      : (market.markPrice ?? market.indexPrice ?? 100);

  const indexReference = market.indexPrice ?? market.markPrice ?? midPrice;
  const markReference = market.markPrice ?? market.indexPrice ?? midPrice;

  const changeMagnitude = Math.abs(market.changePercent24h ?? 0);
  const volatilityBps = clamp(changeMagnitude * 3, 0, 120);
  const premiumBps = clamp(
    Math.abs(safeRatio(markReference - indexReference, indexReference)) * 10000,
    0,
    180
  );
  const liquidityBps = clamp(
    45 / Math.sqrt(1 + market.openInterest / 25_000),
    8,
    45
  );

  const spreadBps = clamp(
    12 + volatilityBps + premiumBps * 0.35 + liquidityBps,
    8,
    160
  );
  const halfSpread = (midPrice * spreadBps) / 20_000;

  const bidPrice = Math.max(0.0001, midPrice - halfSpread);
  const askPrice = Math.max(bidPrice, midPrice + halfSpread);

  const imbalanceSignal = clamp(
    safeRatio(markReference - indexReference, indexReference),
    -0.35,
    0.35
  );
  const baseDepth = getBaseDepth(market);
  const bidDepth = Math.max(
    market.minOrderSize ?? 10,
    baseDepth * (1 + imbalanceSignal * 0.45)
  );
  const askDepth = Math.max(
    market.minOrderSize ?? 10,
    baseDepth * (1 - imbalanceSignal * 0.45)
  );

  const sideDepth = side === 'buy' ? askDepth : bidDepth;
  const depthRatio = clamp(size / Math.max(sideDepth, 1), 0, 8);
  const impactBps = clamp(
    6 + spreadBps * 0.12 + depthRatio ** 1.2 * 180,
    0,
    320
  );
  const impactPrice = (midPrice * impactBps) / 10_000;

  const executionPrice =
    side === 'buy'
      ? askPrice + impactPrice
      : Math.max(0.0001, bidPrice - impactPrice);

  const midShiftBps = clamp(impactBps * 0.35, 0, 140);
  const nextMidPrice =
    side === 'buy'
      ? midPrice * (1 + midShiftBps / 10_000)
      : midPrice * (1 - midShiftBps / 10_000);

  return {
    midPrice,
    bidPrice,
    askPrice,
    spreadBps,
    bidDepth,
    askDepth,
    impactBps,
    executionPrice,
    nextMidPrice,
  };
}
