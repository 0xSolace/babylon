/**
 * Total Points Service
 *
 * Manages the `totalPoints` column on the User table.
 * totalPoints = wallet + positions + reputation.
 *
 * **WHY identifier routing on `markDirty` / `recomputeTotalPoints`?**
 * Hot paths used `OR` across `id` and `privyId`, which hurt index use and showed up as very slow UPDATEs (e.g. `totalPointsDirtyAt`).
 * We classify with `resolveUserIdentifierKind` from `@babylon/shared` and issue a single `WHERE` (PK, unique privyId, or `lower(username)` for usernames).
 *
 * **WHY not keep OR “for simplicity”?** One indexed predicate per query is simpler for Postgres than OR across columns; classification cost is microseconds.
 *
 * Further detail: `packages/engine/src/services/TOTAL_POINTS_OPTIMIZATION.md`.
 */

import { isOpenPerpPositionStateValid } from '@babylon/core/markets/perps';
import { PredictionPricing } from '@babylon/core/markets/prediction';
import {
  bulkBackfillTotalPointsFromBalance,
  clearUserTotalPointsDirtyIfBefore,
  listDirtyTotalPointsUserIdsBatch,
  markUserTotalPointsDirty,
  markZeroTotalPointsDirtyBatch,
  runTotalPointsRecomputeTransaction,
  snapshotTotalPointsUserBatch,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import { FEE_CONFIG } from '../config/fees';
import { calculatePerpPositionMarketValue } from '../portfolio-valuation';

// ---------------------------------------------------------------------------
// Helpers (mirrored from portfolio-breakdown.ts)
// ---------------------------------------------------------------------------

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function clampFeeRate(rate: number): number {
  return rate > 0 && rate < 1 ? rate : 0;
}

function calculatePredictionPositionValue(position: {
  shares: unknown;
  avgPrice: unknown;
  side: boolean | null;
  marketYesShares: unknown;
  marketNoShares: unknown;
}): number {
  const shares = toNumber(position.shares);
  const avgPrice = toNumber(position.avgPrice);

  const yesShares = toNumber(position.marketYesShares);
  const noShares = toNumber(position.marketNoShares);

  const feeRate = clampFeeRate(FEE_CONFIG.TRADING_FEE_RATE);
  const costBasisNet = shares * avgPrice;
  const costBasis = feeRate > 0 ? costBasisNet / (1 - feeRate) : costBasisNet;

  if (shares <= 0 || yesShares <= 0 || noShares <= 0) {
    return costBasis;
  }

  const sideKey = position.side ? 'yes' : 'no';
  try {
    const sellPreview = PredictionPricing.calculateSellWithFees(
      yesShares,
      noShares,
      sideKey,
      shares,
      feeRate
    );
    return sellPreview.netProceeds ?? sellPreview.totalCost;
  } catch {
    // Fall back to cost basis when sell preview fails (e.g. negative proceeds)
    return costBasis;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * When true, batch operations (backfill, self-heal, snapshots) are scoped to
 * active Whitelist entries only. Set POINTS_WHITELIST_ONLY=false (or remove it)
 * to process ALL users (for open registration).
 *
 * Per-user operations (recomputeTotalPoints, markDirty, recomputeDirtyUsers)
 * are always unscoped — they only touch users explicitly flagged dirty.
 */
function isWhitelistOnly(): boolean {
  return process.env.POINTS_WHITELIST_ONLY !== 'false';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const TotalPointsService = {
  /**
   * Recompute totalPoints for a single user.
   * totalPoints = wallet + open positions + reputationPoints.
   * Only the user's own positions are included (not agent positions).
   *
   * @description Recomputes total points by summing wallet balance, positions,
   * and reputation points. This function uses classification-based routing to
   * eliminate OR conditions in the database query.
   *
   * **WHY classification-based routing?**
   * - Original query used `or(eq(users.id, userId), eq(users.privyId, userId))`
   * - OR conditions prevent optimal index usage, causing sequential scans
   * - Classification routes to single indexed query (PK or unique index)
   * - Performance improvement: Single indexed query is faster than OR condition
   *
   * @param {string} userId - User identifier (UUID, snowflake ID, privyId, or username)
   * @returns {Promise<number>} The recomputed total points value
   */
  async recomputeTotalPoints(userId: string): Promise<number> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      logger.warn(
        'recomputeTotalPoints: empty user identifier',
        { userId },
        'TotalPointsService'
      );
      return 0;
    }

    const result = await runTotalPointsRecomputeTransaction(
      normalizedUserId,
      ({ user, perpRows, predictionRows }) => {
        const wallet = toNumber(user.virtualBalance);
        const reputation = user.reputationPoints;

        const invalidPerpRows = perpRows.filter(
          (position) => !isOpenPerpPositionStateValid(position)
        );
        if (invalidPerpRows.length > 0) {
          logger.warn(
            'Excluding invalid open perp positions from total points calculation',
            {
              userId: user.id,
              invalidPerpPositions: invalidPerpRows.length,
            },
            'TotalPointsService'
          );
        }

        const perpsValue = perpRows.reduce(
          (sum, p) => sum + calculatePerpPositionMarketValue(p),
          0
        );

        const predictionsValue = predictionRows.reduce(
          (sum, p) =>
            sum +
            calculatePredictionPositionValue({
              shares: p.shares,
              avgPrice: p.avgPrice,
              side: p.side,
              marketYesShares: p.marketYesShares,
              marketNoShares: p.marketNoShares,
            }),
          0
        );

        return wallet + perpsValue + predictionsValue + reputation;
      }
    );

    if (!result.userFound) {
      logger.warn(
        'recomputeTotalPoints: user not found',
        { userId },
        'TotalPointsService'
      );
      return 0;
    }

    return result.totalPoints;
  },

  /**
   * Mark a user's totalPoints as dirty (needing recompute).
   * Called instead of immediate recompute on balance/position changes.
   *
   * @description Marks the user's totalPointsDirtyAt timestamp to trigger
   * recomputation of total points. This function uses classification-based
   * routing to eliminate OR conditions in the database query.
   *
   * **WHY classification-based routing?**
   * - Original query used `or(eq(users.id, userId), eq(users.privyId, userId))`
   * - OR conditions prevent optimal index usage, causing sequential scans
   * - Classification routes to single indexed query (PK or unique index)
   * - Performance improvement: 930.9ms average → <50ms average (95%+ reduction)
   *
   * @param {string} userId - User identifier (UUID, snowflake ID, privyId, or username)
   * @returns {Promise<void>} Resolves when dirty flag is set
   */
  async markDirty(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      logger.warn(
        'markDirty: empty user identifier',
        { userId },
        'TotalPointsService'
      );
      return;
    }

    await markUserTotalPointsDirty(normalizedUserId);
  },

  /**
   * Backfill helper: mark users with totalPoints=0 as dirty, so the cron can
   * recompute them incrementally.
   * When POINTS_WHITELIST_ONLY !== 'false', scoped to active whitelist entries.
   */
  async markZeroTotalPointsDirty(batchSize = 5000): Promise<number> {
    const safeBatchSize = Math.min(Math.max(1, batchSize), 10_000);
    return markZeroTotalPointsDirtyBatch({
      batchSize: safeBatchSize,
      whitelistOnly: isWhitelistOnly(),
    });
  },

  /**
   * Snapshot users' current totalPoints into the userPointsSnapshots table.
   * When POINTS_WHITELIST_ONLY !== 'false', scoped to active whitelist entries.
   */
  async snapshotAllUsers(): Promise<number> {
    const now = new Date();
    const BATCH_SIZE = 500;
    let processed = 0;
    let lastId: string | null = null;
    const wlOnly = isWhitelistOnly();

    while (true) {
      const batch = await snapshotTotalPointsUserBatch({
        whitelistOnly: wlOnly,
        lastId,
        batchSize: BATCH_SIZE,
        snapshotDate: now,
      });

      if (batch.count === 0) break;

      processed += batch.count;
      lastId = batch.lastUserId;

      if (batch.count < BATCH_SIZE) break;
    }

    return processed;
  },

  /**
   * Recompute totalPoints only for users marked dirty.
   * Called by the 15-min cron job for incremental updates.
   * Uses cursor-based pagination to avoid loading unbounded rows into memory.
   */
  async recomputeDirtyUsers(): Promise<number> {
    const cutoff = new Date();
    const BATCH_SIZE = 100;
    let processed = 0;
    let lastId: string | null = null;

    while (true) {
      const batch = await listDirtyTotalPointsUserIdsBatch({
        lastId,
        batchSize: BATCH_SIZE,
      });

      if (batch.length === 0) break;

      await Promise.all(
        batch.map(async (user) => {
          try {
            await TotalPointsService.recomputeTotalPoints(user.id);
          } catch (error) {
            logger.error(
              'Failed to recompute totalPoints for user',
              {
                userId: user.id,
                error: error instanceof Error ? error.message : String(error),
              },
              'TotalPointsService'
            );
          }
          await clearUserTotalPointsDirtyIfBefore({
            userId: user.id,
            cutoff,
          });
        })
      );

      processed += batch.length;
      const lastUser = batch[batch.length - 1];
      if (lastUser) lastId = lastUser.id;

      if (batch.length < BATCH_SIZE) break;
    }

    return processed;
  },

  /**
   * Bulk backfill: set totalPoints = virtualBalance + reputationPoints for
   * users with totalPoints = 0.
   * When POINTS_WHITELIST_ONLY !== 'false', scoped to active whitelist entries.
   * Also marks backfilled users as dirty so the cron can add position values.
   */
  async bulkBackfillFromBalance(): Promise<number> {
    const wlOnly = isWhitelistOnly();
    const count = await bulkBackfillTotalPointsFromBalance({
      whitelistOnly: wlOnly,
    });

    logger.info(
      `Bulk backfilled totalPoints from virtualBalance for ${count} users (whitelistOnly=${wlOnly})`,
      { count, whitelistOnly: wlOnly },
      'TotalPointsService'
    );
    return count;
  },
};
