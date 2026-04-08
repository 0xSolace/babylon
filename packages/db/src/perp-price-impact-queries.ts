/**
 * DB reads for perp user-trade price impact (snapshots, org state, open positions).
 *
 * **Why here:** Used from engine and aligned with web/API impact logic; SQL stays in
 * `@babylon/db` under `asSystem` for consistent RLS (background / trade paths).
 */

import { and, eq, isNull } from 'drizzle-orm';
import { asSystem } from './db';
import { organizationState } from './tables/organization-state';
import { perpMarketSnapshots } from './tables/perp-market-snapshots';
import { perpPositions } from './tables/perp-positions';

export type PerpPriceImpactSnapshotRow = {
  organizationId: string;
  currentPrice: number;
};

export type PerpPriceImpactOrgStateRow = {
  id: string;
  currentPrice: number | null;
  basePrice: number;
};

export type PerpPriceImpactOpenPositionRow = {
  side: string;
  size: number;
  leverage: number;
  userId: string;
};

export type PerpPriceImpactReadResult = {
  snapshot: PerpPriceImpactSnapshotRow | null;
  state: PerpPriceImpactOrgStateRow | null;
  openPositions: PerpPriceImpactOpenPositionRow[];
};

export async function fetchPerpPriceImpactReadContext(
  normalizedTickerUpper: string
): Promise<PerpPriceImpactReadResult> {
  return asSystem(async (c) => {
    const [snap] = await c
      .select({
        organizationId: perpMarketSnapshots.organizationId,
        currentPrice: perpMarketSnapshots.currentPrice,
      })
      .from(perpMarketSnapshots)
      .where(eq(perpMarketSnapshots.ticker, normalizedTickerUpper))
      .limit(1);

    if (!snap) {
      return { snapshot: null, state: null, openPositions: [] };
    }

    const [st] = await c
      .select({
        id: organizationState.id,
        currentPrice: organizationState.currentPrice,
        basePrice: organizationState.basePrice,
      })
      .from(organizationState)
      .where(eq(organizationState.id, snap.organizationId))
      .limit(1);

    const positions = await c
      .select({
        side: perpPositions.side,
        size: perpPositions.size,
        leverage: perpPositions.leverage,
        userId: perpPositions.userId,
      })
      .from(perpPositions)
      .where(
        and(
          eq(perpPositions.ticker, normalizedTickerUpper),
          isNull(perpPositions.closedAt)
        )
      );

    return {
      snapshot: snap,
      state: st ?? null,
      openPositions: positions,
    };
  }, 'perp-price-impact-read');
}

export async function fetchPerpBasePriceForTicker(
  normalizedTickerUpper: string
): Promise<number | undefined> {
  return asSystem(async (c) => {
    const [snapshot] = await c
      .select({ organizationId: perpMarketSnapshots.organizationId })
      .from(perpMarketSnapshots)
      .where(eq(perpMarketSnapshots.ticker, normalizedTickerUpper))
      .limit(1);
    if (!snapshot) return undefined;

    const [state] = await c
      .select({ basePrice: organizationState.basePrice })
      .from(organizationState)
      .where(eq(organizationState.id, snapshot.organizationId))
      .limit(1);

    return state ? Number(state.basePrice ?? 100) : undefined;
  }, 'perp-base-price');
}
