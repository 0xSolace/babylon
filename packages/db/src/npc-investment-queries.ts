/**
 * Reads for `NPCInvestmentManager` (portfolio metrics, baseline allocation, monitoring).
 *
 * **Why here:** actor/pool/perp/org/relationship SQL under **`asSystem`**; sizing,
 * risk scores, and trade execution stay in engine.
 */

import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { asSystem } from './db';
import { actorRelationships } from './tables/actor-relationships';
import { actorState } from './tables/actor-state';
import { organizationState } from './tables/organization-state';
import { perpPositions } from './tables/perp-positions';
import { poolPositions } from './tables/pool-positions';
import { pools } from './tables/pools';

export async function selectNpcActorTradingBalanceForInvestment(
  poolId: string
) {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ tradingBalance: actorState.tradingBalance })
      .from(actorState)
      .where(eq(actorState.id, poolId))
      .limit(1);
    return row;
  }, 'npc-inv-actor-balance');
}

export async function listPoolPositionsByPoolIdForInvestment(poolId: string) {
  return asSystem(
    async (c) =>
      c.select().from(poolPositions).where(eq(poolPositions.poolId, poolId)),
    'npc-inv-pool-positions'
  );
}

export type NpcInvestmentPerpPositionSlice = {
  id: string;
  ticker: string;
  side: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  leverage: number;
  realizedPnL: number | null;
  closedAt: Date | null;
};

export async function listPerpPositionSlicesForNpcUser(
  userId: string
): Promise<NpcInvestmentPerpPositionSlice[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          id: perpPositions.id,
          ticker: perpPositions.ticker,
          side: perpPositions.side,
          size: perpPositions.size,
          entryPrice: perpPositions.entryPrice,
          currentPrice: perpPositions.currentPrice,
          unrealizedPnL: perpPositions.unrealizedPnL,
          leverage: perpPositions.leverage,
          realizedPnL: perpPositions.realizedPnL,
          closedAt: perpPositions.closedAt,
        })
        .from(perpPositions)
        .where(eq(perpPositions.userId, userId)),
    'npc-inv-perp-slices'
  );
}

export async function listActorIdAndTradingBalanceForNpcInvestment() {
  return asSystem(
    async (c) =>
      c
        .select({
          id: actorState.id,
          tradingBalance: actorState.tradingBalance,
        })
        .from(actorState),
    'npc-inv-all-actor-balances'
  );
}

export async function listOpenPredictionPoolIdsForActorIds(actorIds: string[]) {
  if (actorIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({ poolId: poolPositions.poolId })
        .from(poolPositions)
        .where(
          and(
            inArray(poolPositions.poolId, actorIds),
            isNull(poolPositions.closedAt)
          )
        ),
    'npc-inv-open-pred-pool-ids'
  );
}

export async function listOpenPerpUserOrgForActorIds(actorIds: string[]) {
  if (actorIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          userId: perpPositions.userId,
          organizationId: perpPositions.organizationId,
        })
        .from(perpPositions)
        .where(
          and(
            inArray(perpPositions.userId, actorIds),
            isNull(perpPositions.closedAt)
          )
        ),
    'npc-inv-open-perp-user-org'
  );
}

export async function listOrganizationStatesByIdsForNpcInvestment(
  orgIds: string[]
) {
  if (orgIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select()
        .from(organizationState)
        .where(inArray(organizationState.id, orgIds)),
    'npc-inv-org-states-by-ids'
  );
}

export type NpcInvestmentRelationshipSlice = {
  actor1Id: string;
  actor2Id: string;
  sentiment: number;
  strength: number;
};

export async function listActorRelationshipSlicesForNpcInvestment(
  actorIds: string[]
): Promise<NpcInvestmentRelationshipSlice[]> {
  if (actorIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          actor1Id: actorRelationships.actor1Id,
          actor2Id: actorRelationships.actor2Id,
          sentiment: actorRelationships.sentiment,
          strength: actorRelationships.strength,
        })
        .from(actorRelationships)
        .where(
          or(
            inArray(actorRelationships.actor1Id, actorIds),
            inArray(actorRelationships.actor2Id, actorIds)
          )
        ),
    'npc-inv-relationships'
  );
}

export async function listPoolPositionsByPoolIdLeverageDescLimit(
  poolId: string,
  limit: number
) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(poolPositions)
        .where(eq(poolPositions.poolId, poolId))
        .orderBy(desc(poolPositions.leverage))
        .limit(limit),
    'npc-inv-pool-pos-leverage'
  );
}

export async function listOpenPoolPositionsByPoolIdForNpcInvestment(
  poolId: string
) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(poolPositions)
        .where(
          and(eq(poolPositions.poolId, poolId), isNull(poolPositions.closedAt))
        ),
    'npc-inv-open-pool-positions'
  );
}

export async function listActiveNpcPoolsForInvestment() {
  return asSystem(
    async (c) => c.select().from(pools).where(eq(pools.isActive, true)),
    'npc-inv-active-pools'
  );
}
