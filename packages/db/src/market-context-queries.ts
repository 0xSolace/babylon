/**
 * Reads for `MarketContextService` (NPC trading / feed / group / market snapshots).
 *
 * **Why here:** Keeps batched actor, chat, position, post, event, and market SQL
 * under `asSystem`.
 */

import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { asSystem } from './db';
import { listAllOrganizationStatesAsSystem } from './organization-price-queries';
import { actorRelationships } from './tables/actor-relationships';
import { actorState } from './tables/actor-state';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { markets } from './tables/markets';
import { messages } from './tables/messages';
import { poolPositions } from './tables/pool-positions';
import { posts } from './tables/posts';
import { stockPrices } from './tables/stock-prices';
import { worldEvents } from './tables/world-events';

export type MarketContextPoolPositionSlice = {
  id: string;
  poolId: string;
  marketType: string;
  ticker: string | null;
  marketId: string | null;
  side: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  shares: number | null;
  unrealizedPnL: number;
  openedAt: Date;
};

const poolPositionCols = {
  id: poolPositions.id,
  poolId: poolPositions.poolId,
  marketType: poolPositions.marketType,
  ticker: poolPositions.ticker,
  marketId: poolPositions.marketId,
  side: poolPositions.side,
  entryPrice: poolPositions.entryPrice,
  currentPrice: poolPositions.currentPrice,
  size: poolPositions.size,
  shares: poolPositions.shares,
  unrealizedPnL: poolPositions.unrealizedPnL,
  openedAt: poolPositions.openedAt,
} as const;

export async function listAllActorStatesForMarketContext() {
  return asSystem(
    async (c) => c.select().from(actorState),
    'market-context-all-actor-states'
  );
}

export async function fetchActorStateByIdForMarketContext(actorId: string) {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(actorState)
      .where(eq(actorState.id, actorId))
      .limit(1);
    return row ?? null;
  }, 'market-context-actor-state-by-id');
}

export async function listAllOrganizationStatesForMarketContext() {
  return listAllOrganizationStatesAsSystem();
}

export async function listGroupChatsIdNameForMarketContext() {
  return asSystem(
    async (c) =>
      c
        .select({
          id: chats.id,
          name: chats.name,
        })
        .from(chats)
        .where(eq(chats.isGroup, true)),
    'market-context-group-chats'
  );
}

export async function listGroupChatMessagesForChatIdsOrderedDesc(params: {
  chatIds: string[];
  limit: number;
}) {
  if (params.chatIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select()
        .from(messages)
        .where(inArray(messages.chatId, params.chatIds))
        .orderBy(desc(messages.createdAt))
        .limit(params.limit),
    'market-context-group-messages'
  );
}

export async function listActorRelationshipsForNpcIds(npcIds: string[]) {
  if (npcIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(
          or(
            inArray(actorRelationships.actor1Id, npcIds),
            inArray(actorRelationships.actor2Id, npcIds)
          )
        ),
    'market-context-npc-relationships'
  );
}

export async function listOpenPoolPositionsForPoolIds(
  poolIds: string[]
): Promise<MarketContextPoolPositionSlice[]> {
  if (poolIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select(poolPositionCols)
        .from(poolPositions)
        .where(
          and(
            inArray(poolPositions.poolId, poolIds),
            isNull(poolPositions.closedAt)
          )
        ),
    'market-context-npc-positions'
  );
}

export async function listOpenPoolPositionsForNpc(
  npcId: string
): Promise<MarketContextPoolPositionSlice[]> {
  return asSystem(
    async (c) =>
      c
        .select(poolPositionCols)
        .from(poolPositions)
        .where(
          and(eq(poolPositions.poolId, npcId), isNull(poolPositions.closedAt))
        ),
    'market-context-single-npc-positions'
  );
}

export async function listActorRelationshipsForSingleNpc(npcId: string) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(
          or(
            eq(actorRelationships.actor1Id, npcId),
            eq(actorRelationships.actor2Id, npcId)
          )
        ),
    'market-context-relationships-for-npc'
  );
}

