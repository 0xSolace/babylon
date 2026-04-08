/**
 * Organization SQL: spot price (`Organization` + `OrganizationState`) and
 * lightweight reads (e.g. ticker → id for player-influence NPC resolution).
 *
 * **Why here:** Keeps `organizations` / `organizationState` predicates in `@babylon/db`.
 */

import { logger, PERP_MARKET_CONFIG } from '@babylon/shared';
import { eq, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import {
  getOrganizationStateById,
  organizationState,
} from './tables/organization-state';
import { organizations } from './tables/organizations';

export type OrganizationPricePersistResult = {
  clampedNewPrice: number;
  oldPrice: number;
  change: number;
  changePercent: number;
};

export async function persistOrganizationPriceUpdate(params: {
  orgId: string;
  requestedNewPrice: number;
}): Promise<OrganizationPricePersistResult> {
  const { orgId, requestedNewPrice } = params;
  const now = new Date();

  return asSystem(async (c) => {
    const [state] = await c
      .select({
        id: organizationState.id,
        currentPrice: organizationState.currentPrice,
        basePrice: organizationState.basePrice,
      })
      .from(organizationState)
      .where(eq(organizationState.id, orgId))
      .limit(1);

    const [organization] = await c
      .select({
        id: organizations.id,
        currentPrice: organizations.currentPrice,
        initialPrice: organizations.initialPrice,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const resolvedBasePrice = Number(
      state?.basePrice ?? organization?.initialPrice ?? 0
    );
    const hasValidBasePrice =
      Number.isFinite(resolvedBasePrice) && resolvedBasePrice > 0;

    let clampedNewPrice = requestedNewPrice;
    if (!hasValidBasePrice) {
      logger.warn(
        'Missing basePrice for price update, skipping bounds enforcement',
        { orgId, resolvedBasePrice },
        'PriceUpdateService'
      );
    }
    if (hasValidBasePrice) {
      const minPrice = resolvedBasePrice * PERP_MARKET_CONFIG.PRICE_FLOOR_RATIO;
      const maxPrice =
        resolvedBasePrice * PERP_MARKET_CONFIG.PRICE_CEILING_RATIO;
      clampedNewPrice = Math.max(minPrice, Math.min(maxPrice, clampedNewPrice));
    }

    const oldPriceCandidate =
      organization?.currentPrice ??
      state?.currentPrice ??
      state?.basePrice ??
      clampedNewPrice;
    const oldPrice = Number(oldPriceCandidate ?? clampedNewPrice);
    const change = clampedNewPrice - oldPrice;
    const changePercent = oldPrice === 0 ? 0 : (change / oldPrice) * 100;

    if (organization) {
      await c
        .update(organizations)
        .set({ currentPrice: clampedNewPrice, updatedAt: now })
        .where(eq(organizations.id, organization.id));
    }

    await c
      .insert(organizationState)
      .values({
        id: orgId,
        currentPrice: clampedNewPrice,
        basePrice: resolvedBasePrice,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: organizationState.id,
        set: { currentPrice: clampedNewPrice, updatedAt: now },
      });

    return { clampedNewPrice, oldPrice, change, changePercent };
  }, 'price-update-apply');
}

export type OrganizationStatePriceSlice = {
  id: string;
  currentPrice: unknown;
  basePrice: unknown;
};

export async function fetchOrganizationStatePriceSlicesByIds(
  orgIds: string[]
): Promise<OrganizationStatePriceSlice[]> {
  if (orgIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          id: organizationState.id,
          currentPrice: organizationState.currentPrice,
          basePrice: organizationState.basePrice,
        })
        .from(organizationState)
        .where(inArray(organizationState.id, orgIds)),
    'market-correlation-cascade-states'
  );
}

export async function fetchOrganizationIdByTicker(
  ticker: string
): Promise<string | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.ticker, ticker))
      .limit(1);
    return row?.id ?? null;
  }, 'player-influence-org-by-ticker');
}

/** Full `OrganizationState` rows for prompt/market helpers (gainers/losers, snapshots). */
export async function listAllOrganizationStatesAsSystem() {
  return asSystem(
    async (c) => c.select().from(organizationState),
    'org-state-list-all'
  );
}

export async function fetchOrganizationStateRowAsSystem(orgId: string) {
  return asSystem(
    async (c) => getOrganizationStateById(c, orgId),
    'org-state-row-by-id'
  );
}
