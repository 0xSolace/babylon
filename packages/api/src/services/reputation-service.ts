/**
 * Reputation Service
 *
 * Tracks prediction market outcomes in the local database.
 * Winners get +10 reputation points, losers get -5.
 *
 * On-chain reputation tracking via Base Sepolia contracts has been removed.
 * Reputation is now purely database-driven, with optional Agent0 feedback
 * propagation handled by the ReputationBridge in @babylon/agents.
 */

import {
  applyReputationUpdatesForResolvedMarket,
  fetchUserReputationPointsRow,
  type ReputationResolvedMarketUpdate,
} from '@babylon/db';

interface MarketResolution {
  marketId: string;
  outcome: boolean;
}

type ReputationUpdate = ReputationResolvedMarketUpdate;

export class ReputationService {
  static async updateReputationForResolvedMarket(
    resolution: MarketResolution
  ): Promise<ReputationUpdate[]> {
    return applyReputationUpdatesForResolvedMarket(
      resolution,
      'reputation-update-resolved-market'
    );
  }

  static async getOnChainReputation(userId: string): Promise<number | null> {
    const row = await fetchUserReputationPointsRow(
      userId,
      'reputation-get-user'
    );
    if (!row) return null;
    return row.reputationPoints ?? null;
  }

  static async syncUserReputation(userId: string): Promise<number | null> {
    return ReputationService.getOnChainReputation(userId);
  }

  static async batchUpdateReputation(
    resolutions: MarketResolution[]
  ): Promise<Record<string, ReputationUpdate[]>> {
    const allResults: Record<string, ReputationUpdate[]> = {};

    for (const resolution of resolutions) {
      const results =
        await ReputationService.updateReputationForResolvedMarket(resolution);
      allResults[resolution.marketId] = results;
    }

    return allResults;
  }
}