export async function listInsiderParticipantChatIdsForUser(userId: string) {
  return asSystem(
    async (c) =>
      c
        .select({ chatId: chatParticipants.chatId })
        .from(chatParticipants)
        .where(eq(chatParticipants.userId, userId)),
    'market-context-insider-participants'
  );
}

export async function listGroupChatsByIdsForInsider(chatIds: string[]) {
  if (chatIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select()
        .from(chats)
        .where(and(eq(chats.isGroup, true), inArray(chats.id, chatIds))),
    'market-context-insider-chats'
  );
}

export async function listMessagesForChatOrderedDescLimit(params: {
  chatId: string;
  limit: number;
}) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(messages)
        .where(eq(messages.chatId, params.chatId))
        .orderBy(desc(messages.createdAt))
        .limit(params.limit),
    'market-context-insider-messages'
  );
}

export async function listRecentFeedPostsForMarketContext(params: {
  now: Date;
  limit: number;
}) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(posts)
        .where(and(isNull(posts.deletedAt), lte(posts.timestamp, params.now)))
        .orderBy(desc(posts.timestamp))
        .limit(params.limit),
    'market-context-recent-feed'
  );
}

export async function listRecentWorldEventsForMarketContext(params: {
  now: Date;
  limit: number;
}) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(worldEvents)
        .where(lte(worldEvents.timestamp, params.now))
        .orderBy(desc(worldEvents.timestamp))
        .limit(params.limit),
    'market-context-recent-events'
  );
}

export async function listWorldEventsForNpcPersonalContext(params: {
  now: Date;
  sinceInclusive: Date;
  limit: number;
}) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(worldEvents)
        .where(
          and(
            lte(worldEvents.timestamp, params.now),
            gte(worldEvents.timestamp, params.sinceInclusive)
          )
        )
        .orderBy(desc(worldEvents.timestamp))
        .limit(params.limit),
    'market-context-events-for-npc'
  );
}

export async function listRecentPostsByNpcForMarketContext(params: {
  npcId: string;
  now: Date;
  sinceInclusive: Date;
  limit: number;
}) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.authorId, params.npcId),
            gte(posts.timestamp, params.sinceInclusive),
            lte(posts.timestamp, params.now),
            isNull(posts.deletedAt)
          )
        )
        .orderBy(desc(posts.timestamp))
        .limit(params.limit),
    'market-context-npc-recent-posts'
  );
}

export async function fetchPerpPriceHistoryAndOpenPositionsForOrg(params: {
  organizationId: string;
  /** `PoolPosition.ticker` is matched to org id in engine perps snapshot logic. */
  poolTickerEq: string;
  sinceInclusive: Date;
}): Promise<{
  priceHistory: (typeof stockPrices.$inferSelect)[];
  openPositions: { size: number }[];
}> {
  return asSystem(async (c) => {
    const ph = await c
      .select()
      .from(stockPrices)
      .where(
        and(
          eq(stockPrices.organizationId, params.organizationId),
          gte(stockPrices.timestamp, params.sinceInclusive)
        )
      )
      .orderBy(asc(stockPrices.timestamp));
    const pos = await c
      .select({ size: poolPositions.size })
      .from(poolPositions)
      .where(
        and(
          eq(poolPositions.ticker, params.poolTickerEq),
          isNull(poolPositions.closedAt)
        )
      );
    return { priceHistory: ph, openPositions: pos };
  }, 'market-context-perp-price-and-positions');
}

export async function listTopUnresolvedPredictionMarketsForMarketContext(params: {
  now: Date;
  limit: number;
}) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(markets)
        .where(
          and(eq(markets.resolved, false), gte(markets.endDate, params.now))
        )
        .orderBy(desc(markets.yesShares))
        .limit(params.limit),
    'market-context-prediction-snapshots'
  );
}

export async function fetchMarketQuestionNumberAliasByMarketId(
  marketId: string
) {
  return asSystem(
    async (c) =>
      c
        .select({ questionNumber: markets.id })
        .from(markets)
        .where(eq(markets.id, marketId))
        .limit(1),
    'market-context-signal-question-lookup'
  );
}
