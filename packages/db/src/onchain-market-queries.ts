/**
 * Prediction market rows for linking on-chain market IDs.
 *
 * **Why here:** `ensureMarketOnChain` is engine/on-chain glue, but the `Market` SQL
 * belongs in `@babylon/db` for the same RLS and audit story as other query modules.
 */

import { eq } from 'drizzle-orm';
import { asSystem } from './db';
import type { Market } from './tables/markets';
import { markets } from './tables/markets';

export async function fetchMarketRowForOnChainLink(
  marketId: string
): Promise<Market | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);
    return row ?? null;
  }, 'onchain-market-load');
}

export async function updateMarketOnChainLink(params: {
  marketId: string;
  onChainMarketId: string;
  oracleAddress: string | null;
}): Promise<void> {
  await asSystem(
    async (c) =>
      c
        .update(markets)
        .set({
          onChainMarketId: params.onChainMarketId,
          oracleAddress: params.oracleAddress,
        })
        .where(eq(markets.id, params.marketId)),
    'onchain-market-persist-id'
  );
}
