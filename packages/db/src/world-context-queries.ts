/**
 * Reads for `prompts/world-context.ts` (markets, questions, recent trades).
 *
 * **Why here:** Prompt wiring stays in engine; `where` / `orderBy` / joins live in
 * `@babylon/db` with `asSystem` for RLS-consistent cron/system reads.
 */

import { desc, eq, sql } from 'drizzle-orm';
import { asSystem } from './db';
import { agentTrades } from './tables/agent-trades';
import { type Market, markets } from './tables/markets';
import { npcTrades } from './tables/npc-trades';
import { organizationState } from './tables/organization-state';
import { type Question, questions } from './tables/questions';
import { users } from './tables/user';

export async function listUnresolvedMarketsTopByYesShares(
  limit: number
): Promise<Market[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(markets)
        .where(eq(markets.resolved, false))
        .orderBy(desc(markets.yesShares))
        .limit(limit),
    'world-context-prediction-markets'
  );
}

export async function listActiveQuestionsByCreatedDesc(
  limit: number
): Promise<Question[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(questions)
        .where(eq(questions.status, 'active'))
        .orderBy(desc(questions.createdAt))
        .limit(limit),
    'world-context-active-questions'
  );
}

export async function listOrganizationStatesByPriceDescForWorldContext() {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(organizationState)
        .orderBy(sql`${organizationState.currentPrice} DESC NULLS LAST`),
    'world-context-org-states-by-price'
  );
}

export type WorldContextNpcTradeSlice = {
  action: string;
  side: string | null;
  amount: unknown;
  price: unknown;
  marketType: string;
  ticker: string | null;
  executedAt: Date;
  npcActorId: string;
};

export type WorldContextAgentTradeSlice = {
  action: string;
  side: string | null;
  amount: unknown;
  price: unknown;
  marketType: string;
  ticker: string | null;
  executedAt: Date;
  displayName: string | null;
  username: string | null;
};

export async function fetchWorldContextRecentTradeSlices(): Promise<{
  rawNpcTrades: WorldContextNpcTradeSlice[];
  agentTradeResults: WorldContextAgentTradeSlice[];
}> {
  return asSystem(async (c) => {
    const rawNpcTrades = await c
      .select({
        action: npcTrades.action,
        side: npcTrades.side,
        amount: npcTrades.amount,
        price: npcTrades.price,
        marketType: npcTrades.marketType,
        ticker: npcTrades.ticker,
        executedAt: npcTrades.executedAt,
        npcActorId: npcTrades.npcActorId,
      })
      .from(npcTrades)
      .orderBy(desc(npcTrades.executedAt))
      .limit(15);

    const agentTradeResults = await c
      .select({
        action: agentTrades.action,
        side: agentTrades.side,
        amount: agentTrades.amount,
        price: agentTrades.price,
        marketType: agentTrades.marketType,
        ticker: agentTrades.ticker,
        executedAt: agentTrades.executedAt,
        displayName: users.displayName,
        username: users.username,
      })
      .from(agentTrades)
      .leftJoin(users, eq(agentTrades.agentUserId, users.id))
      .orderBy(desc(agentTrades.executedAt))
      .limit(15);

    return { rawNpcTrades, agentTradeResults };
  }, 'world-context-recent-trades');
}
