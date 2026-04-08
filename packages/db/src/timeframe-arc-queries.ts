/**
 * `TimeframedMarket` batch reads and arc/event updates for the timeframe processor.
 *
 * **Why here:** Keeps `TimeframedMarket` SQL under `asSystem`; transition rules stay
 * in `TimeframeArcProcessor`.
 */

import { asc, eq } from 'drizzle-orm';
import { asSystem } from './db';
import type { ArcStateType } from './tables/narrative-types';
import type { TimeframedMarket } from './tables/timeframed-markets';
import { timeframedMarkets } from './tables/timeframed-markets';

export async function listActiveTimeframedMarketsPage(params: {
  limit: number;
  offset: number;
}): Promise<TimeframedMarket[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(timeframedMarkets)
        .where(eq(timeframedMarkets.isActive, true))
        .orderBy(asc(timeframedMarkets.id))
        .limit(params.limit)
        .offset(params.offset),
    'timeframe-arc-active-batch'
  );
}

export async function updateTimeframedMarketArcState(params: {
  marketId: string;
  arcState: ArcStateType;
  arcStateEnteredAt: Date;
  updatedAt: Date;
  traceLabel:
    | 'timeframe-arc-state-transition'
    | 'timeframe-arc-resolution-pending';
}): Promise<void> {
  await asSystem(
    async (c) =>
      c
        .update(timeframedMarkets)
        .set({
          arcState: params.arcState,
          arcStateEnteredAt: params.arcStateEnteredAt,
          updatedAt: params.updatedAt,
        })
        .where(eq(timeframedMarkets.id, params.marketId)),
    params.traceLabel
  );
}

export async function updateTimeframedMarketEventStats(params: {
  marketId: string;
  eventsGenerated: number;
  lastEventAt: Date;
  updatedAt: Date;
}): Promise<void> {
  await asSystem(
    async (c) =>
      c
        .update(timeframedMarkets)
        .set({
          eventsGenerated: params.eventsGenerated,
          lastEventAt: params.lastEventAt,
          updatedAt: params.updatedAt,
        })
        .where(eq(timeframedMarkets.id, params.marketId)),
    'timeframe-arc-event-generated'
  );
}
