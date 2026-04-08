/**
 * ERC-8004 Reputation Sync Service
 *
 * Syncs reputation scores and ban status to ERC-8004 via Agent0
 */

import {
  insertAgentPerformanceMetricsReputationRow,
  selectAgentPerformanceMetricsFullRowByUserId,
  selectUserErc8004LocalSyncSliceById,
  selectUsersNotBannedForErc8004Batch,
  updateAgentPerformanceMetricsReputationScoreByUserId,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import { generateSnowflakeId } from '../../shared/snowflake';

interface ReputationSyncData {
  reputationScore: number;
  isBanned: boolean;
  isScammer: boolean;
  isCSAM: boolean;
}

/**
 * Sync SYSTEM-LEVEL reputation to local metrics
 *
 * This syncs system-calculated reputation (bans, flags, activity scores) to local database.
 * This is different from USER-SUBMITTED feedback, which is handled by:
 * - submitFeedbackToAgent0() in agent0-reputation-sync.ts - Submits user ratings to Agent0
 * - Agent0FeedbackService.submitFeedback() - Full Agent0 SDK integration with signatures
 *
 * This function is called when:
 * - User is banned/unbanned
 * - User is flagged as scammer/CSAM
 * - Reputation score is recalculated
 *
 * It updates local AgentPerformanceMetrics but does NOT submit feedback to Agent0 network.
 * User feedback submission is handled separately via the feedback endpoints.
 */
export async function syncReputationToERC8004(
  userId: string,
  data: ReputationSyncData
): Promise<void> {
  const user = await selectUserErc8004LocalSyncSliceById(db, userId);

  if (!user || !user.agent0TokenId) {
    logger.debug(
      'User has no Agent0 token ID, skipping ERC-8004 sync',
      { userId },
      'ERC8004Sync'
    );
    return;
  }

  let reputationScore = data.reputationScore;

  if (data.isBanned) {
    reputationScore = 0;
  } else if (data.isScammer || data.isCSAM) {
    reputationScore = 5;
  }

  const agent0Score = Math.round(Math.max(0, Math.min(100, reputationScore)));

  logger.info(
    'Syncing system reputation to local metrics',
    {
      userId,
      agent0TokenId: user.agent0TokenId,
      reputationScore,
      agent0Score,
      isBanned: data.isBanned,
      isScammer: data.isScammer,
      isCSAM: data.isCSAM,
    },
    'ERC8004Sync'
  );

  const existingMetrics = await selectAgentPerformanceMetricsFullRowByUserId(
    db,
    userId
  );

  const now = new Date();
  if (existingMetrics) {
    await updateAgentPerformanceMetricsReputationScoreByUserId(db, userId, {
      reputationScore,
      updatedAt: now,
    });
  } else {
    await insertAgentPerformanceMetricsReputationRow(db, {
      id: await generateSnowflakeId(),
      userId,
      reputationScore,
      updatedAt: now,
    });
  }

  logger.info(
    '✅ Reputation synced to ERC-8004',
    {
      userId,
      agent0TokenId: user.agent0TokenId,
      reputationScore,
    },
    'ERC8004Sync'
  );
}

/**
 * Syncs all user reputations to ERC-8004 (simple version)
 *
 * Useful for batch operations or migrations. For cron jobs, use
 * syncAllReputationsToERC8004 from erc8004-reputation-sync.ts instead.
 */
export async function syncAllReputationsToERC8004Simple(): Promise<void> {
  const userList = await selectUsersNotBannedForErc8004Batch(db, 100);

  logger.info(
    `Syncing ${userList.length} user reputations to ERC-8004`,
    undefined,
    'ERC8004Sync'
  );

  for (const user of userList) {
    if (!user.agent0TokenId) continue;

    const metrics = await selectAgentPerformanceMetricsFullRowByUserId(
      db,
      user.id
    );

    await syncReputationToERC8004(user.id, {
      reputationScore: metrics?.reputationScore ?? 50,
      isBanned: user.isBanned,
      isScammer: user.isScammer,
      isCSAM: user.isCSAM,
    });
  }
}
