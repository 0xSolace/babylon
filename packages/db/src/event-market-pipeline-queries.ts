/**
 * Organization state reads/writes for `event-market-pipeline` (modifiers + sentiment).
 *
 * **Why here:** Keeps `organizationState` SQL under `asSystem`. JSONB parsing and
 * price math are supplied by the engine via `deps` to avoid `@babylon/db` importing engine.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { asSystem } from './db';
import type { PriceModifier } from './tables/organization-state';
import { organizationState } from './tables/organization-state';

export type OrganizationPipelinePriceSlice = {
  id: string;
  currentPrice: number | null;
  basePrice: number | null;
};

export async function fetchOrganizationStatesForEventPipeline(
  orgIds: string[]
): Promise<OrganizationPipelinePriceSlice[]> {
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
    'event-market-pipeline-apply-event-states'
  );
}

export type AddPriceModifierOutcome =
  | { kind: 'not_found' }
  | { kind: 'success' }
  | { kind: 'conflict' };

export async function runAddPriceModifierOptimisticLock(params: {
  orgId: string;
  modifier: PriceModifier;
  minEffect: number;
  maxEffect: number;
  parseModifiers: (raw: unknown, context: { orgId: string }) => PriceModifier[];
}): Promise<AddPriceModifierOutcome> {
  const { orgId, modifier, minEffect, maxEffect, parseModifiers } = params;
  return asSystem(async (c) => {
    const [state] = await c
      .select({
        activeModifiers: organizationState.activeModifiers,
        updatedAt: organizationState.updatedAt,
      })
      .from(organizationState)
      .where(eq(organizationState.id, orgId))
      .limit(1);

    if (!state) {
      return { kind: 'not_found' as const };
    }

    const now = new Date();
    const existingModifiers = parseModifiers(state.activeModifiers, {
      orgId,
    });

    const validModifiers: PriceModifier[] = existingModifiers
      .filter((m) => new Date(m.expiresAt).getTime() > now.getTime())
      .map((m) => ({
        ...m,
        effect: Math.max(minEffect, Math.min(maxEffect, m.effect)),
      }));

    validModifiers.push(modifier);

    const result = await c
      .update(organizationState)
      .set({
        activeModifiers: validModifiers,
        updatedAt: now,
      })
      .where(
        and(
          eq(organizationState.id, orgId),
          eq(organizationState.updatedAt, state.updatedAt)
        )
      )
      .returning({ id: organizationState.id });

    return {
      kind: result.length > 0 ? ('success' as const) : ('conflict' as const),
    };
  }, 'event-market-pipeline-add-modifier');
}

export type UpdateStockPriceOutcome =
  | { kind: 'missing' }
  | { kind: 'success'; newPrice: number }
  | { kind: 'conflict' };

export async function runUpdateStockPriceOptimisticLock(params: {
  orgId: string;
  minEffect: number;
  maxEffect: number;
  parseModifiers: (raw: unknown, context: { orgId: string }) => PriceModifier[];
  computePrice: (
    basePrice: number,
    sentiment: number,
    modifiers: PriceModifier[],
    rng: () => number
  ) => number;
  rng: () => number;
}): Promise<UpdateStockPriceOutcome> {
  const { orgId, minEffect, maxEffect, parseModifiers, computePrice, rng } =
    params;

  return asSystem(async (c) => {
    const [state] = await c
      .select({
        basePrice: organizationState.basePrice,
        sentiment: organizationState.sentiment,
        activeModifiers: organizationState.activeModifiers,
        updatedAt: organizationState.updatedAt,
      })
      .from(organizationState)
      .where(eq(organizationState.id, orgId))
      .limit(1);

    if (!state || !state.basePrice) {
      return { kind: 'missing' as const };
    }

    const now = new Date();
    const storedModifiers = parseModifiers(state.activeModifiers, {
      orgId,
    });

    const activeModifiers = storedModifiers
      .filter((m) => new Date(m.expiresAt).getTime() > now.getTime())
      .map((m) => ({
        ...m,
        effect: Math.max(minEffect, Math.min(maxEffect, m.effect)),
      }));

    const newPrice = computePrice(
      state.basePrice,
      state.sentiment ?? 0,
      activeModifiers,
      rng
    );

    const result = await c
      .update(organizationState)
      .set({
        currentPrice: newPrice,
        activeModifiers,
        updatedAt: now,
      })
      .where(
        and(
          eq(organizationState.id, orgId),
          eq(organizationState.updatedAt, state.updatedAt)
        )
      )
      .returning({ id: organizationState.id });

    if (result.length > 0) {
      return { kind: 'success' as const, newPrice };
    }

    return { kind: 'conflict' as const };
  }, 'event-market-pipeline-update-price');
}

export type UpdateStockSentimentOutcome =
  | { kind: 'missing'; oldSentiment: number }
  | { kind: 'ok'; oldSentiment: number };

export async function runUpdateStockSentimentAtomic(params: {
  orgId: string;
  sentimentChange: number;
}): Promise<UpdateStockSentimentOutcome> {
  const { orgId, sentimentChange } = params;
  return asSystem(async (c) => {
    const [state] = await c
      .select({
        id: organizationState.id,
        sentiment: organizationState.sentiment,
      })
      .from(organizationState)
      .where(eq(organizationState.id, orgId))
      .limit(1);

    if (!state) {
      return { kind: 'missing' as const, oldSentiment: 0 };
    }

    const oldSentiment = state.sentiment ?? 0;

    await c
      .update(organizationState)
      .set({
        sentiment: sql`GREATEST(-100, LEAST(100, COALESCE(${organizationState.sentiment}, 0) + ${sentimentChange}))`,
        updatedAt: new Date(),
      })
      .where(eq(organizationState.id, orgId));

    return { kind: 'ok' as const, oldSentiment };
  }, 'event-market-pipeline-update-sentiment');
}
