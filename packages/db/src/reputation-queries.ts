/**
 * Engine reputation adjustments after prediction market resolution.
 *
 * **Why here:** Position scan + user updates with `sql` GREATEST live in `@babylon/db`;
 * callers map results for logging only.
 */

import { logger } from '@babylon/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import { asSystem } from './db';
import { positions } from './tables/positions';
import { users } from './tables/user';

export type ReputationResolvedMarketUpdate = {
  userId: string;
  tokenId: number;
  change: number;
  txHash?: string;
  error?: string;
};

export async function applyReputationUpdatesForResolvedMarket(
  resolution: {
    marketId: string;
    outcome: boolean;
  },
  traceLabel = 'engine-reputation-update-resolved-market'
): Promise<ReputationResolvedMarketUpdate[]> {
  return asSystem(async (c) => {
    const results: ReputationResolvedMarketUpdate[] = [];

    const positionsData = await c
      .select({
        id: positions.id,
        userId: positions.userId,
        side: positions.side,
        shares: positions.shares,
      })
      .from(positions)
      .where(eq(positions.marketId, resolution.marketId));

    if (positionsData.length === 0) {
      logger.info(
        `No positions found for market ${resolution.marketId}`,
        undefined,
        'ReputationService'
      );
      return [];
    }

    const userIds = [...new Set(positionsData.map((p) => p.userId))];
    const usersData = await c
      .select({
        id: users.id,
        agent0TokenId: users.agent0TokenId,
        nftTokenId: users.nftTokenId,
        onChainRegistered: users.onChainRegistered,
        reputationPoints: users.reputationPoints,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    const userMap = new Map(usersData.map((u) => [u.id, u]));

    logger.info(
      `Updating reputation for ${positionsData.length} positions in market ${resolution.marketId}`,
      { count: positionsData.length, marketId: resolution.marketId },
      'ReputationService'
    );

    for (const position of positionsData) {
      const user = userMap.get(position.userId);
      if (!user) {
        results.push({
          userId: position.userId,
          tokenId: 0,
          change: 0,
          error: 'User not found',
        });
        continue;
      }

      const tokenId = user.agent0TokenId ?? user.nftTokenId ?? 0;
      const isWinner = position.side === resolution.outcome;
      const change = isWinner ? 10 : -5;

      const [updated] = await c
        .update(users)
        .set({
          reputationPoints: sql`GREATEST(0, COALESCE(${users.reputationPoints}, 0) + ${change})`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, position.userId))
        .returning({ reputationPoints: users.reputationPoints });

      results.push({
        userId: position.userId,
        tokenId,
        change,
      });

      logger.info(
        `Updated reputation for user ${position.userId}`,
        { tokenId, change, newReputation: updated?.reputationPoints },
        'ReputationService'
      );
    }

    return results;
  }, traceLabel);
}

export async function fetchUserReputationPointsRow(
  userId: string,
  traceLabel = 'engine-reputation-get-user'
): Promise<{ reputationPoints: number; onChainRegistered: boolean } | null> {
  return asSystem(async (c) => {
    const [user] = await c
      .select({
        reputationPoints: users.reputationPoints,
        onChainRegistered: users.onChainRegistered,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  }, traceLabel);
}
